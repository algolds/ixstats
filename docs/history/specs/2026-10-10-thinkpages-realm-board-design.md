# ThinkPages forum, sub-project 2: realm landing and live realm board

**Date:** 2026-10-10
**Status:** Approved design (owner, 2026-10-10). Execution in stages.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md). **Builds on:** [foundation](2026-10-09-thinkpages-forum-foundation-design.md) (merged into rose-garden).
**Branch:** `feat/realm-board` (worktree `ixstats-forum-ui`), from rose-garden `0a2112689`.

## Owner decisions

- The realm page is its live board (RMB) front and centre, with its boards in the rail.
- Old Realm Board chats (ThinkTank group chats) are imported as the board's history.
- Realms get an emblem field (`Realm.emblemUrl`), set in the Realms app; falls back to the thumbnail, then a realm icon.
- Board messages are forum posts in one board thread per realm, so moderation, reports, bans, the mod log, persona rules and action links apply unchanged.
- Fully live: messages arrive in real time, typing indicators; polling fallback when the socket is down.

## 1. Data and structure

- **Board category and thread.** Each realm gets a category with key `board` and `style = "board"`, holding exactly one thread (the board thread). Seeded by `seedRealmCategories` for new realms and backfilled for existing realms by the migration (idempotent). `isBoardCategory(category)` (pure, `src/lib/thinkpages-forum/categories.ts`) is the single rule every list, count, stat, Trending, activity-feed, passport and search read uses to leave the board out.
- **Board messages are ForumPosts** in the board thread: light-composer HTML (no Canvas wikitext), soft cap 1,000 characters of plain text (server enforced), `replyToPostId` (nullable, same thread, not hidden) shown as a quoted reference, no nesting.
- **Continue in a thread.** The author or a realm moderator turns a message into a new Hub thread: the message moves (becomes the new thread's first post) and the board keeps a link line via `continuedThreadId` on a small placeholder post. Logged in the mod log when a moderator does it.
- **Realm columns.** `emblemUrl` (nullable), `boardVisitorsAllowed` (default true), `boardSlowModeSeconds` (default 0). Officers with the `board` power (and founders, admins) change the board settings; the `appearance` power sets the emblem.
- **Who posts.** Members (owners of a nation in the realm) as in the realm's other boards. Visitors (signed-in owners of a nation elsewhere, or none) may post on the board only, while `boardVisitorsAllowed`; their messages carry "Visitor · <their realm>". Forum bans apply. Archived realms are read-only.
- **Edit.** The author may edit a board message within 15 minutes; moderators use the existing moderator edit.
- **Routes.** `/thinkpages/r/<realm>` becomes the realm landing (was a redirect to the Hub). `/thinkpages/r/mine` points at it. The sidebar "Your realm" shows the realm emblem.

## 2. Live delivery

- **Room.** New public room kind `realm-board:<realmId>` on the existing Socket.IO server (`src/lib/websocket/thinkpages-websocket-server.ts`, auth in `socket-auth.ts`). Join check: the realm is visible to the viewer (`canSeeRealm`), signed in or not. Existing member-gated rooms unchanged.
- **Signed-out readers** connect without a token, read only: they may join public realm rooms only and cannot emit typing.
- **Events** (added to the zod schema in `src/server/thinkpages-broadcast-bridge.ts`): `board:message` (new message: sanitized HTML, persona-safe author data, the post id), `board:updated` (hidden, unhidden, edited, continued; a hide is a removal for non-moderators), `board:typing` (realm, display name, persona-safe). Mutations publish through `getThinkPagesBroadcaster()` so delivery works in-process or via `ixstats-ws` + Redis.
- **Persona rule on the wire.** Payloads carry the same persona-safe author data as the page; hidden messages are never broadcast to non-moderators.
- **Typing.** At most one event per second per user per room (server throttle); clients expire entries after 5 seconds.
- **Presence.** "N online" and the Online now panel count distinct users in the room (server tracks per room); hidden when the socket is down.
- **Client.** `useRealmBoardLive(realmId)` on the existing ThinkPages socket client: subscribes, merges events into the React Query cache. New messages slide in at the top; when the reader has scrolled away from the top the list holds still and shows "Jump to newest".
- **Fallback.** Socket not connected (dev by default, blocked network, `ixstats-ws` down): poll every 10 seconds and show "Live updates paused, retrying". Dev keeps sockets off unless `NEXT_PUBLIC_ENABLE_WEBSOCKET=true` with `server.mjs`.
- **Slow mode.** When `boardSlowModeSeconds > 0`, members post at most once per that many seconds (the existing rate limiter's namespaced check `rmb:<realmId>`); moderators exempt; the refusal carries the remaining seconds.

## 3. Realm landing page

- `ForumPage` shell. Header: realm emblem and name; facts "N members · N online · You're a member" or "Visitor"; "Other realms" picker in the actions.
- **Composer** (light editor, the Home `GlassPlateEditor`): Attach action, Image, "Posting as … · Switch" (personas allowed), "0 / 1,000" counter, Post; slow-mode countdown; replaced by the reason when the viewer cannot post (visitors off, banned, sign in, archived).
- **Feed**: one pane, divider-separated, newest first. Message: 36px avatar, handle and flag (persona-safe), Officer/Staff pill, "Visitor · <realm>" pill, relative time; body; "Replying to X: …" reference; "Continued in a thread: <title> · N replies" line; actions Reply, Quote, "⋯" (Continue in a thread, Report, Edit within 15 minutes, moderator tools). Typing line in the pane header. "Load earlier messages" pages back 50 at a time.
- **Rail**: Boards (Hub, Character Threads, Current Events: latest thread and age), Online now (chips with flags), Recent actions in <realm> (existing activity feed read), Board settings for officers with the board power (visitors toggle, slow mode Off/10s/30s/1m/5m).
- **Phone**: composer docked above the tab bar; boards as a chip row under the header (Facet exception 2); other rail panels in the Info sheet.
- **Elsewhere**: the Realms app realm page gains "Board" and "Forums" links and the emblem upload in appearance settings (image repository); sidebar "Your realm" uses the emblem.

## 4. History import, errors, testing

- **Import** (`scripts/migrations/import-realm-board-history.ts`, planner in `*-plan.ts`): each realm's `RealmBoard` → `ThinktankGroup` → `ThinktankMessage` → board posts, oldest first, original author (Clerk id → User; unknown authors keep their name as `importedAuthorName`), original time, `sanitizeUserContent`. Deleted messages skipped. Idempotent via `sourceRef = "realm_board_message:<id>"`. Dry run by default, `--apply`, refuses production. Run by Claude on the clone only.
- **Errors**: live down → polling + notice; slow mode → "You can post again in 23s" (server enforced); over 1,000 characters → "Board messages are at most 1,000 characters. Continue in a thread for longer posts."; visitors off / banned → composer replaced by the reason; empty board → "Start the conversation"; hidden or archived realm → as today.
- **Testing**: seeding and backfill idempotent; `isBoardCategory` excluded from every read (one test per place); posting access matrix (member, visitor, visitors off, slow mode, ban, moderator, archived); length cap, reply-to validation, continue in a thread (move, link, permissions, mod log); persona-safe payloads, hidden never broadcast; socket public room join (signed-out allowed, draft refused); typing throttle; import planner; client live hook, polling fallback, newest-first insertion holding position; message item variants; slow-mode countdown; phone docked composer and chips; architecture ratchets green; signed-in browser check with two sessions (member and visitor see each other's messages live, typing, slow mode, continue, imported history, phone).

## Stages

1. Data: migration, schema, board seeding and backfill, `isBoardCategory` exclusions.
2. Board reads and writes (module + router).
3. Live delivery (socket room, events, typing, presence) and the client hook.
4. History import.
5. Landing page and composer.
6. Rail, board settings, phone.
7. Realms app emblem and links; sidebar.
8. Gates and browser check.
