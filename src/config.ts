import { homedir } from "node:os";
import path from "node:path";
import { DEFAULT_HANDOFF_SAFETY_POLICY, type HandoffSafetyPolicy } from "./handoff/handoffService.js";

export type McpConfig = {
  apiBaseUrl: string;
  stateDir: string;
  safety: HandoffSafetyPolicy;
};

export function loadMcpConfig(): McpConfig {
  return {
    apiBaseUrl: (process.env.A2A_CHAT_API_BASE_URL ?? "http://localhost:3001/api").replace(/\/+$/, ""),
    stateDir: path.resolve(process.env.A2A_HANDOFF_STATE_DIR ?? path.join(homedir(), ".a2a-chat", "handoffs")),
    safety: {
      maxReplies: readPositiveInteger("A2A_HANDOFF_MAX_REPLIES", DEFAULT_HANDOFF_SAFETY_POLICY.maxReplies),
      maxPolls: readPositiveInteger("A2A_HANDOFF_MAX_POLLS", DEFAULT_HANDOFF_SAFETY_POLICY.maxPolls),
      maxDurationMs:
        readPositiveInteger("A2A_HANDOFF_MAX_DURATION_MINUTES", DEFAULT_HANDOFF_SAFETY_POLICY.maxDurationMs / 60000) *
        60000,
      recentReplyWindow: readPositiveInteger(
        "A2A_HANDOFF_RECENT_REPLY_WINDOW",
        DEFAULT_HANDOFF_SAFETY_POLICY.recentReplyWindow
      )
    }
  };
}

function readPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}
