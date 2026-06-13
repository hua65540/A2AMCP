import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessRole, HandoffSessionDto, MemberDto, MessageDto } from "../src/shared/index.js";
import { MESSAGE_TARGET_ALL, MESSAGE_TYPE } from "../src/shared/index.js";
import { createHandoffService } from "../src/handoff/handoffService.js";
import { createFileHandoffStateStore } from "../src/state/fileHandoffStateStore.js";
import type { ChatApiClient } from "../src/chat/chatApiClient.js";

describe("handoff service", () => {
  let stateRoot: string;
  let sentMessages: Array<{ body: string; targetRoles: BusinessRole[] | ["all"]; clientMessageId: string }>;
  let client: ChatApiClient;

  beforeEach(() => {
    stateRoot = mkdtempSync(path.join(tmpdir(), "a2a-handoff-service-"));
    sentMessages = [];
    client = {
      joinRoom: vi.fn(async () => buildMember("mem_server_ai", "server")),
      listMessages: vi.fn(async (_roomId, after) => buildMessagePage(after)),
      sendMessage: vi.fn(async (input) => {
        sentMessages.push({
          body: input.body,
          targetRoles: input.targetRoles as BusinessRole[] | ["all"],
          clientMessageId: input.clientMessageId
        });
        return buildMessage({
          id: `msg_sent_${sentMessages.length}`,
          senderMemberId: input.senderMemberId,
          senderBusinessRole: "server",
          targetRoles: input.targetRoles,
          body: input.body
        });
      }),
      uploadAttachment: vi.fn(),
      leaveRoom: vi.fn(async () => buildMember("mem_server_ai", "server", "2026-06-13T00:05:00.000Z")),
      startHandoffRole: vi.fn(async () => buildHandoff("discussing")),
      completeHandoffRole: vi.fn(async () => buildHandoff("waiting_human_confirmation")),
      pauseHandoffRole: vi.fn(async () => buildHandoff("discussing", "paused")),
      resumeHandoffRole: vi.fn(async () => buildHandoff("discussing")),
      readHandoffStatus: vi.fn(async () => buildHandoff("discussing"))
    } as unknown as ChatApiClient;
  });

  afterEach(() => {
    rmSync(stateRoot, { recursive: true, force: true });
  });

  it("starts a handoff by joining as an AI member and restores existing state on repeated start", async () => {
    const service = createService(client, stateRoot);

    const first = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });
    const second = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    expect(client.joinRoom).toHaveBeenCalledTimes(1);
    expect(client.startHandoffRole).toHaveBeenCalledWith("room_1", "server", "mem_server_ai");
    expect(first.restored).toBe(false);
    expect(second.restored).toBe(true);
    expect(second.state).toMatchObject({
      handoffId: "room_1__server",
      memberId: "mem_server_ai",
      role: "server",
      identity: "ai"
    });
  });

  it("polls only messages targeting the handoff role or all AI, and never returns scanned messages twice", async () => {
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const firstPoll = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });
    const secondPoll = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });

    expect(firstPoll.messages.map((message) => message.body)).toEqual(["服务端确认字段", "所有 AI 同步"]);
    expect(secondPoll.messages).toEqual([]);
    expect(firstPoll.state.lastScannedMessageId).toBe("msg_4");
    expect(client.listMessages).toHaveBeenLastCalledWith("room_1", "msg_4", 50);
  });

  it("sends a reply once for the same content and marks replied messages as processed", async () => {
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const first = await service.sendMessage({
      handoffId: started.state.handoffId,
      content: "字段必须是字符串",
      targetRoles: ["ios_client"],
      replyToMessageIds: ["msg_1"]
    });
    const second = await service.sendMessage({
      handoffId: started.state.handoffId,
      content: "字段必须是字符串",
      targetRoles: ["ios_client"],
      replyToMessageIds: ["msg_1"]
    });

    expect(first.skipped).toBe(false);
    expect(second.skipped).toBe(true);
    expect(client.sendMessage).toHaveBeenCalledTimes(1);
    expect(first.state.processedMessageIds).toContain("msg_1");
    expect(second.clientMessageId).toBe(first.clientMessageId);
  });

  it("finishes a handoff once, records central status, and rejects normal replies after completion", async () => {
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const finished = await service.finishHandoff({
      handoffId: started.state.handoffId,
      summary: "服务端字段已确认"
    });
    const finishedAgain = await service.finishHandoff({
      handoffId: started.state.handoffId,
      summary: "服务端字段已确认"
    });

    expect(finished.state.status).toBe("completed");
    expect(finished.handoff?.status).toBe("waiting_human_confirmation");
    expect(finished.state.confirmedRoles).toEqual(["server"]);
    expect(client.completeHandoffRole).toHaveBeenCalledWith("room_1", "server", "mem_server_ai", "服务端字段已确认");
    expect(sentMessages.map((message) => message.body)).toEqual([
      "服务端 已确认对接完成：服务端字段已确认",
      "所有 AI 已完成对接，等待人工确认。"
    ]);
    expect(finishedAgain.skipped).toBe(true);
    await expect(
      service.sendMessage({
        handoffId: started.state.handoffId,
        content: "完成后不应继续发普通回复",
        targetRoles: ["ios_client"]
      })
    ).rejects.toThrow("HANDOFF_COMPLETED");
  });

  it("pauses and resumes a handoff without advancing the message cursor while paused", async () => {
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const paused = await service.pauseHandoff({
      handoffId: started.state.handoffId,
      reason: "等待服务端环境"
    });
    const pausedPoll = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });
    expect(client.listMessages).not.toHaveBeenCalled();
    await expect(
      service.sendMessage({
        handoffId: started.state.handoffId,
        content: "暂停后不应发送",
        targetRoles: ["ios_client"]
      })
    ).rejects.toThrow("HANDOFF_PAUSED");

    const resumed = await service.resumeHandoff({ handoffId: started.state.handoffId });
    const resumedPoll = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });

    expect(paused.state.status).toBe("paused");
    expect(paused.state.pauseReason).toBe("等待服务端环境");
    expect(pausedPoll.messages).toEqual([]);
    expect(resumed.state.status).toBe("discussing");
    expect(resumedPoll.messages.map((message) => message.body)).toEqual(["服务端确认字段", "所有 AI 同步"]);
  });

  it("reads local and central handoff status together", async () => {
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const result = await service.readHandoffStatus({ handoffId: started.state.handoffId });

    expect(result.state.handoffId).toBe("room_1__server");
    expect(result.handoff.status).toBe("discussing");
    expect(client.readHandoffStatus).toHaveBeenCalledWith("room_1", "mem_server_ai");
  });

  it("does not poll or send when the central handoff is waiting for human confirmation", async () => {
    client.readHandoffStatus = vi.fn(async () => buildHandoff("waiting_human_confirmation", "completed"));
    const service = createService(client, stateRoot);
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    const polled = await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });

    expect(polled.messages).toEqual([]);
    expect(client.listMessages).not.toHaveBeenCalled();
    expect(polled.state.lastKnownSessionStatus).toBe("waiting_human_confirmation");
    await expect(
      service.sendMessage({
        handoffId: started.state.handoffId,
        content: "等待人工确认后不应继续回复",
        targetRoles: ["ios_client"]
      })
    ).rejects.toThrow("HANDOFF_SESSION_NOT_DISCUSSING");
  });

  it("automatically pauses when reply count exceeds the configured limit", async () => {
    const service = createHandoffService({
      chatClient: client,
      stateStore: createFileHandoffStateStore(stateRoot),
      now: () => "2026-06-13T00:00:00.000Z",
      safety: { maxReplies: 1, maxPolls: 100, maxDurationMs: 60 * 60 * 1000, recentReplyWindow: 10 }
    });
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    await service.sendMessage({
      handoffId: started.state.handoffId,
      content: "第一次回复",
      targetRoles: ["ios_client"]
    });

    await expect(
      service.sendMessage({
        handoffId: started.state.handoffId,
        content: "第二次回复",
        targetRoles: ["ios_client"]
      })
    ).rejects.toThrow("HANDOFF_AUTO_PAUSED");
    const state = await service.readHandoffState({ handoffId: started.state.handoffId });
    expect(state.state.status).toBe("paused");
    expect(state.state.replyCount).toBe(1);
    expect(state.state.stopReason).toBe("MAX_REPLIES_EXCEEDED");
    expect(client.pauseHandoffRole).toHaveBeenCalledWith(
      "room_1",
      "server",
      "mem_server_ai",
      "MAX_REPLIES_EXCEEDED"
    );
  });

  it("automatically pauses when polling exceeds the configured limit without advancing the cursor", async () => {
    const service = createHandoffService({
      chatClient: client,
      stateStore: createFileHandoffStateStore(stateRoot),
      now: () => "2026-06-13T00:00:00.000Z",
      safety: { maxReplies: 100, maxPolls: 1, maxDurationMs: 60 * 60 * 1000, recentReplyWindow: 10 }
    });
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    await service.pollMessages({ handoffId: started.state.handoffId, limit: 50 });
    await expect(service.pollMessages({ handoffId: started.state.handoffId, limit: 50 })).rejects.toThrow(
      "HANDOFF_AUTO_PAUSED"
    );

    const state = await service.readHandoffState({ handoffId: started.state.handoffId });
    expect(state.state.status).toBe("paused");
    expect(state.state.pollCount).toBe(1);
    expect(state.state.lastScannedMessageId).toBe("msg_4");
    expect(state.state.stopReason).toBe("MAX_POLLS_EXCEEDED");
  });

  it("automatically pauses when handoff duration exceeds the configured limit", async () => {
    const service = createHandoffService({
      chatClient: client,
      stateStore: createFileHandoffStateStore(stateRoot),
      now: vi
        .fn()
        .mockReturnValueOnce("2026-06-13T00:00:00.000Z")
        .mockReturnValue("2026-06-13T00:10:01.000Z"),
      safety: { maxReplies: 100, maxPolls: 100, maxDurationMs: 10 * 60 * 1000, recentReplyWindow: 10 }
    });
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    await expect(service.pollMessages({ handoffId: started.state.handoffId, limit: 50 })).rejects.toThrow(
      "HANDOFF_AUTO_PAUSED"
    );
    const state = await service.readHandoffState({ handoffId: started.state.handoffId });
    expect(state.state.status).toBe("paused");
    expect(state.state.stopReason).toBe("MAX_DURATION_EXCEEDED");
  });

  it("automatically pauses when a repeated reply fingerprint is detected", async () => {
    const service = createHandoffService({
      chatClient: client,
      stateStore: createFileHandoffStateStore(stateRoot),
      now: () => "2026-06-13T00:00:00.000Z",
      safety: { maxReplies: 100, maxPolls: 100, maxDurationMs: 60 * 60 * 1000, recentReplyWindow: 10 }
    });
    const started = await service.startHandoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    await service.sendMessage({
      handoffId: started.state.handoffId,
      content: "字段使用字符串",
      targetRoles: ["ios_client"],
      replyToMessageIds: ["msg_1"]
    });

    await expect(
      service.sendMessage({
        handoffId: started.state.handoffId,
        content: "字段使用字符串",
        targetRoles: ["ios_client"],
        replyToMessageIds: ["msg_3"]
      })
    ).rejects.toThrow("HANDOFF_AUTO_PAUSED");
    const state = await service.readHandoffState({ handoffId: started.state.handoffId });
    expect(state.state.status).toBe("paused");
    expect(state.state.stopReason).toBe("DUPLICATE_REPLY_DETECTED");
  });
});

function createService(client: ChatApiClient, stateRoot: string) {
  return createHandoffService({
    chatClient: client,
    stateStore: createFileHandoffStateStore(stateRoot),
    now: () => "2026-06-13T00:00:00.000Z"
  });
}

function buildMember(id: string, role: BusinessRole, leftAt: string | null = null): MemberDto {
  return {
    id,
    roomId: "room_1",
    displayName: "服务端 AI",
    identityType: "ai",
    businessRole: role,
    isOwner: false,
    isOnline: true,
    joinedAt: "2026-06-13T00:00:00.000Z",
    leftAt
  };
}

function buildMessagePage(after?: string): MessageDto[] {
  if (after === "msg_4") return [];
  return [
    buildMessage({ id: "msg_1", targetRoles: ["server"], body: "服务端确认字段" }),
    buildMessage({ id: "msg_2", targetRoles: ["ios_client"], body: "客户端处理字段" }),
    buildMessage({ id: "msg_3", targetRoles: [MESSAGE_TARGET_ALL], body: "所有 AI 同步" }),
    buildMessage({ id: "msg_4", senderMemberId: "mem_server_ai", targetRoles: ["ios_client"], body: "自己发出的消息" })
  ];
}

function buildMessage(input: {
  id: string;
  targetRoles: MessageDto["targetRoles"];
  body: string;
  senderMemberId?: string;
  senderBusinessRole?: BusinessRole;
}): MessageDto {
  return {
    id: input.id,
    roomId: "room_1",
    senderMemberId: input.senderMemberId ?? "mem_human",
    senderDisplayName: "强尼",
    senderIdentityType: input.senderMemberId === "mem_server_ai" ? "ai" : "human",
    senderBusinessRole: input.senderBusinessRole ?? "ios_client",
    body: input.body,
    messageType: MESSAGE_TYPE.roleMessage,
    targetRoles: [...input.targetRoles],
    contextRoles: [...input.targetRoles],
    clientMessageId: null,
    createdAt: "2026-06-13T00:00:00.000Z",
    attachments: []
  };
}

function buildHandoff(
  status: HandoffSessionDto["status"],
  roleStatus: HandoffSessionDto["roles"][number]["status"] = "discussing"
): HandoffSessionDto {
  return {
    roomId: "room_1",
    status,
    roles: [
      {
        roomId: "room_1",
        role: "server",
        memberId: "mem_server_ai",
        status: roleStatus,
        pauseReason: roleStatus === "paused" ? "等待服务端环境" : null,
        completedSummary: roleStatus === "completed" ? "服务端字段已确认" : null,
        createdAt: "2026-06-13T00:00:00.000Z",
        updatedAt: "2026-06-13T00:00:00.000Z",
        completedAt: roleStatus === "completed" ? "2026-06-13T00:00:00.000Z" : null,
        pausedAt: roleStatus === "paused" ? "2026-06-13T00:00:00.000Z" : null,
        leftAt: null
      }
    ],
    activeRoles: ["server"],
    completedRoles: roleStatus === "completed" ? ["server"] : [],
    pendingRoles: roleStatus === "discussing" ? ["server"] : [],
    pausedRoles: roleStatus === "paused" ? ["server"] : [],
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z",
    waitingSince: status === "waiting_human_confirmation" ? "2026-06-13T00:00:00.000Z" : null,
    confirmedAt: null
  };
}
