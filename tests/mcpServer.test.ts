import { describe, expect, it, vi } from "vitest";
import { createA2aMcpServer } from "../src/mcp/mcpServer.js";
import type { HandoffService } from "../src/handoff/handoffService.js";

describe("A2A MCP server", () => {
  it("registers all public handoff tools", () => {
    const server = createA2aMcpServer(buildService());
    const registeredTools = Reflect.get(server, "_registeredTools") as Record<string, unknown>;

    expect(Object.keys(registeredTools).sort()).toEqual([
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
  });
});

function buildService(): HandoffService {
  return {
    startHandoff: vi.fn(),
    pollMessages: vi.fn(),
    sendMessage: vi.fn(),
    uploadAttachment: vi.fn(),
    leaveRoom: vi.fn(),
    finishHandoff: vi.fn(),
    pauseHandoff: vi.fn(),
    resumeHandoff: vi.fn(),
    readHandoffState: vi.fn(),
    readHandoffStatus: vi.fn()
  } as unknown as HandoffService;
}
