import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHttpChatApiClient } from "../src/chat/httpChatApiClient.js";
import { createHandoffService } from "../src/handoff/handoffService.js";
import { createFileHandoffStateStore } from "../src/state/fileHandoffStateStore.js";
import { MESSAGE_TYPE, type MessageDto, type MessageTarget } from "../src/shared/index.js";

describe("handoff integration with chatroom HTTP API", () => {
  let httpServer: Server;
  let stateRoot: string;
  let apiBaseUrl: string;
  let messages: MessageDto[];

  beforeEach(async () => {
    messages = [];
    stateRoot = mkdtempSync(path.join(tmpdir(), "a2a-mcp-integration-state-"));
    httpServer = createServer((request, response) => {
      void routeTestApi(request, response, messages);
    });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("TEST_SERVER_PORT_MISSING");
    apiBaseUrl = `http://127.0.0.1:${address.port}/api`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      httpServer.close((error) => (error ? reject(error) : resolve()));
    });
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it("joins as server AI, polls targeted messages, sends a reply, and persists it in room history", async () => {
    const service = createHandoffService({
      chatClient: createHttpChatApiClient({ apiBaseUrl }),
      stateStore: createFileHandoffStateStore(stateRoot),
      now: () => "2026-06-13T00:00:00.000Z"
    });
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    await postJson(`${apiBaseUrl}/rooms/room_1/messages`, {
      senderMemberId: "mem_human",
      body: "请确认 user_id 是字符串还是数字",
      targetRoles: ["server"]
    });
    await postJson(`${apiBaseUrl}/rooms/room_1/messages`, {
      senderMemberId: "mem_human",
      body: "这是发给产品的问题",
      targetRoles: ["product"]
    });

    const polled = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });
    await service.sendMessage({
      handoffId: started.state.handoffId,
      content: "user_id 使用字符串。",
      targetRoles: ["ios_client"],
      replyToMessageIds: polled.messages.map((message) => message.id)
    });

    const snapshot = await fetch(`${apiBaseUrl}/rooms/room_1`).then(
      (response) => response.json() as Promise<{ messages: Array<{ body: string }> }>
    );
    expect(polled.messages.map((message) => message.body)).toEqual(["请确认 user_id 是字符串还是数字"]);
    expect(snapshot.messages.map((message) => message.body)).toContain("user_id 使用字符串。");
  });
});

async function routeTestApi(
  request: IncomingMessage,
  response: ServerResponse,
  messages: MessageDto[]
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts[0] !== "api" || pathParts[1] !== "rooms") return writeJson(response, 404, { error: "NOT_FOUND" });
  const roomId = pathParts[2] ?? "";

  if (request.method === "POST" && pathParts[3] === "members" && pathParts.length === 4) {
    return writeJson(response, 200, {
      member: {
        id: "mem_ai",
        roomId,
        displayName: "服务端 AI",
        identityType: "ai",
        businessRole: "server",
        isOwner: false,
        isOnline: true,
        joinedAt: "2026-06-13T00:00:00.000Z",
        leftAt: null
      }
    });
  }

  if (request.method === "POST" && pathParts[3] === "handoff" && pathParts[4] === "roles") {
    return writeJson(response, 200, {
      handoff: {
        roomId,
        status: "discussing",
        roles: [],
        activeRoles: ["server"],
        completedRoles: [],
        pendingRoles: ["server"],
        pausedRoles: [],
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T00:00:00.000Z",
        waitingSince: null,
        confirmedAt: null
      }
    });
  }

  if (request.method === "GET" && pathParts[3] === "handoff") {
    return writeJson(response, 200, {
      handoff: {
        roomId,
        status: "discussing",
        roles: [],
        activeRoles: ["server"],
        completedRoles: [],
        pendingRoles: ["server"],
        pausedRoles: [],
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T00:00:00.000Z",
        waitingSince: null,
        confirmedAt: null
      }
    });
  }

  if (request.method === "GET" && pathParts[3] === "messages") {
    const after = url.searchParams.get("after");
    const afterIndex = after ? messages.findIndex((message) => message.id === after) : -1;
    return writeJson(response, 200, { messages: messages.slice(afterIndex + 1) });
  }

  if (request.method === "POST" && pathParts[3] === "messages") {
    const body = (await readJson(request)) as {
      senderMemberId: string;
      body: string;
      targetRoles: MessageTarget[];
      clientMessageId?: string | null;
    };
    const message = buildMessage({
      id: `msg_${messages.length + 1}`,
      roomId,
      senderMemberId: body.senderMemberId,
      body: body.body,
      targetRoles: body.targetRoles,
      clientMessageId: body.clientMessageId ?? null
    });
    messages.push(message);
    return writeJson(response, 200, { message });
  }

  if (request.method === "GET" && pathParts.length === 3) {
    return writeJson(response, 200, { messages });
  }

  return writeJson(response, 404, { error: "NOT_FOUND" });
}

function buildMessage(input: {
  id: string;
  roomId: string;
  senderMemberId: string;
  body: string;
  targetRoles: MessageTarget[];
  clientMessageId: string | null;
}): MessageDto {
  return {
    id: input.id,
    roomId: input.roomId,
    senderMemberId: input.senderMemberId,
    senderDisplayName: input.senderMemberId === "mem_ai" ? "服务端 AI" : "iOS 同学",
    senderIdentityType: input.senderMemberId === "mem_ai" ? "ai" : "human",
    senderBusinessRole: input.senderMemberId === "mem_ai" ? "server" : "ios_client",
    body: input.body,
    messageType: MESSAGE_TYPE.roleMessage,
    targetRoles: input.targetRoles,
    contextRoles: input.targetRoles,
    clientMessageId: input.clientMessageId,
    createdAt: "2026-06-13T00:00:00.000Z",
    attachments: []
  };
}

async function postJson<T = unknown>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}:${await response.text()}`);
  return response.json() as Promise<T>;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
