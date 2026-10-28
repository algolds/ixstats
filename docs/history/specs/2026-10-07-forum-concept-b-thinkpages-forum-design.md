# Concept B: ThinkPages as the forum (drop XenForo)

**Date:** 2026-10-07
**Status:** Approved design, competing with [Concept A](2026-10-07-forum-concept-a-lean-xenforo-design.md). Pick one.
**Depends on:** [Action-linked posts](2026-10-07-action-linked-posts-design.md)
**Origin:** Kistan (Keaor): "use ThinkPages as the forum equivalent", RMB meets conventional forum, 2026-10-07

## Problem

Same as Concept A: the platform needs a public, out-of-character town square, and the existing social systems all lean closed or in-character. ThinkPages today is mostly a copy of the persona account manager.

## Concept

Retire the XenForo bridge. ThinkPages becomes a native forum: a sitewide section on top, and a section per realm below that replaces Realm Boards. Out-of-character categories post as the user; in-character categories can post as a persona. Action links and story chains are first-class.

## Free the ThinkPages name

- Move `ThinkPagesAccountHub` (and `EnhancedAccountManager`, `AccountCreationModal`, `AccountSettingsModal`) into a Dashboard "Accounts" section in `DashboardRouter`.
- Move `/thinkpages/post/[postId]` to `/dashboard/post/[postId]`, with a redirect from the old path.
- `/forum/*` redirects to the matching `/thinkpages` page (thread ids via the import id map, otherwise home).

## Structure at launch

**Sitewide section** (seeded, fixed):

| Category | Visibility | IC allowed |
| --- | --- | --- |
| Admin: Rules | public, staff post | no |
| Admin: Announcements | public, staff post | no |
| Admin: Reports | reporter + staff | no |
| Admin: Staff | staff | no |
| Find a Realm | public | no |
| General | public | no |
| Side Games | public | yes |

**Realm section** (seeded for every realm, and on realm creation):

| Category | IC allowed |
| --- | --- |
| Hub / OOC | no |
| Character Threads | yes |
| Current Events | yes |

**Routes:**

| Route | Purpose |
| --- | --- |
| `/thinkpages` | Home: sitewide section, then your realm's section, with a realm switcher |
| `/thinkpages/c/[key]` | Sitewide category |
| `/thinkpages/r/[realm]/[key]` | Realm category |
| `/thinkpages/t/[threadId]` | Thread |
| `/thinkpages/mod` | Moderation queue, warnings, bans, appeals, mod log |

UI uses the ThinkPages Emerald tint. The Forum Red tint is retired from `APP_TINTS` (update `app-palette.test.ts`).

## Data

New file `prisma/schema/forum.prisma`. The `forum` router name is reused once the XenForo bridge is deleted.

| Model | Key fields |
| --- | --- |
| `ForumCategory` | `scope` (`site`/`realm`), `realmId?`, `key`, `name`, `order`, `visibility` (`public`/`staff`/`reporter_staff`), `postRole` (`any`/`staff`), `icAllowed`. Unique (`scope`, `realmId`, `key`) |
| `ForumThread` | `categoryId`, `title`, `authorUserId`, `authorPersonaId?`, `pinned`, `locked`, `hidden`, `archived`, `lastPostAt`, `postCount`, `xenforoThreadId? @unique` |
| `ForumPost` | `threadId`, `authorUserId`, `authorPersonaId?`, `content` (Plate JSON) or `contentHtml` (imported), `hidden`, `editedAt`, `importedAuthorName?`, `xenforoPostId? @unique` |

Rules:

- `authorPersonaId` is accepted only when the category is `icAllowed` and the persona belongs to the user's country.
- Native forum posts are separate from `ThinkpagesPost` (the feed): different lifecycle, threading and moderation.
- Composer: the existing `GlassPlateEditor`, with the one-click focus fix (activating it focuses the text field directly) and the Action Picker from the shared module. Action links write `PostActionLink` with `postSource: "native"`.

## Moderation (full)

**Roles:**

- Site admins: everything.
- Realm officers (`RealmOfficer`): their realm's section.
- Category moderators: `ForumCategoryModerator` (`categoryId`, `userId`).

**Models:**

| Model | Purpose |
| --- | --- |
| `ForumReport` | `targetType` (thread/post), `targetId`, `reporterId`, `reason`, `status`, `handledBy?` |
| `ForumWarning` | `userId`, `issuedBy`, `reason`, `points`, `expiresAt`, `targetRef?` |
| `ForumBan` | `userId`, `scope` (`site`/`realm`/`category`), `scopeId?`, `reason`, `issuedBy`, `expiresAt?`, `auto` |
| `ForumModLog` | append-only: `actorId`, `action`, `targetType`, `targetId`, `detail`, `createdAt` |
| `ForumAppeal` | one per warning or ban: `subjectType`, `subjectId`, `userId`, `body`, `status`, `reviewedBy?` |

**Actions:** lock, pin, hide, move and archive a thread; hide and edit a post; warn; ban; resolve reports.

**Rules:**

- Every moderator action writes a `ForumModLog` row in the same transaction.
- Active warning points (not expired) at or above a configured threshold create an automatic temporary `ForumBan` (`auto: true`). Thresholds live in one constant in the moderation service.
- An appeal must be reviewed by someone other than the issuer of the warning or ban.
- Officers and category moderators can act only inside their scope; site bans are admin-only.
- `RealmBoardBan` rows migrate to `ForumBan` with `scope: "realm"`, then `RealmBoardBan` is deleted.

## Migrations (one-time scripts, idempotent)

1. **Realm Boards → realm sections:** each board's `ThinktankMessage` history becomes one archived "Realm Board archive" thread in that realm's Hub / OOC. `/r/[realm]/board` points to the realm section. Then delete `RealmBoard`, the `realm_board` ThinktankGroup type, and `src/server/shared/realm-board.ts` and its callers in the thinktanks routers.
2. **XenForo import:**
   - Nodes become categories: mapped onto seeded categories where they fit, otherwise created under a sitewide "Archive" category.
   - Threads and posts: BBCode converted once with the existing `transformBBCode` and stored as `contentHtml`.
   - Authors: matched via `User.forumUserId`; unmatched authors stored in `importedAuthorName`.
   - Attachments copied into our own storage, links rewritten.
   - Keyed on `xenforoThreadId` / `xenforoPostId`, so reruns skip existing rows.
   - After a verified import: forum.ixwiki.com goes read-only, later redirects to `/thinkpages`.
   - Then delete `src/server/modules/forum/` (bridge, XenForo service, user sync, link verification), `src/app/api/forum/attachment/`, the old forum routers, `src/components/forum/`, `forum.css`, and the IxnayID forum-verification procedures. Drop `User.forumUserId` / `forumUsername` only after the import id map is no longer needed.

## Phases

1. Models, read and write routers, sitewide section, composer.
2. Realm sections and the Realm Board migration.
3. Moderation. **Public launch gate:** phase 3 ships before the forum is announced.
4. XenForo import and retirement.
5. Persona hub moves to Dashboard and the ThinkPages name switches over.

## Trade-offs

- **For:** fully native; personas work in IC categories; action links and chains feel first-class; matches Kistan's proposal; scales from one forum to many realm sections.
- **Against:** largest scope by far; full moderation is a subsystem on its own; import risk; IxStats now owns abuse handling XenForo used to cover.

## Testing

- Permissions: persona only in `icAllowed` categories and only the user's country's personas; officer actions limited to their realm; staff-only categories hidden from others.
- Warning points reaching the threshold create an auto-ban; expired warnings don't count.
- Appeal reviewer cannot be the issuer.
- Every moderator action writes a mod log row.
- Import idempotency against a XenForo fixture (rerun creates nothing).
- Realm Board migration against a fixture (messages land in one archived Hub thread; bans migrate).

## Appendix: MyCountry Overview colour

Unrelated to the forum, raised in the same review. Give the MyCountry Overview cards MyCountry Gold tint accents through semantic tokens, within Facet rules (no glows, no hardcoded hexes). Its own small change.
