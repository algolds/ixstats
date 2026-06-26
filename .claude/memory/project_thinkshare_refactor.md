---
name: ThinkShare Unified Messaging Refactor
description: Complete refactor of ThinkShare from basic DMs into platform-wide unified messaging system across all IxStats subsystems (Phase 1-3 complete, April 2026)
type: project
---

ThinkShare was refactored from a basic 1-on-1 DM system under /thinkpages/thinkshare into the platform-wide unified messaging backbone at /messages.

**Why:** 10 separate messaging subsystems had evolved independently with fragmented identity, no unified inbox, and 5 separate message tables.

**How to apply:** All messaging now goes through /messages. The old /thinkpages/thinkshare redirects. The `messages` tRPC router (router #62) is the canonical API. Old `thinkpages.*` messaging endpoints are backward-compat only.

## Architecture
- **UI**: Discord-style three-column layout (expandable folder rail + conversation list + chat panel) at `/messages`
- **Folders**: Inbox, Personal, Diplomatic, Discussions, Groups, System — server-side classification via `source` field
- **Identity**: Contextual auto-switch via IxnayID (diplomatic=country name, wiki=wikiUsername, forum=forumUsername)
- **Data model**: `source` field on ThinkshareConversation and ThinkshareMessage ("thinkshare"|"thinktank"|"diplomatic"|"wiki"|"forum")
- **ThinktankGroup** has `conversationId` FK linking to ThinkshareConversation
- **Bridge adapters**: `src/server/bridges/wiki-talk-bridge.ts` and `forum-bridge.ts` for bidirectional sync
- **Load tested**: All operations well within targets (folder queries <10ms p95, writes <5ms p95, concurrent <115ms p99)

## Key Files
- Components: `src/components/messages/` (13 files)
- Router: `src/server/api/routers/messages.ts`
- Bridges: `src/server/bridges/wiki-talk-bridge.ts`, `forum-bridge.ts`, `bridge-types.ts`
- Types: `src/types/messages.ts` (extends `src/types/thinkshare.ts`)
- Migration script: `scripts/migrate-messages-to-thinkshare.ts`
- Load test: `scripts/load-testing/test-messaging-load.ts`

## What was deleted
- `src/components/thinkshare/` (16 files) — old UI components
- 3 deprecated diplomatic messaging endpoints from `diplomatic.ts`
- All `/thinkpages/thinkshare` links updated to `/messages` (13 references across 10 files)
