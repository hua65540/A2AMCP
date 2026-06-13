import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileHandoffStateStore } from "../src/state/fileHandoffStateStore.js";
import type { HandoffState } from "../src/state/types.js";

describe("file handoff state store", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = path.join(mkdtempSync(path.join(tmpdir(), "a2a-handoff-")), "missing", "nested");
  });

  afterEach(() => {
    rmSync(path.dirname(path.dirname(stateDir)), { recursive: true, force: true });
  });

  it("creates the state directory and persists a handoff state by handoff id", async () => {
    const store = createFileHandoffStateStore(stateDir);
    const state: HandoffState = {
      version: 1,
      handoffId: "room_1__server",
      roomId: "room_1",
      memberId: "mem_ai",
      displayName: "服务端 AI",
      role: "server",
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
      lastKnownSessionStatus: null,
      waitingConfirmationNotified: false,
      createdAt: "2026-06-13T00:00:00.000Z",
      updatedAt: "2026-06-13T00:00:00.000Z"
    };

    await store.save(state);

    expect(existsSync(stateDir)).toBe(true);
    await expect(store.load("room_1__server")).resolves.toEqual(state);
  });

  it("returns null when no state file exists", async () => {
    const store = createFileHandoffStateStore(stateDir);

    await expect(store.load("missing__server")).resolves.toBeNull();
  });
});
