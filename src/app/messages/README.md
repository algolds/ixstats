# Messages (ThinkShare)

**Last updated:** November 2026

Unified messaging backbone for IxStats. ThinkShare is a sub-system of ThinkPages and serves as the platform-wide messaging surface at `/messages`, consolidating personal DMs, ThinkTank group chats, diplomatic/official conversations, and system alerts into a single inbox backed by one set of `thinkshareConversation` data models.

## Routes and layout

The page is rendered by `MessagesRouter`, which handles unified messaging across direct, diplomatic, community, and system channels. Messages lives under Home in the sidebar, so it wears Home's ink (no `data-app` scope in `layout.tsx`).

| Route | Folder | Purpose |
|---|---|---|
| `/messages` | `conversations` | Direct, diplomatic, wiki and system messages (with pinned System Messages and LoreBot) |
| `/messages/requests` | `requests` | Pending message requests |

The page lives at `src/app/messages/[[...folder]]/page.tsx`. The folder comes from the path, never from state.

**Layout.** `MessagesLayout` is one near-full-width `LensCard` (Facet layer 5 refractive glass over a two-plane monogram backdrop, `content="feed"`, `overflow-clip`, `interactiveMonogram={!hasThread}` so the monogram drifts while browsing the inbox and stills when a thread is open) under Halo's band (`pt-(--shell-top-offset)` in `layout.tsx`, which also holds the page's one `sr-only` `<h1>`). From 1024px the inbox rail (`22rem` at `lg`, `24rem` at `xl`) and the thread sit side by side with a `border-separator` hairline, and selecting a thread never hides the inbox. Below 1024px one pane shows at a time: the inbox until a thread is selected, then the thread with a back button. Height is `100dvh` minus `--shell-top-offset` and `--shell-tabbar-height`, so the page does not scroll and each pane scrolls on its own.

## Address and deep links

The URL is the state (`useMessagesAddress`, `src/lib/messages/deep-links.ts`); the router reads it reactively, so Back, Forward and links from Halo or other pages work.

| Address | Meaning |
|---|---|
| `?conversation=<id>` | The selected thread (canonical). Opening from the inbox pushes a history entry; switching threads replaces it |
| `?id=<id>`, `?conversationId=<id>` | Older links, rewritten to `?conversation=` once |
| `?country=<countryId>` | Open or start the secure (diplomatic) direct message with that nation's owner, then replace the address with `?conversation=` |
| `?user=<handle>` | The same for a passport handle, as a plain direct message |
| `?view=archived` | The archived threads instead of the inbox |

`createConversation` reopens an existing direct thread, so a link never makes a duplicate. A target that cannot be found shows an error and is dropped from the address. `?country=` finds the owner through `messages.searchUsers` by the nation's slug, `?user=` through the same search by exact handle.

## Key Features

| Feature | Detail |
|---------|--------|
| Direct messages | 1:1 `direct` conversations; existing direct convos are de-duplicated on create |
| Group chats | `group` type; a direct convo is auto-upgraded to a group when a participant is added |
| Conversation types | `personal`, `diplomatic`, `official` (with classification, priority, channel type for diplomatic) |
| System broadcasts | Pinned `System Messages` thread for official platform bulletins and simulation updates |
| LoreBot feed | Pinned `LoreBot` official account with gold Crown/Official badge for real-time WikiOS recent changes, user watchlist updates & stash dispatches |
| Storage & auto-pruning | Artificial cap of **1,000 messages** for default users before oldest messages are auto-pruned (admin & premium accounts exempt) |
| Sources | `thinkshare`, `diplomatic`, `wiki`, `forum`, `system` |
| Realtime | Socket.IO live message/typing/presence/read updates with optimistic cache patching |
| Reactions | Add/remove emoji reactions per message |
| Edit / delete | Messages can be edited and deleted in place |
| Replies & mentions | `replyToId` threading and `@mention` arrays on send |
| Attachments | File/image attachments; Stash link attachments via `MessagesStashAttachmentModal` |
| Per-user state | Mute and archive lists are kept on the server (`messages.getConversationPreferences` / `setConversationPreferences`, optimistic in `useMessagePreferences`); sound and name-style settings stay in `localStorage`. The archive button in the inbox header lists archived threads, and a thread's menu unarchives it |
| Pagination | The inbox loads one server page at a time (`useMessagesInbox`, `useInfiniteQuery`) with a Load more row |
| Folder counts | Unread badge counts from the server |

## Architecture

| Component / Hook | Role |
|------------------|------|
| `MessagesRouter` (`src/components/messages/`) | Orchestrator: conversation state, mutations, WebSocket wiring; wrapped in `AuthenticationGuard` |
| `MessagesLayout` | One `LensCard` with the inbox rail and the thread; two panes from 1024px, one below |
| `useMessagesAddress` / `useMessagesDeepLink` / `useMessagesInbox` | URL state, `?country=` and `?user=` resolution, paged conversation list |
| `MessagesFolderNav` | Rail header: unread badge, Requests, Archived, settings; exports `MESSAGE_FOLDERS`, `getFolderFromPathname` |
| `MessagesConversationPanel` / `MessagesConversationCard` | Conversation list, search, selection, and pinned System Messages / LoreBot threads |
| `MessagesChatPanel` / `MessagesChatHeader` / `MessagesBubble` | Active conversation thread, header, message bubbles |
| `LoreBotFeedView` | Rich media read-only stream for LoreBot WikiOS updates, watchlist & stash dispatches |
| `MessagesInputBar` | Composer with Stash attachment hook |
| `MessagesNewConversationModal` / `MessagesAddParticipantsModal` | Create conversation / add participants |
| `MessagesStashAttachmentModal` | Attach a Stash link (fed by `api.wikios.getStashes` / `getStashItems`) |
| `useThinkPagesWebSocket` (`src/hooks/`) | Socket.IO client; presence, typing, message/read events |

**Realtime mechanism:** The client connects via Socket.IO (`socket.io-client`) to path `/ws/thinkpages`. The server side is initialized in `src/lib/websocket/thinkpages-websocket-server.ts` (loaded by `src/server/websocket-server.ts`, production only). Incoming `message:new` / `message:updated` / `message:deleted` events are applied optimistically to the tRPC query cache (`utils.messages.getConversationMessages.setData`), and folder counts/list previews are updated without a full refetch. Typing and presence are emitted/received over the same socket.

The layout (`src/app/messages/layout.tsx`) places the page below Halo, carries the `<h1>`, and the page forces dynamic rendering.

## Data Sources

All messaging data flows through the `api.messages` tRPC router (`src/server/api/routers/messages/`, registered in `root.ts`):

| Procedure | Use |
|-----------|-----|
| `messages.getConversationsByFolder` | List conversations for the active folder |
| `messages.getFolderCounts` | Unread counts per folder |
| `messages.getConversationMessages` | Messages in a conversation |
| `messages.createConversation` | Create direct / group / diplomatic conversation |
| `messages.sendMessage` | Send a message (text/image/file/system, attachments, mentions, reply) |
| `messages.editMessage` / `deleteMessage` | Edit / delete a message |
| `messages.addReaction` / `removeReaction` | Message reactions |
| `messages.addParticipant` / `leaveConversation` | Manage participants |
| `messages.markMessagesAsRead` / `markAllAsRead` | Read receipts |
| `messages.getConversation` | Single conversation detail |
| `messages.sendAdminBroadcast` / `sendAdminMessage` | Admin-only system broadcasts and direct admin messages |
| `messages.resolveRecipient` | The person a `?country=` (nation owner) or `?user=` (Passport handle) link means |
| `messages.searchUsers` | Participant search (`id`, `clerkUserId`, `handle`, `displayName`, `country`); participants are identified by `clerkUserId` |
| `messages.getConversationPreferences` / `setConversationPreferences` | Muted and archived conversation ids |
| `messages.clearAllSystemNotifications` | Clear the system-alerts folder |
| `wikios.getStashes` / `wikios.getStashItems` | Stash attachment picker |

Router source files: `conversations.ts`, `messaging.ts`, `participants.ts`, `index.ts`.

## Connections

- **ThinkPages** — ThinkShare is a sub-system of ThinkPages (see `docs/systems/social.md`); ThinkTank groups live in their own workspace at `/thinktanks` (each group has a linked `ThinkshareConversation`, but there is no `groups` folder in `/messages`).
- **Diplomacy / official messaging** — `diplomatic` and `official` conversation types carry classification (`PUBLIC`…`TOP_SECRET`), priority, and channel type (`BILATERAL`/`MULTILATERAL`/`EMERGENCY`), unifying official channels into the same inbox.
- **Wiki & Forum** — conversations can carry `wiki` / `forum` sources. The messaging service still has a `syncDiscussions` method (`src/server/modules/messaging/`), but its `messages.syncDiscussions` tRPC procedure was removed on 2026-09-27 (plan 312, zero callers), so nothing currently triggers the sync from the UI.
- **Stash** — message composer can attach Stash links from WikiOS.

## Deploy note (2026-11-12 audit fixes)

No columns change. Three indexes were added to `prisma/schema/social.prisma`; on production run them before or after the deploy (they are additive), outside a transaction so `CONCURRENTLY` avoids locking:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ConversationParticipant_userId_isActive_requestStatus_idx" ON "ConversationParticipant"("userId", "isActive", "requestStatus");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThinkshareConversation_source_lastActivity_idx" ON "ThinkshareConversation"("source", "lastActivity");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThinkshareMessage_userId_ixTimeTimestamp_idx" ON "ThinkshareMessage"("userId", "ixTimeTimestamp");
```

Players' muted and archived threads moved from browser storage to the server and are not migrated, so they set them again once.
