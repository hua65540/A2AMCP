import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BUSINESS_ROLES, MESSAGE_TARGETS } from "../shared/index.js";
import type { HandoffService } from "../handoff/handoffService.js";
import { createMcpToolHandlers } from "./mcpToolHandlers.js";

const RoleSchema = z.enum(BUSINESS_ROLES);
const MessageTargetSchema = z.enum(MESSAGE_TARGETS);

export function createA2aMcpServer(service: HandoffService): McpServer {
  const server = new McpServer({
    name: "a2a-chat-mcp",
    version: "0.1.0"
  });
  registerA2aTools(server, service);
  return server;
}

export function registerA2aTools(server: McpServer, service: HandoffService): void {
  const handlers = createMcpToolHandlers(service);

  server.registerTool(
    "start_handoff",
    {
      title: "Start A2A handoff",
      description: "Join a chatroom as an AI role and create or restore local handoff state.",
      inputSchema: {
        roomId: z.string().trim().min(1),
        displayName: z.string().trim().min(1),
        role: RoleSchema
      }
    },
    async (input) => handlers.start_handoff(input)
  );

  server.registerTool(
    "poll_messages",
    {
      title: "Poll role-targeted messages",
      description: "Fetch new messages for this handoff, returning only @own-role or @all AI messages.",
      inputSchema: {
        handoffId: z.string().trim().min(1),
        limit: z.number().int().positive().max(100).optional()
      }
    },
    async (input) => handlers.poll_messages(input)
  );

  server.registerTool(
    "send_message",
    {
      title: "Send handoff message",
      description: "Send a deduplicated role-targeted chat message through the A2A chatroom API.",
      inputSchema: {
        handoffId: z.string().trim().min(1),
        content: z.string().trim().min(1),
        targetRoles: z.array(MessageTargetSchema).min(1),
        replyToMessageIds: z.array(z.string().trim().min(1)).optional()
      }
    },
    async (input) => handlers.send_message(input)
  );

  server.registerTool(
    "upload_attachment",
    {
      title: "Upload handoff attachment",
      description: "Upload a local file as an attachment message through the A2A chatroom API.",
      inputSchema: {
        handoffId: z.string().trim().min(1),
        filePath: z.string().trim().min(1),
        content: z.string().trim().optional(),
        targetRoles: z.array(MessageTargetSchema).min(1),
        replyToMessageIds: z.array(z.string().trim().min(1)).optional()
      }
    },
    async (input) => handlers.upload_attachment(input)
  );

  server.registerTool(
    "leave_room",
    {
      title: "Leave handoff room",
      description: "Leave the chatroom for this handoff and mark local state as left.",
      inputSchema: {
        handoffId: z.string().trim().min(1)
      }
    },
    async (input) => handlers.leave_room(input)
  );

  server.registerTool(
    "finish_handoff",
    {
      title: "Finish handoff",
      description: "Mark this AI role as completed and send one completion confirmation message.",
      inputSchema: {
        handoffId: z.string().trim().min(1),
        summary: z.string().trim().optional()
      }
    },
    async (input) => handlers.finish_handoff(input)
  );

  server.registerTool(
    "pause_handoff",
    {
      title: "Pause handoff",
      description: "Pause this local AI handoff role without advancing its message cursor.",
      inputSchema: {
        handoffId: z.string().trim().min(1),
        reason: z.string().trim().optional()
      }
    },
    async (input) => handlers.pause_handoff(input)
  );

  server.registerTool(
    "resume_handoff",
    {
      title: "Resume handoff",
      description: "Resume a paused local AI handoff role.",
      inputSchema: {
        handoffId: z.string().trim().min(1)
      }
    },
    async (input) => handlers.resume_handoff(input)
  );

  server.registerTool(
    "read_handoff_state",
    {
      title: "Read handoff state",
      description: "Read the local state file for troubleshooting or manual recovery.",
      inputSchema: {
        handoffId: z.string().trim().min(1)
      }
    },
    async (input) => handlers.read_handoff_state(input)
  );

  server.registerTool(
    "read_handoff_status",
    {
      title: "Read handoff status",
      description: "Read local handoff state together with central room-level handoff status.",
      inputSchema: {
        handoffId: z.string().trim().min(1)
      }
    },
    async (input) => handlers.read_handoff_status(input)
  );
}
