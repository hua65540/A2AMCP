export const BUSINESS_ROLE = {
  iosClient: "ios_client",
  androidClient: "android_client",
  server: "server",
  qa: "qa",
  product: "product"
} as const;

export const BUSINESS_ROLES = [
  BUSINESS_ROLE.iosClient,
  BUSINESS_ROLE.androidClient,
  BUSINESS_ROLE.server,
  BUSINESS_ROLE.qa,
  BUSINESS_ROLE.product
] as const;

type BusinessRole = (typeof BUSINESS_ROLES)[number];

export const BUSINESS_ROLE_LABEL: Record<BusinessRole, string> = {
  ios_client: "iOS 客户端",
  android_client: "Android 客户端",
  server: "服务端",
  qa: "测试端",
  product: "产品端"
};

export const MESSAGE_TARGET_ALL = "all";
export const MESSAGE_TARGETS = [...BUSINESS_ROLES, MESSAGE_TARGET_ALL] as const;

export const IDENTITY_TYPE = {
  admin: "admin",
  human: "human",
  ai: "ai"
} as const;

export const ROOM_STATUS = {
  active: "active",
  suspended: "suspended",
  archived: "archived"
} as const;

export const MESSAGE_TYPE = {
  roleMessage: "role_message",
  system: "system"
} as const;

export const HANDOFF_SESSION_STATUS = {
  discussing: "discussing",
  waitingHumanConfirmation: "waiting_human_confirmation",
  confirmed: "confirmed",
  archived: "archived"
} as const;

export const HANDOFF_ROLE_STATUS = {
  discussing: "discussing",
  paused: "paused",
  completed: "completed",
  left: "left"
} as const;

export const AI_ROLE_STATUS = {
  offline: "offline",
  idle: "idle",
  busy: "busy"
} as const;

export const ERROR_CODE = {
  adminAuthRequired: "ADMIN_AUTH_REQUIRED",
  adminRateLimited: "ADMIN_RATE_LIMITED",
  invalidRequest: "INVALID_REQUEST",
  roomNotFound: "ROOM_NOT_FOUND",
  roomSuspended: "ROOM_SUSPENDED",
  roomArchived: "ROOM_ARCHIVED",
  roomStatusConflict: "ROOM_STATUS_CONFLICT",
  memberNotFound: "MEMBER_NOT_FOUND",
  memberLeft: "MEMBER_LEFT",
  memberNotInRoom: "MEMBER_NOT_IN_ROOM",
  aiRoleOccupied: "AI_ROLE_OCCUPIED",
  permissionDenied: "PERMISSION_DENIED",
  messageTargetRequired: "MESSAGE_TARGET_REQUIRED",
  messageBodyRequired: "MESSAGE_BODY_REQUIRED",
  duplicateMessage: "DUPLICATE_MESSAGE",
  uploadTooLarge: "UPLOAD_TOO_LARGE",
  tooManyFiles: "TOO_MANY_FILES",
  invalidFileName: "INVALID_FILE_NAME",
  fileWriteFailed: "FILE_WRITE_FAILED",
  fileNotFound: "FILE_NOT_FOUND",
  handoffStatusConflict: "HANDOFF_STATUS_CONFLICT",
  databaseBusy: "DATABASE_BUSY",
  configError: "CONFIG_ERROR"
} as const;
