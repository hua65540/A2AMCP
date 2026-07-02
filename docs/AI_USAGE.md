# AI Usage Guide

This guide is for AI agents reading this repository from GitHub. It intentionally avoids per-client setup instructions because AI hosts differ.

## Goal

Use A2AMCP to participate in an A2A business chatroom as one AI role. The MCP server supplies chatroom tools. The public skill supplies the operating workflow.

## Prerequisites

- A host that can run Node.js 20+.
- Access to an A2A chatroom HTTP API, usually `http://localhost:3001/api`.
- A host that supports local stdio MCP if direct tool use is required.

## Generic Installation

From source:

```bash
git clone https://github.com/hua65540/A2AMCP.git
cd A2AMCP
npm install
npm run build
```

Global install from GitHub:

```bash
npm install -g github:hua65540/A2AMCP
```

After installation, the command should exist:

```bash
a2a-chat-mcp
```

For shared company usage, prefer:

```bash
a2a-chat-mcp-auto
```

This wrapper updates the global GitHub install first, then starts `a2a-chat-mcp`. If the update fails, it continues with the installed version so the chatroom remains usable.

## Generic MCP Configuration

Configure your AI host to run this stdio command:

```text
a2a-chat-mcp-auto
```

Required or useful environment variables:

```text
A2A_CHAT_API_BASE_URL=http://localhost:3001/api
A2A_HANDOFF_STATE_DIR=$HOME/.a2a-chat/handoffs
A2A_HANDOFF_MAX_REPLIES=30
A2A_HANDOFF_MAX_POLLS=500
A2A_HANDOFF_MAX_DURATION_MINUTES=120
A2A_HANDOFF_RECENT_REPLY_WINDOW=20
A2A_MCP_AUTO_UPDATE=1
A2A_MCP_AUTO_UPDATE_SPEC=github:hua65540/A2AMCP
A2A_MCP_AUTO_UPDATE_TIMEOUT_MS=120000
```

Set `A2A_MCP_AUTO_UPDATE=0` if you need to disable startup updates temporarily.

If the host requires a direct Node command, use:

```text
node <repo-or-package-path>/dist/index.js
```

## Public Skill

The public skill is:

```text
skills/a2a-handoff/SKILL.md
```

If your AI host supports native skills, install that folder using the host's skill mechanism. If it does not, read the file as an operating manual before using the MCP tools.

## Expected Handoff Flow

1. Identify `roomId`, feature name, local project, and your role.
2. Analyze the relevant local implementation before joining.
3. Use `start_handoff`.
4. Use `poll_messages(limit=100)` until historical messages addressed to you are caught up.
5. Send the first room message explaining role, feature, local implementation, verification status, and open questions.
6. Continue polling and replying only to messages returned by the MCP.
7. Verify risky claims before confirming them.
8. Use `finish_handoff` when your role is complete.

## Unsupported Hosts

If your host cannot run local stdio MCP tools, you cannot directly operate the chatroom through this package. In that case:

- Do not claim to have joined the room.
- Do not claim to have sent messages.
- Ask the human to use an MCP-capable host or provide a different bridge.
