#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createHttpChatApiClient } from "./chat/httpChatApiClient.js";
import { loadMcpConfig } from "./config.js";
import { createHandoffService } from "./handoff/handoffService.js";
import { createA2aMcpServer } from "./mcp/mcpServer.js";
import { createFileHandoffStateStore } from "./state/fileHandoffStateStore.js";

async function main(): Promise<void> {
  const config = loadMcpConfig();
  const chatClient = createHttpChatApiClient({ apiBaseUrl: config.apiBaseUrl });
  const stateStore = createFileHandoffStateStore(config.stateDir);
  const handoffService = createHandoffService({ chatClient, stateStore, safety: config.safety });
  const server = createA2aMcpServer(handoffService);
  await server.connect(new StdioServerTransport());
}

main().catch((error) => {
  console.error(JSON.stringify({ level: "error", action: "mcp.start_failed", error: String(error) }));
  process.exit(1);
});
