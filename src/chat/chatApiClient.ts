import type {
  AiRoleStatus,
  AiRoleStatusDto,
  BusinessRole,
  HandoffSessionDto,
  MemberDto,
  MessageDto,
  MessageTarget
} from "../shared/index.js";

export type JoinRoomInput = {
  roomId: string;
  displayName: string;
  role: BusinessRole;
};

export type SendMessageInput = {
  roomId: string;
  senderMemberId: string;
  body: string;
  targetRoles: MessageTarget[];
  clientMessageId: string;
};

export type UploadAttachmentInput = {
  roomId: string;
  senderMemberId: string;
  body: string;
  targetRoles: MessageTarget[];
  clientMessageId: string;
  filePath: string;
};

export type ChatApiClient = {
  joinRoom(input: JoinRoomInput): Promise<MemberDto>;
  listMessages(roomId: string, afterMessageId: string | undefined, limit: number): Promise<MessageDto[]>;
  sendMessage(input: SendMessageInput): Promise<MessageDto>;
  uploadAttachment(input: UploadAttachmentInput): Promise<MessageDto>;
  leaveRoom(roomId: string, memberId: string): Promise<MemberDto>;
  updateAiStatus(
    roomId: string,
    role: BusinessRole,
    memberId: string,
    status: AiRoleStatus
  ): Promise<AiRoleStatusDto[]>;
  startHandoffRole(roomId: string, role: BusinessRole, memberId: string): Promise<HandoffSessionDto>;
  completeHandoffRole(
    roomId: string,
    role: BusinessRole,
    memberId: string,
    summary: string | undefined
  ): Promise<HandoffSessionDto>;
  pauseHandoffRole(
    roomId: string,
    role: BusinessRole,
    memberId: string,
    reason: string | undefined
  ): Promise<HandoffSessionDto>;
  resumeHandoffRole(roomId: string, role: BusinessRole, memberId: string): Promise<HandoffSessionDto>;
  readHandoffStatus(roomId: string, memberId: string): Promise<HandoffSessionDto>;
};
