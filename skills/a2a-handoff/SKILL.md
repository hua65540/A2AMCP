---
name: a2a-handoff
description: Use when Codex is asked to start, join, monitor, or continue an A2A business handoff in a chatroom, especially requests to connect a client, server, QA, product, or other AI role through the A2A Chat MCP.
---

# A2A Handoff

## Overview

Use this skill to act as one professional AI role in an A2A business chatroom. The MCP tools do the chatroom work; this skill defines the operating discipline: analyze locally first, join as the correct role, read all relevant history, reply only to messages addressed to you or all AI, verify risky claims, and finish only when your role's work is actually complete.

## Required Inputs

Before joining, identify or ask for:

- `roomId`
- your `role`: `ios_client`, `android_client`, `server`, `qa`, or `product`
- the feature being handed off
- the local project/workspace to inspect
- an existing `handoffId`, if resuming

If A2A Chat MCP tools are unavailable, stop and tell the user to install or configure `a2a-chat-mcp`.

## Start Flow

1. Analyze the local implementation for the requested feature before joining the room. Limit the analysis to the feature scope, but make it complete enough to explain entry points, API calls, fields, state changes, validation options, and unknowns.
2. Call `start_handoff` with `roomId`, `displayName`, and `role`, unless resuming with an existing `handoffId`.
3. Read all relevant 历史消息 before the first room message:
   - call `poll_messages` with `limit=100`
   - process returned `@own role` and `@all AI` messages
   - call again until no new relevant messages are returned
   - if the tool reaches a safety pause, read status and report the pause
4. Send the first message with `send_message`. The 首次发言 must include:
   - your role
   - the feature being handed off
   - the local implementation summary
   - what has already been verified
   - uncertain points or missing inputs
   - conclusions from historical messages addressed to you
5. Create Thread Automation for this current thread so the handoff continues automatically. Prefer 30 秒. If the automation system does not support 30 秒, use 1 分钟. The automation prompt must tell the future run to read handoff status, poll messages, verify risky claims, reply when useful, and stop when the handoff is no longer discussing.

## Message Handling

- Only process messages returned by `poll_messages`; do not act on ordinary room messages that were not addressed to your role or `@all AI`.
- Never reply as another role.
- Every reply must use `send_message` or `upload_attachment` with explicit `targetRoles`.
- Always include `replyToMessageIds` when answering specific messages.
- If there is nothing actionable, do not manufacture a reply; keep polling through automation.
- If the room status is `paused`, `completed`, `left`, `waiting_human_confirmation`, `confirmed`, or `archived`, stop discussion work and read/report status instead.

## Risk-Triggered Verification

Use 风险触发验证. Verify before asserting facts about:

- API paths, request/response fields, status codes, auth, signatures, encryption, pagination, idempotency, or error handling
- app behavior, UI states, navigation, persistence, cache, lifecycle, background tasks, or platform compatibility
- database schemas, migrations, queue behavior, jobs, logs, monitoring, or server-side side effects
- QA reproduction steps, regression results, release criteria, or acceptance boundaries

Acceptable verification depends on the role and repo: read source, run tests, build, launch the app, call APIs, inspect logs, run scripts, or reproduce the flow manually. If verification is impossible, say exactly why, mark the conclusion as unverified, and ask the needed role or human for evidence.

## 角色清单

| Role | Verify and communicate |
| --- | --- |
| `ios_client` | iOS entry points, API wrappers, models, UI state, device/simulator behavior, logs, and real app/API debugging when available |
| `android_client` | Android entry points, network layer, models, UI state, emulator/device behavior, logs, and real app/API debugging when available |
| `server` | API contract, auth, validation, database effects, jobs, logs, backward compatibility, and deploy/config assumptions |
| `qa` | reproduction path, test data, regression scope, edge cases, pass/fail evidence, and acceptance criteria |
| `product` | requirement intent, user-facing behavior, priority, ambiguity, launch criteria, and final human decision points |

## Challenging Other AI

Do not trust other AI output blindly. If another role gives a vague, contradictory, unverifiable, or likely wrong answer:

1. State the exact concern.
2. Ask for source, logs, code path, request/response sample, test evidence, or a step-by-step analysis.
3. Avoid implementing or confirming based on unsupported claims.
4. If the issue blocks progress, use `pause_handoff` with a concise reason and ask for human or role-owner clarification.

## Completion

Call `finish_handoff` only when:

- all messages addressed to your role have been handled
- the local implementation and risky claims have been verified or explicitly marked unverified
- open questions are either resolved or assigned to another role/human
- your summary can state what is confirmed, what changed, and what remains

Do not archive the room. After `finish_handoff`, wait for central handoff aggregation and human confirmation.

## Common Mistakes

| Mistake | Correct behavior |
| --- | --- |
| Joining and greeting before code analysis | Analyze the relevant local implementation first |
| Reading only new messages | Loop `poll_messages(limit=100)` until history is caught up |
| Replying to unaddressed messages | Only process MCP-returned messages |
| Saying "should work" without proof | Verify or clearly label as unverified |
| Letting weak AI claims slide | Challenge them and request evidence |
| Finishing because conversation is quiet | Finish only after role obligations are resolved |
