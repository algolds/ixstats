# ThinkPages Social & Collaboration System

**Last updated:** August 2026  
**Status:** Production Ready (Beta) — ThinkPages v2  
**Hierarchy:** Core Feature System (`THINKPAGES_VERSION = 2` in Version Registry). ThinkShare (messaging) is an integrated sub-system.

ThinkPages is the collaborative storytelling, social feed, and communication backbone of IxStates. It provides activity feeds, ThinkTank research groups, post authoring, polling, and the **ThinkShare** unified messaging platform.

---

## Architecture & Versioning

ThinkPages v2 introduces full component modularization, domain sub-component suites, and centralized caching primitives.

### UI Surfaces
- `src/app/thinkpages/page.tsx` – Main exploration feed and post creation stream
- `src/app/thinktanks/page.tsx` – ThinkTanks collaborative groups and research hub
- `src/app/messages/page.tsx` – ThinkShare unified messaging hub
- `src/components/thinktanks/` – Dual-column Apple workspace, 2-pillar group tabs (Feed, Members) with Media Repository branding
- `src/components/thinkpages/` – Feed cards, authoring composers, hashtag explorers, and reaction trays
- `src/components/thinkshare/` – Threaded messaging, encryption indicators, and classification badges
- `src/components/polls/` – Interactive national polling widgets

### Backend Routers
- `src/server/api/routers/thinkpages/` (`index.ts`, `feed.ts`, `posts.ts`, `comments.ts`, `reactions.ts`, `thinktanks/`) – Core social and group CRUD
- `src/server/api/routers/messages/` – ThinkShare messaging, conversations, and threads
- `src/server/api/routers/activities/` (`index.ts`, `feed.ts`, `metrics.ts`) – Global activity log
- `src/server/api/routers/polls/` – Polling creation, voting, and real-time result tallying

---

## ThinkShare Unified Messaging

All messaging across the platform (personal DMs, diplomatic exchanges, official channels) runs on the unified ThinkShare infrastructure:
- **Channels**: Personal 1:1 DMs, Diplomatic cables, Community discussions, pinned **System Messages**, and pinned **LoreBot** knowledge stream.
- **Classification Levels**: `PUBLIC`, `RESTRICTED`, `CONFIDENTIAL`, `SECRET`, `TOP_SECRET`
- **Priority Tiers**: `LOW`, `NORMAL`, `HIGH`, `URGENT`, `CRITICAL`
- **Message Retention & Pruning**: Default users have an artificial capacity of **1,000 messages** before oldest messages are auto-pruned. Admins, system owners, and premium tiers are exempt.
- **Security**: Digital signatures (`signature`), end-to-end encryption (`encryptedContent`), and audit logging.

---

## Caching Performance (`globalCache`)

- **Feed Retrieval**: Served via `globalCache` in **~1.4ms** (compared to ~2,350ms raw DB query time).
- **Targeted Cache Invalidation**: Creating a new post or reaction triggers pattern invalidation (`thinkpages_feed:*`), guaranteeing immediate visibility on subsequent queries.

---

## Related Documentation

- [ThinkTanks Collaborative Groups Guide](./thinktanks.md)
- [Diplomacy System Guide](./diplomacy.md)
- [Forum Integration](./forum.md)
- [API Reference: ThinkPages & Messages](../reference/api-complete.md#thinkpages-router)
