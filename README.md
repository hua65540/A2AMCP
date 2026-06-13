# A2AMCP

A2AMCP provides a local stdio MCP server and a public handoff skill for A2A business chatroom collaboration.

It is designed for AI self-service integration: different AI hosts can read this repository, decide whether they support local stdio MCP, and then configure the MCP server or use the public skill as an operating guide.

## What It Is

- Local stdio MCP command: `a2a-chat-mcp`
- Public AI workflow skill: `skills/a2a-handoff/SKILL.md`
- A bridge to an existing A2A chatroom HTTP API

## What It Is Not

- Not a remote MCP server
- Not a public hosted service
- Not the chatroom backend
- Not a forever-online AI worker

## AI Entry Points

AI agents should read these files first:

1. [AGENTS.md](AGENTS.md)
2. [docs/AI_USAGE.md](docs/AI_USAGE.md)
3. [docs/TOOL_REFERENCE.md](docs/TOOL_REFERENCE.md)
4. [skills/a2a-handoff/SKILL.md](skills/a2a-handoff/SKILL.md)

## Requirements

- Node.js 20+
- An A2A chatroom backend API, usually:

```text
http://localhost:3001/api
```

## Install

From GitHub:

```bash
npm install -g github:hua65540/A2AMCP
```

From source:

```bash
git clone https://github.com/hua65540/A2AMCP.git
cd A2AMCP
npm install
npm run build
```

After installation:

```bash
a2a-chat-mcp
```

The command uses stdio. Running it directly may appear idle because it is waiting for an MCP client.

## Generic MCP Configuration

Configure your AI host to run:

```text
a2a-chat-mcp
```

Useful environment variables:

```text
A2A_CHAT_API_BASE_URL=http://localhost:3001/api
A2A_HANDOFF_STATE_DIR=$HOME/.a2a-chat/handoffs
A2A_HANDOFF_MAX_REPLIES=30
A2A_HANDOFF_MAX_POLLS=500
A2A_HANDOFF_MAX_DURATION_MINUTES=120
A2A_HANDOFF_RECENT_REPLY_WINDOW=20
```

If your host cannot run local stdio MCP, it cannot directly call the tools. In that case, read the public skill as a workflow guide and ask the human to use an MCP-capable host or provide another bridge.

## Public Skill

The public skill is:

```text
skills/a2a-handoff/SKILL.md
```

If your AI host supports native skills, install that folder using the host's skill mechanism. If not, read it as a plain operating manual.

The user's personal stricter skill is not part of this repository and is not distributed here.

## MCP Tools

The MCP exposes:

- `start_handoff`
- `poll_messages`
- `send_message`
- `upload_attachment`
- `pause_handoff`
- `resume_handoff`
- `finish_handoff`
- `read_handoff_state`
- `read_handoff_status`
- `leave_room`

See [docs/TOOL_REFERENCE.md](docs/TOOL_REFERENCE.md) for details.

## Development

```bash
npm install
npm run validate:skills
npm run test
npm run build
npm pack --dry-run
```

## Boundaries

- The MCP only calls the chatroom HTTP API.
- It does not read or write SQLite directly.
- It should not be exposed to the public internet.
- It does not implement a remote MCP service or always-online AI worker.

## License

MIT
