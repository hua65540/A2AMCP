import { describe, expect, it, vi } from "vitest";
import { createMcpToolHandlers } from "../src/mcp/mcpToolHandlers.js";
import type { HandoffService } from "../src/handoff/handoffService.js";

describe("MCP tool handlers", () => {
  it("exposes the public handoff tools and returns structured content", async () => {
    const service = buildService();
    const handlers = createMcpToolHandlers(service);

    expect(Object.keys(handlers).sort()).toEqual([
      "finish_handoff",
      "leave_room",
      "pause_handoff",
      "poll_messages",
      "read_handoff_state",
      "read_handoff_status",
      "resume_handoff",
      "send_message",
      "start_handoff",
      "upload_attachment"
    ]);

    const result = await handlers.start_handoff({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });

    expect(service.startHandoff).toHaveBeenCalledWith({
      roomId: "room_1",
      displayName: "服务端 AI",
      role: "server"
    });
    expect(result.structuredContent).toMatchObject({
      handoffId: "room_1__server",
      restored: false
    });
    expect(result.content[0]).toMatchObject({ type: "text" });
  });
});

function buildService(): HandoffService {
  return {
    startHandoff: vi.fn(async () => ({
      handoffId: "room_1__server",
      restored: false,
      state: { handoffId: "room_1__server" }
    })),
    pollMessages: vi.fn(async () => ({ messages: [], state: { handoffId: "room_1__server" } })),
    sendMessage: vi.fn(async () => ({
      skipped: false,
      clientMessageId: "mcp_1",
      message: { id: "msg_1" },
      state: { handoffId: "room_1__server" }
    })),
    uploadAttachment: vi.fn(async () => ({
      skipped: false,
      clientMessageId: "mcp_upload",
      message: { id: "msg_upload" },
      state: { handoffId: "room_1__server" }
    })),
    leaveRoom: vi.fn(async () => ({ state: { handoffId: "room_1__server" } })),
    finishHandoff: vi.fn(async () => ({
      skipped: false,
      clientMessageId: "mcp_finish",
      message: { id: "msg_finish" },
      state: { handoffId: "room_1__server" }
    })),
    pauseHandoff: vi.fn(async () => ({ state: { handoffId: "room_1__server", status: "paused" } })),
    resumeHandoff: vi.fn(async () => ({ state: { handoffId: "room_1__server", status: "discussing" } })),
    readHandoffState: vi.fn(async () => ({ state: { handoffId: "room_1__server" } })),
    readHandoffStatus: vi.fn(async () => ({
      state: { handoffId: "room_1__server" },
      handoff: { roomId: "room_1", status: "discussing" }
    }))
  } as unknown as HandoffService;
}
