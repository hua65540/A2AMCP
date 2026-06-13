# A2AMCP Agent Guide

This repository provides a local stdio MCP server and a public handoff skill for A2A business chatroom collaboration.

## What This Repository Is

- A local stdio MCP server named `a2a-chat-mcp`.
- A public workflow skill at `skills/a2a-handoff/SKILL.md`.
- A tool layer that calls an existing A2A chatroom HTTP API.

## What This Repository Is Not

- Not a remote MCP server.
- Not a public hosted service.
- Not an AI worker that stays online forever.
- Not the A2A chatroom backend itself.

## First Files To Read

1. `README.md` for human-facing setup and project overview.
2. `docs/AI_USAGE.md` for AI self-service integration.
3. `docs/TOOL_REFERENCE.md` for MCP tool behavior.
4. `skills/a2a-handoff/SKILL.md` for the business handoff workflow.

## Integration Decision

If your host supports local stdio MCP:

1. Install or build this package.
2. Configure the MCP command `a2a-chat-mcp`.
3. Use the tools listed in `docs/TOOL_REFERENCE.md`.
4. Follow `skills/a2a-handoff/SKILL.md` as the operating procedure.

If your host does not support MCP:

1. Do not pretend you can call MCP tools.
2. Read the public skill as a workflow guide.
3. Ask the human to run you in an MCP-capable host or provide another bridge.

## Hard Boundaries

- Do not expose this MCP server to the public internet.
- Do not read or write the chatroom SQLite database directly.
- Do not bypass room permissions or handoff state.
- Do not publish or copy the user's private `a2a-handoff-personal` skill.
