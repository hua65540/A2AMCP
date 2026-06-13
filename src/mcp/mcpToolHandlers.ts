import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { BusinessRole, MessageTarget } from "../shared/index.js";
import type { HandoffService } from "../handoff/handoffService.js";

export type A2aMcpToolHandlers = ReturnType<typeof createMcpToolHandlers>;

export function createMcpToolHandlers(service: HandoffService) {
  return {
    start_handoff: async (input: { roomId: string; displayName: string; role: BusinessRole }) =>
      toToolResult(await service.startHandoff(input)),

    poll_messages: async (input: { handoffId: string; limit?: number | undefined }) =>
      toToolResult(await service.pollMessages(input)),

    send_message: async (input: {
      handoffId: string;
      content: string;
      targetRoles: MessageTarget[];
      replyToMessageIds?: string[] | undefined;
    }) => toToolResult(await service.sendMessage(input)),

    upload_attachment: async (input: {
      handoffId: string;
      filePath: string;
      content?: string | undefined;
      targetRoles: MessageTarget[];
      replyToMessageIds?: string[] | undefined;
    }) => toToolResult(await service.uploadAttachment(input)),

    leave_room: async (input: { handoffId: string }) => toToolResult(await service.leaveRoom(input)),

    finish_handoff: async (input: { handoffId: string; summary?: string | undefined }) =>
      toToolResult(await service.finishHandoff(input)),

    pause_handoff: async (input: { handoffId: string; reason?: string | undefined }) =>
      toToolResult(await service.pauseHandoff(input)),

    resume_handoff: async (input: { handoffId: string }) => toToolResult(await service.resumeHandoff(input)),

    read_handoff_state: async (input: { handoffId: string }) => toToolResult(await service.readHandoffState(input)),

    read_handoff_status: async (input: { handoffId: string }) => toToolResult(await service.readHandoffStatus(input))
  };
}

function toToolResult<T extends Record<string, unknown>>(value: T): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
      }
    ],
    structuredContent: value
  };
}
