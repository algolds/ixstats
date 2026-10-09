# ThinkTanks — Collaborative Groups & Research Engine

**Last updated:** 2026-10-05  
**Status:** 🟡 Partial — ThinkTanks v2 (Feed, Members, Docs and Chat tabs live; invite inbox and join-by-code since 2026-10-05); see [SYSTEM_STATUS.md](SYSTEM_STATUS.md)  
**Route:** `/thinktanks` · `/thinktanks/[groupId]` · realm boards at `/r/[realm]/board`  
**Design System:** Facet Glass Physics (see [Facet Design System](../reference/facet-design-system.md); there is no `/apple-design` route)  

ThinkTanks is IxStates' dedicated group collaboration and worldbuilding environment. It bridges real-time messaging, asynchronous discussion, collaborative document authoring, and institutional roleplay into a cohesive workspace that acts as a sister interface to the [ThinkShare Unified Messaging](./social.md#4-thinkshare-real-time-messaging-messages) platform.

---

## 1. System Vision & Product Role

ThinkTanks serves two complementary purposes:
1. **Worldbuilding Sandbox & Lore Strategy Hub**: Provides player communities, alliances, and writing groups a sandbox to brainstorm ideas, share map crops, draft lore, and collaborate on concepts before publishing to [WikiOS](./wikios/WIKIOS.md).
2. **Institutional & Research Collaboration**: Enables formal diplomatic summits, economic research councils, defense pacts, and cultural collectives with fine-grained role management and optional multi-persona posting.

---

## 2. Interface Architecture & Design Language

ThinkTanks is built as a direct sister interface to `/messages`, adhering to Apple's design principles for fluid navigation, spatial depth, and tactile responsiveness.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  DASHBOARD SIDEBAR LAYOUT (Ambient Facet Glass Surface)                                │
├──────────────────────────────────────┬─────────────────────────────────────────────────┤
│  COLUMN 1: DIRECTORY (CutoutCard)    │  COLUMN 2: WORKSPACE CANVAS (CutoutCard)        │
│  texture="paperGrain" (1/3 width)    │  texture="diagonal" (2/3 width)                 │
├──────────────────────────────────────┼─────────────────────────────────────────────────┤
│  [ My Groups | Discover ]   [+ New]  │  [ ◀ Back / Collapse ] 🕌 Levantine Lore Group   │
│  🔍 Search groups...                 │  History & Lore · 21 members · [ Share | ⚙️ ]   │
│  [ All · 6 | History · 3 | Diplo · 2] ├─────────────────────────────────────────────────┤
│  ─────────────────────────────────── │  [ 📰 Feed ]  [ 👥 Members ]                     │
│  • 🕌 Levantine Lore (21) [Active]   ├─────────────────────────────────────────────────┤
│  • 🌐 Occident Forum (14)            │  Active Tab Canvas                              │
│  • 🛡️ Vandarch Defense (8)           │  (Seamless full-height container)              │
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### Key UI Features

- **Dual Floating `CutoutCard` Panels** ([`ThinktankLayout.tsx`](../../src/components/thinktanks/ThinktankLayout.tsx)):
  - **Directory (Left Column, 1/3)**: Grain-textured panel hosting search, group tabs, dynamic category pills, and group list items.
  - **Workspace (Right Column, 2/3)**: Opaque panel hosting the group identity header and active pillar canvas.
- **Desktop Sidebar Collapse / Focus Mode**:
  - The collapse toggle (`SidebarCollapse` / `SidebarExpand`) allows users to hide the left directory to focus entirely on writing long-form docs or reading group timelines.
- **Spring Physics Animations (`motion/react`)**:
  - Tab controls and category capsules use spring physics (`damping: 30`, `stiffness: 450`) with shared layout IDs (`layoutId="thinktank-dir-tab-pill"`, `layoutId="category-capsule-pill"`).
- **Tactile Response & Audio**:
  - Instant micro-interactions (`active:scale-[0.97]`) paired with Cuelume audio cues (`soundEffects.press()`, `soundEffects.release()`, `soundEffects.success()`).

---

## 3. The Group Workspace

ThinkTanks focuses on streamlined asynchronous lore collaboration and membership roster management:

```
                  ┌───────────────────────────────┐
                  │       ThinkTank Workspace     │
                  └───────────────┬───────────────┘
          ┌───────────────┬───────┴───────┬───────────────┐
          ▼               ▼               ▼               ▼
      [ Feed ]       [ Members ]      [ Docs ]        [ Chat ]
    Notes & lore    Roster, roles   Group papers    Linked ThinkShare
    intent tags     and badges                      conversation
```

The tabs are mounted in `ThinktankWorkspace.tsx`.

### Pillar 1: Feed (`ThinktankFeedTab.tsx`)
- **Asynchronous Notes & Timeline**: Chronological feed of discussions, lore concepts, and announcements.
- **Quick Intent Tags**: Fast one-click tags based on creator workflows:
  - `💡 Note to self` — Individual brainstorming notes
  - `🤝 Collaborative` — Open community collaboration prompts
  - `🔍 Critique wanted` — Requests for feedback and critique
  - `🗺️ Lore & Maps` — Cartographic crops and regional lore drafts
- **Multi-Persona vs. Authentic User Identity**:
  - **When Multi-Persona Posting is Disabled (Default)**: Group members post as themselves. `createGroupPost` without an `accountId` posts through the caller's **personal persona** (`accountType: "personal"`, no country; created on first use, one per user, see [social.md](./social.md#2-account-manager--discord-bridge)). It never borrows the user's oldest persona (which could be a government account) and never attaches an arbitrary nation. The group feed card shows the real user's name and nation. No persona selector chips or roleplay badges (`CITIZEN`, `MEDIA`) are shown.
  - **When Multi-Persona Posting is Enabled**: Members can switch between distinct ThinkPages personas (the ThinkPages account types `government`, `media` and `citizen`, `accounts.ts`), displaying the persona name and corresponding badge on feed cards.

### Pillar 2: Members (`ThinktankRosterTab.tsx`)
- **Authentic Member Identity & Sovereignty**: Displays the member's authentic nation name, national flag emoji, custom user avatar, and `@username` handle.
- **Role Badges & Tenure**: Features distinct role badges (`👑 Owner`, `🛡️ Admin`, `Member`) and member join tenure dates with real-time roster search.

---

### Pillars 3–4: Chat and Docs
- **Group Chat (`ThinktankChatTab.tsx`)** — *live*: the workspace's Chat tab uses the group's linked `ThinkshareConversation` (`conversationId`); only active members can join it.
- **Collaborative Docs (`ThinktankPapersTab.tsx`)** — *live*: Split-view editor for creating, searching, editing, and versioning group articles and policy drafts. It is the workspace's Docs tab.

---

## 4. Access Control & Frosted Blur Permissions

To preserve group privacy and encourage participation while providing a rich browsing experience:

1. **Non-Member Feed Preview (Frosted Glass Blur)**:
   - When an unjoined user views a public group, the timeline and composer render underneath a frosted glass blur (`filter blur-[5px] opacity-40 select-none pointer-events-none`).
   - A floating Apple glass card sits centered over the blur with group details and an immediate **`[ + Join Group ]`** button.
2. **Hidden Sub-Tabs**:
   - The bottom tab bar (`Members`) is completely concealed for non-members, keeping the header clean and uncluttered.
3. **Instant Seamless Unlock**:
   - Clicking **`Join Group`** joins the group, executes Cuelume sound effects, unblurs the feed, and smoothly reveals workspace tabs without a page reload.

---

## 4a. Realm Boards (`type: "realm_board"`)

Every realm has a board, the NationStates regional message board, built on this group primitive
(`src/server/api/routers/thinkpages/thinktanks/realm-board.ts`; see [Realms](./realms.md)).

- **Storage.** A `ThinktankGroup` with `type: "realm_board"`, mapped to its realm by `RealmBoard`
  (`prisma/schema/realm-boards.prisma`: `realmId` and `groupId`, both unique). It has the usual linked
  ThinkShare conversation (the Chat tab) and settings `{ allowPersonaPosting: true }`.
- **Created on demand.** `realms.getBoard` creates the board, its chat and its `RealmBoard` row in one
  transaction the first time anyone opens `/r/[realm]/board`. When two first opens race, the unique
  `realmId` lets one win and the other returns the winner's board. There is no bulk migration.
- **Access follows nation ownership, not member rows.** `getGroupAccess` hands realm boards to
  `getRealmBoardAccess`:
  - **Read:** anyone, signed out included (`REALM_BOARD_PUBLIC_READ = true`; realms are never private).
    Non-members see the feed without the frosted blur, and a notice replaces the composer.
  - **Member (post, chat, docs):** owners of a nation in the realm (`Country.ownerUserId`), and its moderators.
    A nation **banned** from the board (`RealmBoardBan`) makes its owner a non-member; a **muted** one keeps
    them a member who can't post or chat (`restriction`, checked by `createGroupPost` and, for the board's
    chat, by `sendMessage` through `realmBoardChatRestriction`). These rows are frozen history: since phase 3,
    mutes and bans live in the forum, and only rows written earlier still bind here.
  - **Manager (moderate):** site admins, the realm's founder and officers with the `board` power
    (`hasRealmPower`). See [realms §4](./realms.md#4-realm-page-rrealm).
  - A leftover `ThinktankMember` row never lets someone post after they lose their last nation there.
- **Membership sync.** Each `realms.getBoard` call joins the caller on their first visit (a member row
  plus a chat participant; a later Leave is respected until they press Join). It also deactivates the
  rows and chat participants of anyone who no longer owns a nation in the realm, or whose every nation there
  is banned from the board (the founder is kept),
  and recounts `memberCount`. `joinThinktank` on a board needs nation ownership, not an invite.
- **Personas.** A persona posting to a board must belong to a nation of the realm (`requireRealmPersona`).
  "Post as yourself" uses the caller's oldest persona of one of their nations there, or creates a
  citizen persona of their first nation there. Board posts are stamped in real time (other group posts
  still use IxTime) because they also appear in the realm feed, which is ordered by real time.
- **Not group-managed.** A board cannot be deleted, invited to, or have its `type` changed, even by its
  moderators (`BAD_REQUEST`). Boards are left out of the `/thinktanks` Discover list (`getThinktanks`
  `type: "all"`); the directory at `/realms` lists them.
- **Mutes and bans moved to the forum (phase 3).** The realm's Manage tab no longer mutes or bans nations on
  the board (`restrictBoardNation` and `liftBoardRestriction` are gone). Live board bans were migrated to
  realm-scope forum bans, and the `board` officer power now means **forum moderation**: hide, lock, warn and
  ban in the realm's forum section, from the moderation console at `/thinkpages/mod`. `RealmBoardBan` is
  frozen, not deleted: rows already in it keep binding through `getRealmBoardAccess` and
  `realmBoardChatRestriction` as described above, but nothing writes to it, until the board itself is deleted.
- **Moderation.** `removeGroupPost` (group owners and admins; on a board, the realm's moderators)
  removes the group tag from a post and sets `visibility: "removed"`, so it leaves the board, the realm
  feed and the main feed. It works for every ThinkTank.

---

## 5. Directory, Activity Indicators & Focus Transitions

The directory sidebar prioritizes active participation and seamless resumption:

- **Default View Selection & Auto-Collapse**:
  - Automatically selects the **most recent group the user belongs to** upon opening `/thinktanks`.
  - Remembers and restores the last active group per user via local persistence (`localStorage`).
  - **Auto-Collapse on Group Selection**: Selecting any group automatically collapses the left directory sidebar (`isSidebarCollapsed = true`) to transfer full visual focus to the workspace canvas. The sidebar can be reopened at any time via the header toggle.
- **Apple-Style Activity Alert Beacons**:
  - Groups with active discussions, notes, or member updates within the last 48 hours display an **animated emerald beacon** atop their avatar.
  - Cards feature a dynamic relative timestamp chip (e.g. `2m`, `1h`, `1d`).
- **Segmented Control**: 
  - **`My Groups`**: Shows all groups you belong to, with role indicators for groups you administer.
  - **`Discover`**: Shows open public groups across the realm to explore and join.
- **Dynamic Category Capsules**:
  - Category capsules are computed dynamically from active groups with live count badges (e.g., `All · 6`, `History & Lore · 3`).
  - Empty categories in the active tab are omitted automatically.

---

## 6. Group Branding & Media Repository Integration

Group owners and administrators can customize the visual identity of their ThinkTank directly within **Group Settings** (`ThinktankSettingsModal.tsx`):

- **Platform Media Repository Integration (`MediaSearchModal.tsx`)**:
  - **Group Emblem / Logo**: Pick from Wikimedia Commons, high-resolution web photography, user Stash, or local file upload.
  - **Group Banner Artwork**: Select panoramic headers rendered as a frosted glass backdrop across the workspace header chrome.
- **Member Invitations**:
  - Invitations via `api.thinkpages.inviteToThinktank`, choosing the invitee through a username search (`searchInvitableUsers`, which respects invite privacy in `invite-privacy.ts`). Joining a private or invite-only group consumes an open invite (`membership.ts`).
  - **Invite inbox:** "My groups" lists the caller's open invites (`getMyThinktankInvites`) with Accept (joins through the `joinThinktank` path) and Decline.
  - **Invite codes:** group owners and admins create a single-use code valid for 1–30 days (`createThinktankInviteCode`, "New code" under Invite members); anyone signed in can join with it (`joinThinktankByCode`, the "Invite code" field). Realm boards refuse codes.
- **Multi-Persona Posting Toggle**:
  - Switch between authentic sovereign user accounts (default) and multi-persona identity chips (`Government`, `Media`, `Citizen`).

---

## 7. Database Models & Schema

ThinkTanks utilizes models defined across `prisma/schema/social.prisma`:

| Model | Purpose |
| :--- | :--- |
| **`ThinktankGroup`** | Group entity (`id`, `name`, `description`, `category`, `avatar`, `type`, `settings`, `memberCount`, `conversationId`, `createdBy`) |
| **`ThinktankMember`** | User membership and role (`id`, `groupId`, `userId`, `role`: `owner` \| `admin` \| `member`, `isActive`, `joinedAt`) |
| **`ThinktankMessage`** | Unused: the Chat tab uses the linked `ThinkshareConversation` instead |
| **`ThinktankInvite`** | Invitation record (`invitedBy`, `invitedUser`, `inviteCode`, `expiresAt`, `isUsed`) |
| **`CollaborativeDoc`** | Shared document (`id`, `groupId`, `title`, `content`, `version`, `createdBy`, `lastEditBy`, `isPublic`, `createdAt`, `updatedAt`) |
| **`ThinkshareConversation`** | Linked real-time chat channel for group discussions |
| **`RealmBoard`** | `prisma/schema/realm-boards.prisma`: maps a realm (`realmId`, unique) to its board group (`groupId`, unique). Plain ids, no relations |

---

## 8. tRPC API Reference

All ThinkTank operations are exposed via the `thinkpages` tRPC router (`src/server/api/routers/thinkpages/thinktanks/`):

| Procedure | Type | Input | Description |
| :--- | :--- | :--- | :--- |
| `api.thinkpages.getThinktanks` | Query | `{ userId?, type?: "all" \| "joined" \| "created" }` | Returns active groups with computed `isMember` and `userRole` |
| `api.thinkpages.updateThinktank` / `deleteThinktank` | Mutation | `{ groupId, name?, description?, avatar?, type?, category?, tags? }` / `{ groupId }` | Edits group metadata / deletes the group and its linked conversation |
| `api.thinkpages.getThinktankById` | Query | `{ groupId: string, userId?: string }` | Returns complete group details, member relations, and settings |
| `api.thinkpages.createThinktank` | Mutation | `{ name, description?, category?, type?, avatar?, tags? }` (creator = `ctx.auth.userId`) | Creates group, sets initial avatar, and assigns owner |
| `api.thinkpages.joinThinktank` | Mutation | `{ groupId: string }` | Joins a group as the caller and adds user to linked conversation participants |
| `api.thinkpages.leaveThinktank` | Mutation | `{ groupId: string }` | Leaves a group as the caller and updates membership counts |
| `api.thinkpages.updateGroupSettings` | Mutation | `{ groupId, allowPersonaPosting?, bannerUrl?, rules?, themeAccent?, pinnedDocIds? }` | Updates group configurations and banner art |
| `api.thinkpages.inviteToThinktank` | Mutation | `{ groupId, userIds }` | Dispatches group invitations to specified users |
| `api.thinkpages.getMyThinktankInvites` | Query | none | The caller's open invites to active groups they haven't joined |
| `api.thinkpages.acceptThinktankInvite` / `declineThinktankInvite` | Mutation | `{ inviteId }` | Accept (joins the group) or decline one of the caller's invites |
| `api.thinkpages.createThinktankInviteCode` | Mutation | `{ groupId, days? }` (1–30, default 7) | Owner or group admin: a single-use invite code |
| `api.thinkpages.joinThinktankByCode` | Mutation | `{ code }` | Join a group with an invite code (consumes it) |
| `api.thinkpages.getGroupFeed` | Query | `{ groupId: string, limit?: number, cursor?: string }` | Returns group timeline posts with author accounts and reactions |
| `api.thinkpages.createGroupPost` | Mutation | `{ groupId, accountId?, content, hashtags?, mediaUrls? }` | Publishes a note to the group feed (realm boards: see §4a) |
| `api.thinkpages.removeGroupPost` | Mutation | `{ groupId, postId }` | Group owners and admins (realm-board moderators) remove a post from the group feed and hide it |
| `api.thinkpages.getThinktankDocuments` / `createThinktankDocument` / `updateThinktankDocument` / `deleteThinktankDocument` | Query / Mutation | `{ groupId }` / `{ groupId, title, content?, isPublic? }` / … | Collaborative doc CRUD (backs the Docs tab) |

---

## 9. Related Systems & Documentation

- [ThinkPages Social Backbone & ThinkShare](./social.md)
- [WikiOS Engine Specification](./wikios/WIKIOS.md)
- [Facet Design System Specification](../reference/facet-design-system.md)
- [Complete API Catalog](../reference/api-complete.md)
