import { homedir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadMcpConfig } from "../src/config.js";

describe("MCP config", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses local chat API and home handoff directory by default", () => {
    delete process.env.A2A_CHAT_API_BASE_URL;
    delete process.env.A2A_HANDOFF_STATE_DIR;

    expect(loadMcpConfig()).toEqual({
      apiBaseUrl: "http://localhost:3001/api",
      stateDir: path.join(homedir(), ".a2a-chat", "handoffs"),
      safety: {
        maxReplies: 30,
        maxPolls: 500,
        maxDurationMs: 2 * 60 * 60 * 1000,
        recentReplyWindow: 20
      }
    });
  });

  it("allows overriding chat API and handoff state directory", () => {
    process.env.A2A_CHAT_API_BASE_URL = "http://chat.test/api/";
    process.env.A2A_HANDOFF_STATE_DIR = "/tmp/a2a-custom-handoffs";
    process.env.A2A_HANDOFF_MAX_REPLIES = "7";
    process.env.A2A_HANDOFF_MAX_POLLS = "88";
    process.env.A2A_HANDOFF_MAX_DURATION_MINUTES = "45";
    process.env.A2A_HANDOFF_RECENT_REPLY_WINDOW = "5";

    expect(loadMcpConfig()).toEqual({
      apiBaseUrl: "http://chat.test/api",
      stateDir: "/tmp/a2a-custom-handoffs",
      safety: {
        maxReplies: 7,
        maxPolls: 88,
        maxDurationMs: 45 * 60 * 1000,
        recentReplyWindow: 5
      }
    });
  });

  it("rejects invalid safety limits", () => {
    process.env.A2A_HANDOFF_MAX_REPLIES = "0";

    expect(() => loadMcpConfig()).toThrow("A2A_HANDOFF_MAX_REPLIES");
  });
});
