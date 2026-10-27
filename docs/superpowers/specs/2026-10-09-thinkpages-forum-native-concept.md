# ThinkPages forum: native concept (RMB meets conventional forum)

**Date:** 2026-10-09
**Status:** Approved concept. Umbrella for seven sub-projects, each with its own spec, plan and PR.
**Builds on:** [Concept B](2026-10-07-forum-concept-b-thinkpages-forum-design.md) (phases 1-5 and 4b, merged), [Action-linked posts](2026-10-07-action-linked-posts-design.md)
**Origin:** Kistan (Keaor) and Heku, 2026-10-07: "RMB meets conventional forum"; "plan things in the realm forum, do things mechanically, then flavour them in the realm forum".

## Goal

ThinkPages is the IxStates forum. It must feel native to IxStates (Facet, the Home dashboard, WikiOS, MyCountry), not bolted on and not like a half-finished replacement for forum software. It combines a NationStates-style regional message board (RMB) per realm with a conventional threaded forum, and ties both to the game: players plan in the forum, act in MyCountry, and flavour the result back in the forum.

## Audit summary (2026-10-09)

The forum after phase 4b is one 3xl column of cards with little metadata. Compared with XenForo (forum.ixwiki.com) it lacks: last-post info and message counts on the home, avatars, roles, post numbers, permalinks, quote, reactions, unread and watch, windowed pagination (today's renders every page number and overflows on phones), and a mobile layout. Imported quotes lost their styling when `forum.css` was deleted in 4b, and XenForo's custom wiki BBCode (`[wikilink]`, `[wikisummary]`, `[wikiinfobox]`, `[wikiimage=W]`) was imported as plain text. Facet compliance is good apart from a raw `text-sm` (PostBody) and a hand-rolled alert (ForumComposer).

## Owner decisions (2026-10-09)

| Topic | Decision |
| --- | --- |
| Post layout | Header postbit: avatar, name, flag and role in one row above a full-width body |
| Page frame | Home's frame: main column plus the Facet `Inspector` rail; Facet building blocks throughout |
| Realm landing | The realm page is its RMB (front and centre) plus its boards (in the rail) |
| Authors | Player-first: the player's handle with a country flag; personas optional everywhere |
| Other realms | Anyone can read a published realm; visitors post on its RMB only (marked "Visitor"); officers can turn visitors off |
| Forum basics | In: unread and watch, notifications and @mentions (in the IxStats bell), reactions (the Dashboard set). Out: forum search |
| Navigation | ThinkPages expands in the sidebar (Forums, Your realm, New posts, Watched, Stashed, Moderation). No in-page tab bars |
| Liveness | Fully live: messages arrive in real time, with typing indicators |
| Find a Realm | One advert thread per realm, owned by its officers, headed by a live realm card with Join/Apply |
| IC vs OOC | IC categories render as WikiOS articles (wiki reading type, section rules, wiki-blue links, floated infoboxes); OOC and the RMB stay compact |
| Editors | The WikiOS Canvas editor (rich-text wiki, `PlateWikiEditor`) for every thread post; the light composer for RMB messages |
| Storage | Wikitext is canonical; rendered once at save through WikiOS's MediaWiki parse path, the same pipeline as articles; re-rendered when a used template changes |
| Action integration | All four: Attach action in every composer, Share from MyCountry, backlinks on the action, credit rewards |
| Credits | Small flat reward the first time an action is posted (one payout per action), about 3 rewarded actions per country per day; amounts in admin config |
| RMB messages | Short (soft cap 1,000 characters), images, quotes, action cards, reactions; replies show a quoted reference; any message can be "Continued in a thread" |
| RMB moderation | Same tools and log as threads (hide, warn, ban), visitor toggle, optional slow mode |
| Forums home | Sitewide boards as a data table, with a "Your realm" card on top |
| Board pages | Data table of threads, sortable, pinned group, unread bold |
| Mobile | RMB composer docked above the tab bar; boards as chips; rail panels in a sheet |
| Elsewhere | Home feed items become real post previews; a "Your realm" board panel on Home's rail; the Realms app links to the realm's RMB and boards |

## Facet exceptions (recorded in the Facet spec by sub-project 1)

1. Country flags may appear in forum author lines and lists (Facet otherwise keeps identity art in `entity` cards). Reason: the forum's identity is the player's country, as on an RMB.
2. On phones the realm landing shows its boards as a horizontal chip row under the realm header. Reason: the boards are the realm's content list and the rail is hidden on phones.

## Sub-projects (build order)

1. **Foundation redesign** (spec: [2026-10-09-thinkpages-forum-foundation-design.md](2026-10-09-thinkpages-forum-foundation-design.md)). Sidebar sections, `ForumPage` shell with the Inspector, Forums home, board tables, thread page, Canvas posting with the wiki render pipeline, IC article styling, windowed pagination, mobile, import fidelity.
2. **Realm landing and live RMB.** Data model for RMB messages, Socket.IO delivery and typing, visitors, slow mode, promote to thread. Spec written alongside 1; server work can start in parallel, UI lands after 1.
3. **Unread, watch, notifications, @mentions.**
4. **Reactions** on posts and RMB messages (the Dashboard's reaction set and popup).
5. **Action integration**: Attach action, Share from MyCountry, backlinks, credits.
6. **Find a Realm adverts.**
7. **IxStates integrations**: Home feed previews, Home realm panel, Realms app link-up.

Placeholders for later sub-projects (unread counts, New posts, Watched, reactions, RMB) are hidden until their sub-project ships; nothing renders as a dead control.

## Mockups

Brainstorm mockups (gitignored, built on the app's real stylesheet) are in `.superpowers/brainstorm/*/content/`: `shell-refined.html` (thread page and forums home), `concept-v4.html` (realm landing with RMB, IC thread in WikiOS style, Home integration).

## Out of scope

Forum search; a separate forum inbox; signatures; per-thread view counts; changes to versions or the changelog (owner decision pending).
