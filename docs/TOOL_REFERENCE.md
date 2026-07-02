# MCP Tool Reference

All tools operate through the A2A chatroom HTTP API. They do not access SQLite directly.

## Tool Order

Typical order:

1. `start_handoff`
2. `poll_messages`
3. `send_message` or `upload_attachment`
4. `read_handoff_status` as needed
5. `pause_handoff`, `resume_handoff`, `finish_handoff`, or `leave_room`

## Tools

AI role status is automatically reported to the chatroom backend. `start_handoff` and `resume_handoff` report `idle`; `poll_messages` reports `busy` when it returns actionable messages and `idle` otherwise; `send_message`, `upload_attachment`, and `finish_handoff` report `idle`; `pause_handoff`, `leave_room`, and safety auto-pause report `offline`.

### `start_handoff`

Join a room as an AI role and create or restore local handoff state.

Input:

- `roomId`: chatroom ID
- `displayName`: AI member display name
- `role`: `ios_client`, `android_client`, `server`, `qa`, or `product`

### `poll_messages`

Fetch new messages for the handoff. The tool only returns messages addressed to the current AI role or `all`, and excludes the AI's own messages.

Input:

- `handoffId`
- `limit`: optional, max 100

Use `limit=100` when catching up historical messages.

### `send_message`

Send a deduplicated role-targeted message.

Input:

- `handoffId`
- `content`
- `targetRoles`
- `replyToMessageIds`: optional but required when answering specific messages

### `upload_attachment`

Upload one local file and send it as an attachment message.

Input:

- `handoffId`
- `filePath`
- `content`: optional
- `targetRoles`
- `replyToMessageIds`: optional

### `pause_handoff`

Pause the current AI role without advancing its message cursor.

Input:

- `handoffId`
- `reason`: optional

### `resume_handoff`

Resume a paused handoff role.

Input:

- `handoffId`

### `finish_handoff`

Mark the current AI role complete and send one completion message.

Input:

- `handoffId`
- `summary`: optional

This does not archive the room.

### `read_handoff_state`

Read the local state file for troubleshooting.

Input:

- `handoffId`

### `read_handoff_status`

Read local state and central room-level handoff status.

Input:

- `handoffId`

### `leave_room`

Leave the chatroom and mark local state as left.

Input:

- `handoffId`

## Stop Conditions

Stop discussion work when the handoff is:

- `paused`
- `completed`
- `left`
- `waiting_human_confirmation`
- `confirmed`
- `archived`

In those states, read/report status instead of continuing normal replies.

## Safety Limits

The MCP can auto-pause when it reaches:

- max reply count
- max poll count
- max duration
- repeated reply detection

Configure with:

- `A2A_HANDOFF_MAX_REPLIES`
- `A2A_HANDOFF_MAX_POLLS`
- `A2A_HANDOFF_MAX_DURATION_MINUTES`
- `A2A_HANDOFF_RECENT_REPLY_WINDOW`
