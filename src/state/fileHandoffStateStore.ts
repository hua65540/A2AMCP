import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { stateFileNameForHandoff } from "./handoffIds.js";
import type { HandoffState, HandoffStateStore } from "./types.js";

export function createFileHandoffStateStore(stateDir: string): HandoffStateStore {
  const root = path.resolve(stateDir);

  return {
    async load(handoffId: string): Promise<HandoffState | null> {
      try {
        const raw = await readFile(statePath(root, handoffId), "utf8");
        return normalizeState(JSON.parse(raw) as HandoffState);
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return null;
        throw error;
      }
    },

    async save(state: HandoffState): Promise<void> {
      await mkdir(root, { recursive: true });
      await writeFile(statePath(root, state.handoffId), `${JSON.stringify(state, null, 2)}\n`, "utf8");
    }
  };
}

function normalizeState(state: HandoffState): HandoffState {
  return {
    ...state,
    pollCount: state.pollCount ?? 0,
    replyCount: state.replyCount ?? 0,
    recentReplyFingerprints: state.recentReplyFingerprints ?? [],
    pauseReason: state.pauseReason ?? null,
    stopReason: state.stopReason ?? null,
    stoppedAt: state.stoppedAt ?? null,
    lastKnownSessionStatus: state.lastKnownSessionStatus ?? null,
    waitingConfirmationNotified: state.waitingConfirmationNotified ?? false
  };
}

function statePath(root: string, handoffId: string): string {
  const resolved = path.resolve(root, stateFileNameForHandoff(handoffId));
  if (!resolved.startsWith(root)) {
    throw new Error("INVALID_HANDOFF_ID");
  }
  return resolved;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
