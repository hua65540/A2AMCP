import type { BusinessRole, HandoffSessionStatus } from "../shared/index.js";

export type HandoffStatus = "discussing" | "paused" | "completed" | "left";
export type HandoffStopReason = "MAX_REPLIES_EXCEEDED" | "MAX_POLLS_EXCEEDED" | "MAX_DURATION_EXCEEDED" | "DUPLICATE_REPLY_DETECTED";

export type HandoffState = {
  version: 1;
  handoffId: string;
  roomId: string;
  memberId: string;
  displayName: string;
  role: BusinessRole;
  identity: "ai";
  lastScannedMessageId: string | null;
  processedMessageIds: string[];
  sentClientMessageIds: string[];
  pollCount: number;
  replyCount: number;
  recentReplyFingerprints: string[];
  status: HandoffStatus;
  confirmedRoles: BusinessRole[];
  openQuestions: string[];
  pauseReason: string | null;
  stopReason: HandoffStopReason | null;
  stoppedAt: string | null;
  lastKnownSessionStatus: HandoffSessionStatus | null;
  waitingConfirmationNotified: boolean;
  createdAt: string;
  updatedAt: string;
};

export type HandoffStateStore = {
  load(handoffId: string): Promise<HandoffState | null>;
  save(state: HandoffState): Promise<void>;
};
