# Messages (ThinkShare)

**Last updated:** June 2026

Unified messaging backbone for IxStats. ThinkShare is a sub-system of ThinkPages and serves as the platform-wide messaging surface at `/messages`, consolidating personal DMs, ThinkTank group chats, diplomatic/official conversations, and system alerts into a single inbox backed by one set of `thinkshareConversation` data models.

## Routes

The page is rendered by `MessagesRouter`, which handles unified messaging across direct, diplomatic, community, and system channels.

| Route | Folder | Purpose |
|---|---|---|
| `/messages` | `conversations` | All direct, diplomatic, wiki & system messages (with pinned System Messages & LoreBot WikiOS feed) |

A `?conversation=<id>` query param deep-links a specific conversation (consumed then cleared from the URL). ThinkTank group collaboration is now hosted in its own dedicated workspace at `/thinktanks`.

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
| Per-user state | Mute and archive lists, plus message settings, persisted in `localStorage` |
| Folder counts | Unread badge counts from the server |

## Architecture

| Component / Hook | Role |
|------------------|------|
| `MessagesRouter` (`src/components/messages/`) | Orchestrator: conversation state, mutations, WebSocket wiring; wrapped in `AuthenticationGuard` |
| `MessagesLayout` | Two-pane (conversation list + chat) shell; collapses list when a conversation is open |
| `MessagesFolderNav` | Header bar + settings; exports `MESSAGE_FOLDERS`, `getFolderFromPathname` |
| `MessagesConversationPanel` / `MessagesConversationCard` | Conversation list, search, selection, channel filters (All, Diplomatic, Direct, Community) |
| `MessagesChatPanel` / `MessagesChatHeader` / `MessagesBubble` | Active conversation thread, header, message bubbles |
| `LoreBotFeedView` | Rich media read-only stream for LoreBot WikiOS updates, watchlist & stash dispatches |
| `MessagesInputBar` | Composer with Stash attachment hook |
| `MessagesNewConversationModal` / `MessagesAddParticipantsModal` | Create conversation / add participants |
| `MessagesStashAttachmentModal` | Attach a Stash link (fed by `api.wikios.getStashes` / `getStashItems`) |
| `useThinkPagesWebSocket` (`src/hooks/`) | Socket.IO client; presence, typing, message/read events |

**Realtime mechanism:** The client connects via Socket.IO (`socket.io-client`) to path `/ws/thinkpages`. The server side is initialized in `src/lib/websocket/thinkpages-websocket-server.ts` (loaded by `src/server/websocket-server.ts`, production only). Incoming `message:new` / `message:updated` / `message:deleted` events are applied optimistically to the tRPC query cache (`utils.messages.getConversationMessages.setData`), and folder counts/list previews are updated without a full refetch. Typing and presence are emitted/received over the same socket.

The layout (`src/app/messages/layout.tsx`) wraps content in `DashboardSidebarLayout` and forces dynamic rendering.

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
| `messages.markMessagesAsRead` | Read receipts |
| `messages.searchUsers` | Participant search for new conversations |
| `messages.clearAllSystemNotifications` | Clear the system-alerts folder |
| `messages.syncDiscussions` | Pull wiki talk-page + forum discussions into the inbox |
| `wikios.getStashes` / `wikios.getStashItems` | Stash attachment picker |

Router source files: `conversations.ts`, `messaging.ts`, `participants.ts`, `index.ts`.

## Connections

- **ThinkPages** — ThinkShare is a sub-system of ThinkPages (see `docs/systems/social.md`); ThinkTank groups appear in the `groups` folder.
- **Diplomacy / official messaging** — `diplomatic` and `official` conversation types carry classification (`PUBLIC`…`TOP_SECRET`), priority, and channel type (`BILATERAL`/`MULTILATERAL`/`EMERGENCY`), unifying official channels into the same inbox.
- **Wiki & Forum** — `syncDiscussions` bridges wiki talk pages and forum threads into conversations (`wiki` / `forum` sources).
- **Stash** — message composer can attach Stash links from WikiOS.
