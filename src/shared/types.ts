import type {
  BUSINESS_ROLES,
  ERROR_CODE,
  HANDOFF_ROLE_STATUS,
  HANDOFF_SESSION_STATUS,
  IDENTITY_TYPE,
  MESSAGE_TARGETS,
  MESSAGE_TYPE,
  ROOM_STATUS
} from "./constants.js";

export type BusinessRole = (typeof BUSINESS_ROLES)[number];
export type MessageTarget = (typeof MESSAGE_TARGETS)[number];
export type IdentityType = (typeof IDENTITY_TYPE)[keyof typeof IDENTITY_TYPE];
export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];
export type MessageType = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE];
export type HandoffSessionStatus = (typeof HANDOFF_SESSION_STATUS)[keyof typeof HANDOFF_SESSION_STATUS];
export type HandoffRoleStatus = (typeof HANDOFF_ROLE_STATUS)[keyof typeof HANDOFF_ROLE_STATUS];
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export type RoomDto = {
  id: string;
  name: string;
  status: RoomStatus;
  ownerMemberId: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  lastMessageAt?: string | null;
  activeMemberCount?: number;
};

export type MemberDto = {
  id: string;
  roomId: string;
  displayName: string;
  identityType: IdentityType;
  businessRole: BusinessRole | null;
  isOwner: boolean;
  isOnline: boolean;
  joinedAt: string;
  leftAt: string | null;
};

export type MessageDto = {
  id: string;
  roomId: string;
  senderMemberId: string;
  senderDisplayName: string;
  senderIdentityType: IdentityType;
  senderBusinessRole: BusinessRole | null;
  body: string;
  messageType: MessageType;
  targetRoles: MessageTarget[];
  contextRoles: MessageTarget[];
  clientMessageId: string | null;
  createdAt: string;
  attachments: AttachmentDto[];
};

export type AttachmentDto = {
  id: string;
  roomId: string;
  messageId: string;
  uploaderMemberId: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
};

export type HandoffRoleDto = {
  roomId: string;
  role: BusinessRole;
  memberId: string | null;
  status: HandoffRoleStatus;
  pauseReason: string | null;
  completedSummary: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  pausedAt: string | null;
  leftAt: string | null;
};

export type HandoffSessionDto = {
  roomId: string;
  status: HandoffSessionStatus;
  roles: HandoffRoleDto[];
  activeRoles: BusinessRole[];
  completedRoles: BusinessRole[];
  pendingRoles: BusinessRole[];
  pausedRoles: BusinessRole[];
  createdAt: string;
  updatedAt: string;
  waitingSince: string | null;
  confirmedAt: string | null;
};
