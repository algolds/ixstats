# ThinkPages forum, sub-project 3: unread, watch, notifications and @mentions

**Date:** 2026-10-10
**Status:** Approved for execution (owner, 2026-10-10: "work on projects 3-7 now"). Decisions not settled by the concept are controller rulings, marked *Ruling*.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md). **Builds on:** foundation and realm board (merged into rose-garden `1e87e28b7`).
**Branch:** `feat/forum-unread` (worktree `ixstats-forum-ui`).

## Owner decisions in force

- In scope: unread and watch, notifications in the IxStates bell, and @mentions. Forum search stays out.
- The sidebar gains New posts, Watched and Stashed under ThinkPages. Pages carry no in-page tab bars.
- Board tables show unread threads in bold, and the Forums home "Your realm" card shows an unread count.
- Persona rule: a persona post never reveals its player. This covers notifications, mention links and every read added here.

## 1. Data (hand-written idempotent migration `20261015120000_thinkpages_forum_engagement`)

- **`ForumThreadRead`**
  - Fields: `userId` (User.id), `threadId`, `readAt` (the `lastPostAt` the user has seen up to). Unique `[userId, threadId]`. Index `[threadId]`.
  - A thread is unread for a signed-in user when `thread.lastPostAt > max(read.readAt, reader.allReadAt, now - 30 days)`.
  - *Ruling:* threads older than 30 days never count as unread (XenForo's read-marking cutoff), so the table stays bounded and new users don't see the whole archive as unread.
- **`ForumReader`**
  - Fields: `userId` (primary key), `allReadAt`.
  - "Mark all read" sets `allReadAt`. "Mark board read" upserts `ForumThreadRead` for that board's threads that are unread within the 30-day window.
- **`ForumThreadWatch`**
  - Fields: `userId`, `threadId`, `createdAt`, `notifiedAt` (nullable). Unique `[userId, threadId]`. Index `[threadId]`.
  - *Ruling:* starting a thread or replying in one watches it automatically, as in XenForo. Unwatch is one click.
- **`ForumPostMention`**
  - Fields: `postId`, `userId` (the recipient's User.id), `createdAt`. Unique `[postId, userId]`.
  - It exists for dedupe: editing a post notifies only the mentions it adds.
- Reads and writes go through Prisma. The board thread, which `isBoardCategory` covers, is excluded from New posts and Watched. Its read-state is kept only for the Your realm count (section 3).

## 2. Read-state

- **Recording.** Opening a thread page records `readAt = max(existing, lastPostAt of the newest post on the page shown)`, through a `markThreadRead` mutation fired by the page. A write on every GET query is not allowed.
  - Reading a thread also clears `notifiedAt` on the user's watch, so the next reply notifies again.
  - The board records read-state the same way when the realm landing is open and scrolled to the top.
- **Jump to unread.** The `/thinkpages/t/<id>/unread` route resolves to the first post after `readAt`, through the existing post-location resolver, or to the last post.
  - Unread rows in board tables and New posts link there.
- **Viewer fields.**
  - The board table, Forums home and thread reads gain `unread: boolean` per thread and `unreadThreads: number` per category row, for signed-in viewers only.
  - Each is computed in one grouped query per page; there are no N+1 reads.
  - Signed-out viewers get `false` and 0.

## 3. Navigation and pages

- **Sidebar (ThinkPages section).** It now holds Forums, Your realm, New posts, Watched, Stashed and Moderation.
  - New posts, Watched and Stashed require sign-in. They use the existing `requires` gating with a new `"signed-in"` requirement if one doesn't exist.
  - New badge keys:
    - `forum-watched-unread`: a count of unread watched threads, capped at "99+".
    - `forum-realm-board`: new board messages since the viewer last read the board, a dot or count on Your realm.
  - Both poll every 60 seconds through one `thinkpagesForum.navCounts` query.
- **Pages.** All use the `ForumPage` shell and the existing ThreadTable rows.
  - **New posts** (`/thinkpages/new`): unread threads across the boards the viewer can see, within 30 days, newest first, 25 per page with windowed pagination. A "Mark all read" action sits in the header actions.
  - **Watched** (`/thinkpages/watched`): watched threads, unread first then by last post, each row with an Unwatch control.
  - **Stashed** (`/thinkpages/stashed`): the existing `stashedThreads` read, each row with an Unstash control.
  - Empty states use the standard empty pattern (tinted icon plus one line). Signed-out visitors are redirected to sign-in.
- **Thread page.**
  - The header actions gain Watch / Watching as a toggle Button, next to Stash.
  - The rail shows "You're watching this thread" with an Unwatch link.
- **Board page.** Unread rows are bold and carry a tinted unread dot, as the foundation spec requires. A "Mark board read" action appears for signed-in viewers.
- **Forums home.** Category rows with unread threads show the count in tint. The Your realm card shows "N new on the board" from the badge read.

## 4. Notifications (the IxStates bell)

All notifications are created with `notificationAPI.create` or `createMany`:
- category `"social"`;
- source `"thinkpages-forum"` (the existing guard key, so admins can switch the whole forum off);
- href set to `postHref(postId)` (a plain path; `create` applies the base path).

They are created after the write commits. Failures are caught and logged, and never fail the post.

| Event | Recipient | Title | Rule |
| --- | --- | --- | --- |
| Reply in a watched thread | Each watcher except the author | "New reply in <thread title>" | Once until visited: claim rows where `notifiedAt IS NULL` with `updateMany`, then `createMany` for the rows claimed (the WikiOS watchlist pattern) |
| @mention in a thread post or board message | The mentioned user | "<author name> mentioned you in <thread title or realm board>" | One per post per recipient (`ForumPostMention`); edits notify only new mentions |
| Quote of your post | The quoted post's author | "<author name> quoted your post in <thread title>" | One per quoting post per quoted author; not for self-quotes |
| Board reply (`replyToPostId`) | The replied-to message's author | "<author name> replied to you on the <realm> board" | One per message; not for self-replies |

- **Author name** is the post's displayed author: the persona name for a persona post, otherwise the Passport handle. It is never the player behind a persona.
- **Recipients.**
  - A persona-authored post that is mentioned, quoted or replied to notifies the persona's owning user. The title still uses the actor's displayed name only.
  - Recipients who cannot see the post are skipped: those who can't read the thread's category or realm, and anyone, moderators included, when the post is hidden.
  - Users who block the sender, or whose `mentions` privacy refuses mentions, are skipped through the existing `recipientsBlockingSender` and `recipientsRefusing(..., "mentions")` helpers.
- **One notification per recipient per post.** When several events hit one user from one post, the priority is mention, then quote, then reply, then watch.
- **Cap.** At most 50 recipients per post for mentions. Extra handles are ignored silently.
- **Realtime.** The bell keeps polling, so no socket work is needed.

## 5. @mentions

- **Syntax.** `@name` where `name` matches `[a-z0-9_]{3,24}`, case-insensitive. Resolution order:
  1. a Passport `User.handle`;
  2. a `ThinkpagesAccount.username`, for a persona, which notifies its owner.

  *Ruling:* the handle wins on a collision. Mentions inside quotes, code and links are ignored. Parsing reads the post's plain text with quote blocks stripped. It uses the same `plainText` pipeline as action tokens: the rendered plain text for Canvas posts, and the sanitized text for board messages.
- **Rendering.**
  - At save, resolved mentions in the post HTML are wrapped as `<a class="forum-mention" href="<profile path>">@name</a>`.
  - A handle links to the player's profile page. A persona links to its ThinkPages profile.
  - The wrapping is a sanitized-HTML post-process on text nodes only, outside `a`, `code`, `pre` and `blockquote`. It runs for light-composer and Canvas posts.
  - Unresolved names stay plain text.
  - `FORUM_RENDERER_VERSION` bumps so stale posts re-render.
- **Autocomplete.** In the light composer (`GlassPlateEditor`, the board and light forum composers), typing `@` lists matching handles and public personas.
  - A new backward-compatible prop `mentionSource` replaces the editor's own-persona source when it is set. Other uses of GlassPlateEditor are unchanged.
  - The data comes from a new rate-limited query, `thinkpagesForum.mentionSuggestions({ q })`. It returns up to 8 items: handle or persona username, display name, avatar and kind. It reads only public data, needs sign-in, and requires `q` to be at least 2 characters.
- **Canvas editor.** *Ruling:* no autocomplete in Canvas for this sub-project. Typed `@handle` text is parsed, linked and notified the same way. A Plate mention plugin is a follow-up.

## 6. Errors and limits

- Every notification write is best effort: a failure is logged, never thrown.
- The watch and read mutations are idempotent upserts, rate limited with the existing mutation limiter.
- New posts, Watched and Stashed refuse signed-out callers (UNAUTHORIZED). Pages redirect to sign-in.

## 7. Testing

Each item below gets at least one test:
- The unread rule: cutoff, `allReadAt`, read upsert, page-max.
- Board exclusion from New posts and Watched.
- Mark board read and mark all read.
- Auto-watch on create and reply.
- Watcher claim-once notification, and the reset on read.
- Mention parsing: patterns, quotes and code ignored, collision rule, the 50 cap.
- Mention link post-process: text nodes only, sanitized output.
- Persona-safe titles, and notifying a persona's owner.
- Recipients without access, blocked or refusing are skipped.
- Hidden posts don't notify.
- One notification per recipient per post.
- Edits notify only new mentions.
- Quote and board-reply notifications.
- `navCounts` badge counts.
- `mentionSuggestions` limits and auth.
- Pages: empty states, unread bold, the jump-to-unread route.
- Watch toggle UI.
- `GlassPlateEditor` `mentionSource` stays backward compatible.

The signed-in browser check covers: New posts, Watched, the watch toggle, unread bold after another session replies, a mention autocomplete, and the bell showing a mention.
