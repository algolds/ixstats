# ThinkPages forum, sub-project 1: foundation redesign

**Date:** 2026-10-09
**Status:** Approved design (owner, 2026-10-09). Execution in stages.
**Concept:** [2026-10-09-thinkpages-forum-native-concept.md](2026-10-09-thinkpages-forum-native-concept.md) (decisions, Facet exceptions, sub-project order)
**Branch:** `design/forum-ui` (worktree `ixstats-forum-ui`), one PR into `rose-garden`.

## Scope

In: the sidebar entry, a shared `ForumPage` shell with the Facet Inspector, the Forums home, board pages, the thread page, Canvas posting through the wiki render pipeline, IC article styling, windowed pagination, mobile, import fidelity, the moderation console restyle.

Out (later sub-projects): the realm landing and RMB (2), unread/watch/notifications (3), reactions (4), action integration beyond a visible Attach button (5), Find a Realm adverts (6), Home/Realms integrations (7). No control for an unshipped feature is rendered.

## 1. Structure and navigation

**Shell.** `ForumPage` (in `src/components/thinkpages-forum/shell/`): the standard `PageHeader` (breadcrumbs, title, page actions), a main column, and the Facet `Inspector` (`src/components/ui/inspector.tsx`) as the rail: 320px and sticky from 1280px; below that the rail opens as a sheet from an "Info" header button. Rail panels per page:

| Page | Rail panels |
| --- | --- |
| Forums home | Trending threads, Forum statistics, Your standing |
| Board | About this board, Top posters this month |
| Thread | This thread, Participants, Related on the wiki |

**Sidebar.** ThinkPages becomes its own expandable app for everyone in `src/lib/navigation/app-sections.ts` (drop `signedOutOnly`; remove ThinkPages from Home's sections and Home's `match`). Sections:

| Section | Href | Notes |
| --- | --- | --- |
| Forums | `/thinkpages` | `exact` |
| Your realm | `/thinkpages/r/mine` | server resolver: redirects (307) to the viewer's realm Hub board, or `/thinkpages` without a realm; sub-project 2 repoints it to the realm landing |
| Moderation | `/thinkpages/mod` | new `SectionRequirement` `"forum-moderator"` (site staff or any category/realm moderator) |

Watched, New posts and Stashed are added by sub-project 3. Signed-out visitors keep a ThinkPages entry (Forums only). Mobile reaches the same entries through the More sheet. Breadcrumbs live in the page header; no in-page tab bars.

**Routes** stay as they are (`/thinkpages`, `/c/[key]`, `/c/[key]/new`, `/r/[realm]/[key]`, `/r/[realm]/[key]/new`, `/t/[id]`, `/post/[id]`, `/mod`), plus `/r/mine`. No route under `/thinkpages` gains a `loading.tsx` (the redirect architecture test pins this).

**IC vs OOC.** New column `forum_categories.style` (`"ooc"` default, `"ic"`). Realm categories `character-threads` and `current-events` are `ic`, set by the migration for existing rows and by the realm seeding code for new realms. `style` decides how posts render and adds an "In character" pill to the board and thread headers. It is independent of `icAllowed` (which governs persona posting).

**Facet exceptions** (added to `docs/reference/facet-design-system.md` with reasons, and allowlisted in the Facet ratchet if a rule test flags them): country flags in forum author lines and lists; board chips on phones (used by sub-project 2).

**Code organisation.** Rebuild `src/components/thinkpages-forum/*` on Facet primitives (`Card` content types, `Inspector`, `FacetList`, table styles, `Badge`, `Avatar`, `Signal`, the persona hover card). New reads go in `src/server/modules/thinkpages-forum/reads.ts`; the render pipeline in a new `src/server/modules/thinkpages-forum/render.ts`. Routers stay thin. Fix the existing Facet slips (raw `text-sm` in `PostBody`, the hand-rolled alert in `ForumComposer`).

## 2. Pages

**Forums home (`/thinkpages`).**
- "Your realm" card on top (signed-in members of a realm): realm emblem and name, its Hub's latest thread (title, author, time), link to `/thinkpages/r/mine`. Sub-projects 2 and 3 add the RMB line and unread count.
- Sitewide boards as one data pane: columns Board / Threads / Posts / Latest. Each board row has a tinted icon, name and description; Latest shows avatar or flag, thread title, author and relative time; empty cells show "–". Staff-only boards show only to staff, with a "Staff" pill.
- The realm section moves off the home (it is reached through Your realm; other realms through the realm switcher on the board page). "From the old forum" archive stays as a collapsed section.

**Board page (`/c/[key]`, `/r/[realm]/[key]`).**
- Header: title, description, "In character" pill when `style = ic`, realm switcher on realm boards, primary action "New thread" (when allowed).
- Thread table: columns Thread / Replies / Last post. Sort via `?sort=latest|newest|replies` (default latest), sortable column headers. Pinned threads grouped first. Thread cell: title, lock icon, starter avatar and flag, "Imported" pill, page shortcuts (`1 2 … 9`) when the thread has more than one page.
- Windowed pagination above and below.

**Thread page (`/t/[id]`).**
- One feed pane, divider-separated posts (no card per post).
- Post header: avatar (Passport avatar, else initials), display name with flag, persona hover card on the name, role pill (Staff, Officer, Thread starter; at most one, in that priority), handle and full date (plus "edited"), `#N` permalink on the right (`N` = 1-based position in the thread's visible posts for the viewer).
- Body: `style = ic` renders in the WikiOS article style (wiki reading type 15.5px/1.65, 24px section headings with a rule, wiki-blue links with hover underline, floated infoboxes) inside a `.mw-parser-output` container; `ooc` renders compact prose. Quotes and embeds render as Wells; a quote links to its source post.
- Actions: Reply, Quote, Share in the row; Report, Edit and moderator tools in the "⋯" menu. Quote inserts a quote block for that post into the composer.
- Moderator bar (lock, pin, move, hide, archive) moves into the page header actions for moderators.
- Windowed pagination in the pane footer with "Posts 21–40 of 87" and a "Latest" button.

**Composer.**
- New threads and replies use the Canvas editor: a forum host around `PlateWikiEditor` (toolbar, slash menu), a Preview toggle (server render, nothing saved), the "Posting as" persona switcher, and a visible "Attach action" button opening the existing `ActionPicker`.
- Editing a post that has wikitext opens it in Canvas. Posts without wikitext (older and imported HTML posts) keep editing in the existing light editor.
- Quote inserts `<blockquote class="forum-quote" data-post="<postId>">` with the quoted author and text; the renderer must keep `class` and `data-post` (verify MediaWiki and the sanitizer keep them; if MediaWiki strips `data-post`, carry the id in the class, e.g. `forum-quote-post-<id>`).

**Moderation console (`/thinkpages/mod`).** Restyled with data panes, tables and the rail. Behaviour unchanged.

## 3. Data and server

**Migration** `20261013120000_thinkpages_forum_foundation` (hand-written, idempotent; applied by Claude only to the local clone `ixstats_wv1` and the local dev DB; production is the owner's):
- `forum_categories.style text not null default 'ooc'`, backfilled for `character-threads` and `current-events`.
- `forum_posts.contentWikitext text null` (null: HTML-only post), `rendererVersion text null`, `renderedAt timestamptz null` (null with wikitext present: stale or fallback).
- `forum_post_templates (postId text references forum_posts on delete cascade, title text, primary key (postId, title))`, index on `title`.
- Prisma schema updated to match (`ForumPostTemplate` model). Everything in this migration is expressible in Prisma, so `db:push:force` keeps it.

**Render pipeline (`render.ts`), built the way WikiOS builds articles:**
1. Guard the input: reject signatures (`~~~~`), `{{subst:`, and posts over 50,000 characters; strip `[[Category:…]]`, `__NOINDEX__`, `__NOTOC__`-style magic words and `{{DISPLAYTITLE:…}}` before rendering.
2. Render once through `renderArticleViaMediaWiki(wikitext, "ThinkPages:<threadId>")` (`src/lib/wiki-os/adapters/mediawiki/parsoid.ts`), no PST, with a 3 s timeout, behind a dedicated `OutboundLimiter` (2 concurrent) plus a per-user limit (10 renders a minute, previews included).
3. Compose like `wikios.previewWikitext` (`src/server/api/routers/wikios/editing.ts`): `transformArticleHtml` with the infobox and notices kept inline, `markTemplateChips`, `sanitizeWikiArticleHtml`, `slimArticleHtml`.
4. Store `contentWikitext`, `contentHtml`, `plainText` (via `cleanWikiMarkup`), `rendererVersion` (the WikiOS `RENDERER_VERSION` pattern: pipeline version plus the sanitizer fingerprint), `renderedAt`, and the templates MediaWiki reported (`RenderMetadata.templates`) in `forum_post_templates`.
5. If MediaWiki times out, throttles or fails: store `parseWikitextToHtml` output sanitized the same way, `renderedAt = null`, and tell the author "Formatting will finish shortly". A cron re-renders posts with `renderedAt is null` and wikitext present.
6. Action tokens (`[ixaction=…]`) are verified exactly as today.

**Re-rendering.** A cron job (registered with the existing cron runner in `server.mjs`) re-renders, in small batches: posts with `renderedAt is null`; posts whose `rendererVersion` differs from the current one; posts using a template whose wiki revision is newer than the post's `renderedAt` (join `forum_post_templates` to the WikiOS article table). Template invalidation is therefore driven from the forum side; WikiOS code is not changed to know about forum posts.

**Reading.** One DB read, no MediaWiki call. Rendered HTML displays through `WikiHtmlContent` (`src/components/wiki-os/reader/WikiLinkPreview.tsx`) so red links and hover previews come from Postgres (`getMissingPages`). `contentHtml` and `plainText` keep feeding the feed, Trending, link previews and moderation unchanged.

**MediaWiki dependency.** Add the forum render caller to `docs/systems/wikios/mediawiki-dependencies.md` (its architecture test enforces the list).

**New reads (`reads.ts`, one query each, no N+1):** latest post per board; thread and post counts per board; thread participants (top posters with flags); forum statistics (threads, posts, members; cached 5 minutes); trending threads (most replies in 24 hours); top posters this month per board; post numbers for a page. Authors gain avatar, country flag and role (site staff; realm officer of the thread's realm; thread starter).

**Import fidelity (`src/lib/thinkpages-forum/import/bbcode.ts`):**
- `[wikilink]Title[/wikilink]` → a wiki link to `Title` (rendered with the wiki hover preview).
- `[wikisummary]Title[/wikisummary]` → the inline wiki article preview card used by the Dashboard feed.
- `[wikiinfobox]Title[/wikiinfobox]` → a live infobox embed for `Title`, rendered the WikiOS way.
- `[wikiimage=W]File:X[/wikiimage]` → the wiki image at width `W`.
- Quotes keep the quoted post id (`post: 12`) and are remapped to the native post id by the import's id map.
- Restore quote styling (lost with `forum.css` in 4b) in the new post body styles.
- Re-convert already imported rows on the clone and the local dev DB only. Update `docs/operations/forum-xenforo-import-runbook.md` (production import uses the fixed converter; no extra step).

## 4. Mobile and responsive

| Width | Layout |
| --- | --- |
| 1280px and up | Main column plus sticky rail |
| 768–1279px | Main column; rail in a sheet from "Info" |
| Under 768px | Phone layout below |

- Forums home: boards as two-line rows (name and latest line left; counts stacked right). "Your realm" card stays on top.
- Board page: two-line thread rows (title; starter flag, replies, last time). Page shortcuts collapse to "Last page". Sort moves into a header menu.
- Thread page: full-width posts with 32px avatars; the action row keeps Reply and Quote, the rest is in "⋯"; IC infoboxes stack above the text (as WikiOS does on phones); a docked "Reply" bar above the tab bar opens Canvas in a full-height sheet.
- Pagination: windowed and wrapping; on phones Previous / "Page 3 of 9" / Next.
- Touch: every control at least 44px on coarse pointers; hover-only content (persona card, wiki previews) opens on tap.

## 5. Errors and testing

**Errors and empty states** (Facet `Signal`):
- Wiki unavailable at save: post saved with the fallback render; the author sees "Formatting will finish shortly". Refused input (signature, subst, too long) is rejected with the reason.
- Render rate limit: "You're posting faster than the wiki can format. Try again in a few seconds."
- Empty board: "No threads yet", with New thread for those who may post. Empty rail panels are hidden.
- No permission: the composer is hidden with the reason ("Only IxWorld members can post here"). Locked thread: a lock note replaces the composer.
- Failed reads use the existing route error boundaries.

**Testing** (Jest `--maxWorkers=1`; typecheck projects one at a time after clearing `.next/cache/tsbuildinfo.*`; no builds):
- Renderer: recorded `action=parse` JSON fixtures fed through the forum path and `buildViewBundle`, asserting body, infobox and notices match after normalization; Canvas round-trip byte-identical for forum fixtures; fallback and stale re-render; template-newer-than-post marks stale; guards (`~~~~`, subst, categories, `<script>`, size cap); templates persisted.
- Reads: each new read against a fake DB, with a query-count check.
- Importer: the four wiki BBCode conversions and quote post ids, using samples from the real export as fixtures.
- Architecture: existing ratchets (Facet, stale links, redirect segments) stay green; MediaWiki dependency doc row; Facet exceptions recorded.
- Components: post header (role priority, flag, `#N`), windowed pagination, IC vs OOC body, phone two-line rows.
- Signed-in browser check on the clone (existing harness): home, board, an IC and an OOC thread, posting a Canvas reply, the moderator menu; desktop and phone; screenshots compared with the mockups.

## Stages

1. **Data and render pipeline:** migration, schema, `render.ts`, cron, guards, MediaWiki doc row, tests.
2. **Reads and import fidelity:** new reads and author data; BBCode conversions, quote ids, re-conversion of local rows.
3. **Shell and navigation:** sidebar app, `/r/mine`, `ForumPage` + Inspector, Facet exceptions in the spec.
4. **Pages:** Forums home, board table, thread page (post header, IC/OOC bodies, actions, pagination), moderation console restyle.
5. **Composer:** Canvas host, preview, quote, Attach action, edit paths.
6. **Mobile and polish, then verification:** responsive layouts, full gates, signed-in browser check, whole-branch review.
