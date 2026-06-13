import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BusinessRole, HandoffSessionDto, MemberDto, MessageDto } from "../shared/index.js";
import type { ChatApiClient, JoinRoomInput, SendMessageInput, UploadAttachmentInput } from "./chatApiClient.js";

type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export function createHttpChatApiClient(input: { apiBaseUrl: string; fetch?: FetchLike | undefined }): ChatApiClient {
  const apiBaseUrl = input.apiBaseUrl.replace(/\/+$/, "");
  const fetchImpl = input.fetch ?? fetch;

  return {
    async joinRoom(joinInput: JoinRoomInput): Promise<MemberDto> {
      const result = await request<{ member: MemberDto }>(fetchImpl, `${apiBaseUrl}/rooms/${segment(joinInput.roomId)}/members`, {
        method: "POST",
        json: {
          displayName: joinInput.displayName,
          identityType: "ai",
          businessRole: joinInput.role
        }
      });
      return result.member;
    },

    async listMessages(roomId: string, afterMessageId: string | undefined, limit: number): Promise<MessageDto[]> {
      const params = new URLSearchParams();
      if (afterMessageId) params.set("after", afterMessageId);
      params.set("limit", String(limit));
      const result = await request<{ messages: MessageDto[] }>(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(roomId)}/messages?${params.toString()}`,
        { method: "GET" }
      );
      return result.messages;
    },

    async sendMessage(messageInput: SendMessageInput): Promise<MessageDto> {
      const result = await request<{ message: MessageDto }>(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(messageInput.roomId)}/messages`,
        {
          method: "POST",
          json: {
            senderMemberId: messageInput.senderMemberId,
            body: messageInput.body,
            targetRoles: messageInput.targetRoles,
            clientMessageId: messageInput.clientMessageId
          }
        }
      );
      return result.message;
    },

    async uploadAttachment(uploadInput: UploadAttachmentInput): Promise<MessageDto> {
      const form = new FormData();
      form.set("senderMemberId", uploadInput.senderMemberId);
      form.set("body", uploadInput.body);
      form.set("targetRoles", JSON.stringify(uploadInput.targetRoles));
      form.set("clientMessageId", uploadInput.clientMessageId);
      const buffer = await readFile(uploadInput.filePath);
      form.append("files", new Blob([buffer]), path.basename(uploadInput.filePath));

      const result = await request<{ message: MessageDto }>(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(uploadInput.roomId)}/messages/with-attachments`,
        {
          method: "POST",
          body: form
        }
      );
      return result.message;
    },

    async leaveRoom(roomId: string, memberId: string): Promise<MemberDto> {
      const result = await request<{ member: MemberDto }>(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(roomId)}/members/${segment(memberId)}/leave`,
        { method: "POST" }
      );
      return result.member;
    },

    async startHandoffRole(roomId: string, role: BusinessRole, memberId: string): Promise<HandoffSessionDto> {
      return handoffRequest(fetchImpl, `${apiBaseUrl}/rooms/${segment(roomId)}/handoff/roles/${segment(role)}/start`, {
        memberId
      });
    },

    async completeHandoffRole(
      roomId: string,
      role: BusinessRole,
      memberId: string,
      summary: string | undefined
    ): Promise<HandoffSessionDto> {
      return handoffRequest(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(roomId)}/handoff/roles/${segment(role)}/complete`,
        summary ? { memberId, summary } : { memberId }
      );
    },

    async pauseHandoffRole(
      roomId: string,
      role: BusinessRole,
      memberId: string,
      reason: string | undefined
    ): Promise<HandoffSessionDto> {
      return handoffRequest(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(roomId)}/handoff/roles/${segment(role)}/pause`,
        reason ? { memberId, reason } : { memberId }
      );
    },

    async resumeHandoffRole(roomId: string, role: BusinessRole, memberId: string): Promise<HandoffSessionDto> {
      return handoffRequest(fetchImpl, `${apiBaseUrl}/rooms/${segment(roomId)}/handoff/roles/${segment(role)}/resume`, {
        memberId
      });
    },

    async readHandoffStatus(roomId: string, memberId: string): Promise<HandoffSessionDto> {
      const params = new URLSearchParams({ memberId });
      const result = await request<{ handoff: HandoffSessionDto }>(
        fetchImpl,
        `${apiBaseUrl}/rooms/${segment(roomId)}/handoff?${params.toString()}`,
        { method: "GET" }
      );
      return result.handoff;
    }
  };
}

async function handoffRequest(fetchImpl: FetchLike, url: string, body: Record<string, string>): Promise<HandoffSessionDto> {
  const result = await request<{ handoff: HandoffSessionDto }>(fetchImpl, url, {
    method: "POST",
    json: body
  });
  return result.handoff;
}

async function request<T>(
  fetchImpl: FetchLike,
  url: string,
  options: { method: string; json?: unknown; body?: BodyInit | undefined }
): Promise<T> {
  const headers = new Headers();
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }

  const response = await fetchImpl(url, { method: options.method, headers, ...(body ? { body } : {}) });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`A2A_HTTP_${response.status}${text ? `:${text}` : ""}`);
  }
  return response.json() as Promise<T>;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}
