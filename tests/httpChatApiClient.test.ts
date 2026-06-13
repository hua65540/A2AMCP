import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpChatApiClient } from "../src/chat/httpChatApiClient.js";

describe("HTTP chat API client", () => {
  let tempDir: string | null = null;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  });

  it("joins a room as an AI member through the existing member API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ member: { id: "mem_ai" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.joinRoom({ roomId: "room_1", displayName: "服务端 AI", role: "server" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat.test/api/rooms/room_1/members",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          displayName: "服务端 AI",
          identityType: "ai",
          businessRole: "server"
        })
      })
    );
  });

  it("lists messages with cursor and limit query parameters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ messages: [] }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.listMessages("room_1", "msg_1", 25);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat.test/api/rooms/room_1/messages?after=msg_1&limit=25",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("sends messages with a stable clientMessageId", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: { id: "msg_sent" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.sendMessage({
      roomId: "room_1",
      senderMemberId: "mem_ai",
      body: "字段必须是字符串",
      targetRoles: ["ios_client"],
      clientMessageId: "mcp_123"
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat.test/api/rooms/room_1/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          senderMemberId: "mem_ai",
          body: "字段必须是字符串",
          targetRoles: ["ios_client"],
          clientMessageId: "mcp_123"
        })
      })
    );
  });

  it("uploads a local file through the existing attachment API", async () => {
    tempDir = mkdtempSync(path.join(tmpdir(), "a2a-upload-client-"));
    const filePath = path.join(tempDir, "field.txt");
    writeFileSync(filePath, "field contract");
    const fetchMock = vi.fn(async () => jsonResponse({ message: { id: "msg_upload" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.uploadAttachment({
      roomId: "room_1",
      senderMemberId: "mem_ai",
      body: "字段说明",
      targetRoles: ["ios_client"],
      clientMessageId: "mcp_upload",
      filePath
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat.test/api/rooms/room_1/messages/with-attachments",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData)
      })
    );
  });

  it("leaves a room through the existing member leave API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ member: { id: "mem_ai" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.leaveRoom("room_1", "mem_ai");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://chat.test/api/rooms/room_1/members/mem_ai/leave",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("registers and completes central handoff role status through the handoff API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ handoff: { roomId: "room_1", status: "discussing" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.startHandoffRole("room_1", "server", "mem_ai");
    await client.completeHandoffRole("room_1", "server", "mem_ai", "服务端字段已确认");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://chat.test/api/rooms/room_1/handoff/roles/server/start",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ memberId: "mem_ai" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://chat.test/api/rooms/room_1/handoff/roles/server/complete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ memberId: "mem_ai", summary: "服务端字段已确认" })
      })
    );
  });

  it("pauses, resumes, and reads central handoff status through the handoff API", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ handoff: { roomId: "room_1", status: "discussing" } }));
    const client = createHttpChatApiClient({ apiBaseUrl: "http://chat.test/api", fetch: fetchMock });

    await client.pauseHandoffRole("room_1", "server", "mem_ai", "等待环境");
    await client.resumeHandoffRole("room_1", "server", "mem_ai");
    await client.readHandoffStatus("room_1", "mem_ai");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://chat.test/api/rooms/room_1/handoff/roles/server/pause",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ memberId: "mem_ai", reason: "等待环境" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "http://chat.test/api/rooms/room_1/handoff/roles/server/resume",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ memberId: "mem_ai" })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://chat.test/api/rooms/room_1/handoff?memberId=mem_ai",
      expect.objectContaining({ method: "GET" })
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
