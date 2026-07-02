import { createHash } from "node:crypto";
import {
  AI_ROLE_STATUS,
  BUSINESS_ROLES,
  BUSINESS_ROLE_LABEL,
  HANDOFF_SESSION_STATUS,
  MESSAGE_TARGET_ALL,
  type AiRoleStatus,
  type BusinessRole,
  type HandoffSessionDto,
  type MessageDto,
  type MessageTarget
} from "../shared/index.js";
import type { ChatApiClient } from "../chat/chatApiClient.js";
import { createHandoffId } from "../state/handoffIds.js";
import type { HandoffState, HandoffStateStore, HandoffStopReason } from "../state/types.js";

export type HandoffService = ReturnType<typeof createHandoffService>;
export type HandoffSafetyPolicy = {
  maxReplies: number;
  maxPolls: number;
  maxDurationMs: number;
  recentReplyWindow: number;
};

export const DEFAULT_HANDOFF_SAFETY_POLICY: HandoffSafetyPolicy = {
  maxReplies: 30,
  maxPolls: 500,
  maxDurationMs: 2 * 60 * 60 * 1000,
  recentReplyWindow: 20
};

type HandoffServiceDependencies = {
  chatClient: ChatApiClient;
  stateStore: HandoffStateStore;
  now?: () => string;
  safety?: HandoffSafetyPolicy;
};

export function createHandoffService({
  chatClient,
  stateStore,
  now = () => new Date().toISOString(),
  safety = DEFAULT_HANDOFF_SAFETY_POLICY
}: HandoffServiceDependencies) {
  return {
    async startHandoff(input: { roomId: string; displayName: string; role: BusinessRole }) {
      assertBusinessRole(input.role);
      const handoffId = createHandoffId(input.roomId, input.role);
      const existing = await stateStore.load(handoffId);
      if (existing && existing.status !== "left") {
        if (existing.status !== "paused") {
          await updateAiStatus(chatClient, existing, AI_ROLE_STATUS.idle);
        }
        return { handoffId, restored: true, state: existing };
      }

      const member = await chatClient.joinRoom(input);
      const handoff = await chatClient.startHandoffRole(input.roomId, input.role, member.id);
      const timestamp = now();
      const state: HandoffState = {
        version: 1,
        handoffId,
        roomId: input.roomId,
        memberId: member.id,
        displayName: input.displayName,
        role: input.role,
        identity: "ai",
        lastScannedMessageId: null,
        processedMessageIds: [],
        sentClientMessageIds: [],
        pollCount: 0,
        replyCount: 0,
        recentReplyFingerprints: [],
        status: "discussing",
        confirmedRoles: [],
        openQuestions: [],
        pauseReason: null,
        stopReason: null,
        stoppedAt: null,
        lastKnownSessionStatus: handoff.status,
        waitingConfirmationNotified: false,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      await stateStore.save(state);
      await updateAiStatus(chatClient, state, AI_ROLE_STATUS.idle);
      return { handoffId, restored: false, state, handoff };
    },

    async pollMessages(input: { handoffId: string; limit?: number | undefined }) {
      let state = await requireState(stateStore, input.handoffId);
      if (state.status === "paused") {
        return { state, messages: [] };
      }
      state = await refreshCentralStatus(chatClient, stateStore, state, now);
      if (!canContinueDiscussion(state.lastKnownSessionStatus)) {
        return { state, messages: [] };
      }
      await enforceSafetyOrPause({
        action: "poll",
        chatClient,
        stateStore,
        state,
        safety,
        now
      });
      const messages = await chatClient.listMessages(state.roomId, state.lastScannedMessageId ?? undefined, input.limit ?? 50);
      const nextState = touch(
        {
          ...state,
          lastScannedMessageId: messages.at(-1)?.id ?? state.lastScannedMessageId,
          pollCount: state.pollCount + 1
        },
        now
      );
      await stateStore.save(nextState);

      const deliverableMessages = messages.filter((message) => shouldDeliverToHandoff(message, state));
      await updateAiStatus(
        chatClient,
        nextState,
        deliverableMessages.length > 0 ? AI_ROLE_STATUS.busy : AI_ROLE_STATUS.idle
      );

      return {
        state: nextState,
        messages: deliverableMessages
      };
    },

    async sendMessage(input: {
      handoffId: string;
      content: string;
      targetRoles: MessageTarget[];
      replyToMessageIds?: string[] | undefined;
    }) {
      const state = await requireActiveState(stateStore, input.handoffId);
      const targetRoles = normalizeTargetRoles(input.targetRoles);
      const content = input.content.trim();
      const replyToMessageIds = unique(input.replyToMessageIds ?? []);
      const clientMessageId = createClientMessageId("send", state, content, targetRoles, replyToMessageIds);
      if (state.sentClientMessageIds.includes(clientMessageId)) {
        await updateAiStatus(chatClient, state, AI_ROLE_STATUS.idle);
        return { skipped: true, clientMessageId, message: null, state };
      }
      const activeState = await prepareOutgoingState({
        action: "send",
        chatClient,
        stateStore,
        state,
        content,
        targetRoles,
        safety,
        now
      });

      const message = await chatClient.sendMessage({
        roomId: activeState.roomId,
        senderMemberId: activeState.memberId,
        body: content,
        targetRoles,
        clientMessageId
      });
      const replyFingerprint = createReplyFingerprint("send", content, targetRoles);
      const nextState = touch(
        {
          ...activeState,
          processedMessageIds: unique([...activeState.processedMessageIds, ...replyToMessageIds]),
          sentClientMessageIds: unique([...activeState.sentClientMessageIds, clientMessageId]),
          replyCount: activeState.replyCount + 1,
          recentReplyFingerprints: rememberReplyFingerprint(activeState, replyFingerprint, safety)
        },
        now
      );
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.idle);
      return { skipped: false, clientMessageId, message, state: nextState };
    },

    async uploadAttachment(input: {
      handoffId: string;
      filePath: string;
      content?: string | undefined;
      targetRoles: MessageTarget[];
      replyToMessageIds?: string[] | undefined;
    }) {
      const state = await requireActiveState(stateStore, input.handoffId);
      const targetRoles = normalizeTargetRoles(input.targetRoles);
      const content = input.content?.trim() ?? "";
      const replyToMessageIds = unique(input.replyToMessageIds ?? []);
      const clientMessageId = createClientMessageId("upload", state, content, targetRoles, [
        input.filePath,
        ...replyToMessageIds
      ]);
      if (state.sentClientMessageIds.includes(clientMessageId)) {
        await updateAiStatus(chatClient, state, AI_ROLE_STATUS.idle);
        return { skipped: true, clientMessageId, message: null, state };
      }
      const activeState = await prepareOutgoingState({
        action: "upload",
        chatClient,
        stateStore,
        state,
        content: `${content}\n${input.filePath}`,
        targetRoles,
        safety,
        now
      });

      const message = await chatClient.uploadAttachment({
        roomId: activeState.roomId,
        senderMemberId: activeState.memberId,
        body: content,
        targetRoles,
        clientMessageId,
        filePath: input.filePath
      });
      const replyFingerprint = createReplyFingerprint("upload", `${content}\n${input.filePath}`, targetRoles);
      const nextState = touch(
        {
          ...activeState,
          processedMessageIds: unique([...activeState.processedMessageIds, ...replyToMessageIds]),
          sentClientMessageIds: unique([...activeState.sentClientMessageIds, clientMessageId]),
          replyCount: activeState.replyCount + 1,
          recentReplyFingerprints: rememberReplyFingerprint(activeState, replyFingerprint, safety)
        },
        now
      );
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.idle);
      return { skipped: false, clientMessageId, message, state: nextState };
    },

    async leaveRoom(input: { handoffId: string }) {
      const state = await requireState(stateStore, input.handoffId);
      if (state.status !== "left") {
        await chatClient.leaveRoom(state.roomId, state.memberId);
      }
      const nextState = touch({ ...state, status: "left" }, now);
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.offline);
      return { state: nextState };
    },

    async finishHandoff(input: { handoffId: string; summary?: string | undefined }) {
      const state = await requireState(stateStore, input.handoffId);
      if (state.status === "paused") throw new Error("HANDOFF_PAUSED");
      if (state.status === "left") throw new Error("HANDOFF_LEFT");
      const summary = input.summary?.trim();
      const content = summary
        ? `${roleCompletionLabel(state.role)} 已确认对接完成：${summary}`
        : `${roleCompletionLabel(state.role)} 已确认对接完成。`;
      const clientMessageId = createClientMessageId("finish", state, content, [MESSAGE_TARGET_ALL], []);
      if (state.status === "completed" || state.sentClientMessageIds.includes(clientMessageId)) {
        await updateAiStatus(chatClient, state, AI_ROLE_STATUS.idle);
        return { skipped: true, clientMessageId, message: null, state };
      }
      const activeState = await refreshCentralStatus(chatClient, stateStore, state, now);
      assertDiscussionOpen(activeState.lastKnownSessionStatus);
      const handoff = await chatClient.completeHandoffRole(activeState.roomId, activeState.role, activeState.memberId, summary);

      const message = await chatClient.sendMessage({
        roomId: activeState.roomId,
        senderMemberId: activeState.memberId,
        body: content,
        targetRoles: [MESSAGE_TARGET_ALL],
        clientMessageId
      });
      const waitingMessageResult = await maybeSendWaitingConfirmationMessage({
        chatClient,
        state: activeState,
        handoff,
        sentClientMessageIds: [clientMessageId]
      });
      const nextState = touch(
        {
          ...activeState,
          status: "completed",
          confirmedRoles: unique([...activeState.confirmedRoles, activeState.role]),
          pauseReason: null,
          stopReason: null,
          stoppedAt: null,
          lastKnownSessionStatus: handoff.status,
          waitingConfirmationNotified:
            activeState.waitingConfirmationNotified || handoff.status === HANDOFF_SESSION_STATUS.waitingHumanConfirmation,
          sentClientMessageIds: unique([
            ...activeState.sentClientMessageIds,
            clientMessageId,
            ...waitingMessageResult.clientMessageIds
          ])
        },
        now
      );
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.idle);
      return { skipped: false, clientMessageId, message, handoff, state: nextState };
    },

    async pauseHandoff(input: { handoffId: string; reason?: string | undefined }) {
      const state = await requireActiveState(stateStore, input.handoffId);
      const reason = input.reason?.trim();
      const handoff = await chatClient.pauseHandoffRole(state.roomId, state.role, state.memberId, reason);
      const nextState = touch(
        {
          ...state,
          status: "paused",
          pauseReason: reason || null,
          stopReason: null,
          stoppedAt: null,
          lastKnownSessionStatus: handoff.status
        },
        now
      );
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.offline);
      return { state: nextState, handoff };
    },

    async resumeHandoff(input: { handoffId: string }) {
      const state = await requireState(stateStore, input.handoffId);
      if (state.status === "completed") throw new Error("HANDOFF_COMPLETED");
      if (state.status === "left") throw new Error("HANDOFF_LEFT");
      const handoff = await chatClient.resumeHandoffRole(state.roomId, state.role, state.memberId);
      const nextState = touch(
        {
          ...state,
          status: "discussing",
          pauseReason: null,
          stopReason: null,
          stoppedAt: null,
          lastKnownSessionStatus: handoff.status
        },
        now
      );
      await stateStore.save(nextState);
      await updateAiStatus(chatClient, nextState, AI_ROLE_STATUS.idle);
      return { state: nextState, handoff };
    },

    async readHandoffState(input: { handoffId: string }) {
      return { state: await requireState(stateStore, input.handoffId) };
    },

    async readHandoffStatus(input: { handoffId: string }) {
      const state = await requireState(stateStore, input.handoffId);
      const handoff = await chatClient.readHandoffStatus(state.roomId, state.memberId);
      const nextState = touch({ ...state, lastKnownSessionStatus: handoff.status }, now);
      await stateStore.save(nextState);
      return { state: nextState, handoff };
    }
  };
}

async function updateAiStatus(chatClient: ChatApiClient, state: HandoffState, status: AiRoleStatus): Promise<void> {
  await chatClient.updateAiStatus(state.roomId, state.role, state.memberId, status);
}

async function maybeSendWaitingConfirmationMessage(input: {
  chatClient: ChatApiClient;
  state: HandoffState;
  handoff: HandoffSessionDto;
  sentClientMessageIds: string[];
}): Promise<{ clientMessageIds: string[] }> {
  if (input.handoff.status !== HANDOFF_SESSION_STATUS.waitingHumanConfirmation) return { clientMessageIds: [] };
  if (input.state.waitingConfirmationNotified) return { clientMessageIds: [] };

  const content = "所有 AI 已完成对接，等待人工确认。";
  const clientMessageId = createClientMessageId("waiting-confirmation", input.state, content, [MESSAGE_TARGET_ALL], []);
  if (input.state.sentClientMessageIds.includes(clientMessageId) || input.sentClientMessageIds.includes(clientMessageId)) {
    return { clientMessageIds: [clientMessageId] };
  }
  await input.chatClient.sendMessage({
    roomId: input.state.roomId,
    senderMemberId: input.state.memberId,
    body: content,
    targetRoles: [MESSAGE_TARGET_ALL],
    clientMessageId
  });
  return { clientMessageIds: [clientMessageId] };
}

async function refreshCentralStatus(
  chatClient: ChatApiClient,
  stateStore: HandoffStateStore,
  state: HandoffState,
  now: () => string
): Promise<HandoffState> {
  const handoff = await chatClient.readHandoffStatus(state.roomId, state.memberId);
  const nextState = touch({ ...state, lastKnownSessionStatus: handoff.status }, now);
  await stateStore.save(nextState);
  return nextState;
}

async function prepareOutgoingState(input: {
  action: "send" | "upload";
  chatClient: ChatApiClient;
  stateStore: HandoffStateStore;
  state: HandoffState;
  content: string;
  targetRoles: MessageTarget[];
  safety: HandoffSafetyPolicy;
  now: () => string;
}): Promise<HandoffState> {
  const centralState = await refreshCentralStatus(input.chatClient, input.stateStore, input.state, input.now);
  assertDiscussionOpen(centralState.lastKnownSessionStatus);
  await enforceSafetyOrPause({
    action: "reply",
    chatClient: input.chatClient,
    stateStore: input.stateStore,
    state: centralState,
    safety: input.safety,
    now: input.now
  });
  const replyFingerprint = createReplyFingerprint(input.action, input.content, input.targetRoles);
  if (centralState.recentReplyFingerprints.includes(replyFingerprint)) {
    await autoPauseHandoff({
      chatClient: input.chatClient,
      stateStore: input.stateStore,
      state: centralState,
      reason: "DUPLICATE_REPLY_DETECTED",
      now: input.now
    });
  }
  return centralState;
}

async function enforceSafetyOrPause(input: {
  action: "poll" | "reply";
  chatClient: ChatApiClient;
  stateStore: HandoffStateStore;
  state: HandoffState;
  safety: HandoffSafetyPolicy;
  now: () => string;
}): Promise<void> {
  const reason = getSafetyStopReason(input.action, input.state, input.safety, input.now);
  if (!reason) return;
  await autoPauseHandoff({
    chatClient: input.chatClient,
    stateStore: input.stateStore,
    state: input.state,
    reason,
    now: input.now
  });
}

async function autoPauseHandoff(input: {
  chatClient: ChatApiClient;
  stateStore: HandoffStateStore;
  state: HandoffState;
  reason: HandoffStopReason;
  now: () => string;
}): Promise<never> {
  const stoppedAt = input.now();
  const handoff = await input.chatClient.pauseHandoffRole(
    input.state.roomId,
    input.state.role,
    input.state.memberId,
    input.reason
  );
  const nextState: HandoffState = {
    ...input.state,
    status: "paused",
    pauseReason: input.reason,
    stopReason: input.reason,
    stoppedAt,
    lastKnownSessionStatus: handoff.status,
    updatedAt: stoppedAt
  };
  await input.stateStore.save(nextState);
  await updateAiStatus(input.chatClient, nextState, AI_ROLE_STATUS.offline);
  throw new Error("HANDOFF_AUTO_PAUSED");
}

function getSafetyStopReason(
  action: "poll" | "reply",
  state: HandoffState,
  safety: HandoffSafetyPolicy,
  now: () => string
): HandoffStopReason | null {
  const elapsedMs = Date.parse(now()) - Date.parse(state.createdAt);
  if (Number.isFinite(elapsedMs) && elapsedMs > safety.maxDurationMs) return "MAX_DURATION_EXCEEDED";
  if (action === "poll" && state.pollCount >= safety.maxPolls) return "MAX_POLLS_EXCEEDED";
  if (action === "reply" && state.replyCount >= safety.maxReplies) return "MAX_REPLIES_EXCEEDED";
  return null;
}

function assertDiscussionOpen(status: HandoffSessionDto["status"] | null): void {
  if (!canContinueDiscussion(status)) {
    throw new Error("HANDOFF_SESSION_NOT_DISCUSSING");
  }
}

function canContinueDiscussion(status: HandoffSessionDto["status"] | null): boolean {
  return status === null || status === HANDOFF_SESSION_STATUS.discussing;
}

function shouldDeliverToHandoff(message: MessageDto, state: HandoffState): boolean {
  if (message.senderMemberId === state.memberId) return false;
  if (state.processedMessageIds.includes(message.id)) return false;
  return message.targetRoles.includes(state.role) || message.targetRoles.includes(MESSAGE_TARGET_ALL);
}

function createReplyFingerprint(action: "send" | "upload", content: string, targetRoles: MessageTarget[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        action,
        content: content.trim(),
        targetRoles: [...targetRoles].sort()
      })
    )
    .digest("hex")
    .slice(0, 32);
}

function rememberReplyFingerprint(
  state: HandoffState,
  replyFingerprint: string,
  safety: HandoffSafetyPolicy
): string[] {
  return unique([...state.recentReplyFingerprints, replyFingerprint]).slice(-safety.recentReplyWindow);
}

function normalizeTargetRoles(targetRoles: MessageTarget[]): MessageTarget[] {
  const uniqueTargets = unique(targetRoles);
  if (uniqueTargets.length === 0) throw new Error("MESSAGE_TARGET_REQUIRED");
  if (uniqueTargets.includes(MESSAGE_TARGET_ALL)) return [MESSAGE_TARGET_ALL];
  uniqueTargets.forEach((target) => assertBusinessRole(target));
  return uniqueTargets;
}

function createClientMessageId(
  action: string,
  state: HandoffState,
  content: string,
  targetRoles: MessageTarget[],
  relatedIds: string[]
): string {
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        action,
        roomId: state.roomId,
        memberId: state.memberId,
        role: state.role,
        content,
        targetRoles: [...targetRoles].sort(),
        relatedIds: [...relatedIds].sort()
      })
    )
    .digest("hex")
    .slice(0, 32);
  return `mcp_${hash}`;
}

async function requireState(stateStore: HandoffStateStore, handoffId: string): Promise<HandoffState> {
  const state = await stateStore.load(handoffId);
  if (!state) throw new Error("HANDOFF_NOT_FOUND");
  return state;
}

async function requireActiveState(stateStore: HandoffStateStore, handoffId: string): Promise<HandoffState> {
  const state = await requireState(stateStore, handoffId);
  if (state.status === "completed") throw new Error("HANDOFF_COMPLETED");
  if (state.status === "paused") throw new Error("HANDOFF_PAUSED");
  if (state.status === "left") throw new Error("HANDOFF_LEFT");
  return state;
}

function touch<T extends HandoffState>(state: T, now: () => string): T {
  return { ...state, updatedAt: now() };
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function assertBusinessRole(role: string): asserts role is BusinessRole {
  if (!BUSINESS_ROLES.includes(role as BusinessRole)) {
    throw new Error("INVALID_BUSINESS_ROLE");
  }
}

function roleCompletionLabel(role: BusinessRole): string {
  return BUSINESS_ROLE_LABEL[role];
}
