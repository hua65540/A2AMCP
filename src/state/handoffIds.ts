import type { BusinessRole } from "../shared/index.js";

export function createHandoffId(roomId: string, role: BusinessRole): string {
  return `${roomId}__${role}`;
}

export function stateFileNameForHandoff(handoffId: string): string {
  return `${handoffId.replace(/[^a-zA-Z0-9_.-]/g, "_")}.json`;
}
