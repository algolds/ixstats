# ThinkTanks — Collaborative Groups & Research Engine

**Last updated:** August 2026  
**Status:** Production Ready (Release Candidate) — ThinkTanks v2  
**Route:** `/thinktanks` · `/thinktanks/[groupId]`  
**Design System:** Facet Glass Physics & Apple Design (`/apple-design`)  

ThinkTanks is IxStates' dedicated group collaboration and worldbuilding environment. It bridges real-time messaging, asynchronous discussion, collaborative document authoring, and institutional roleplay into a cohesive workspace that acts as a sister interface to the [ThinkShare Unified Messaging](./social.md#thinkshare-unified-messaging) platform.

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
│  ─────────────────────────────────── │  [ 📰 Feed ]  [ 💬 Chat ]  [ 📄 Docs ]  [ 👥 Members ]│
│  • 🕌 Levantine Lore (21) [Active]   ├─────────────────────────────────────────────────┤
│  • 🌐 Occident Forum (14)            │  Active Tab Canvas                              │
│  • 🛡️ Vandarch Defense (8)           │  (Seamless full-height container)              │
└──────────────────────────────────────┴─────────────────────────────────────────────────┘
```

### Key UI Features

- **Dual Floating `CutoutCard` Panels** ([`ThinktankLayout.tsx`](../../src/components/thinktanks/ThinktankLayout.tsx)):
  - **Directory (Left Column, 1/3)**: Grain-textured panel hosting search, group tabs, dynamic category pills, and group list items.
  - **Workspace (Right Column, 2/3)**: Refraction-textured panel hosting the group identity header and active pillar canvas.
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
                          ┌───────┴───────┐
                          ▼               ▼
                      [ 📰 Feed ]     [ 👥 Members ]
                    Asynchronous      Roster, Roles
                    Notes & Lore      & Sovereignty
                    Intent Tags          Badges
```

### Pillar 1: Feed (`ThinktankFeedTab.tsx`)
- **Asynchronous Notes & Timeline**: Chronological feed of discussions, lore concepts, and announcements.
- **Quick Intent Tags**: Fast one-click tags based on creator workflows:
  - `💡 Note to self` — Individual brainstorming notes
  - `🤝 Collaborative` — Open community collaboration prompts
  - `🔍 Critique wanted` — Requests for feedback and critique
  - `🗺️ Lore & Maps` — Cartographic crops and regional lore drafts
- **Multi-Persona vs. Authentic User Identity**:
  - **When Multi-Persona Posting is Disabled (Default)**: Group members post directly as their **authentic user account** (`User` profile, nation name, and sovereignty flag). No persona selector chips or roleplay badges (`CITIZEN`, `MEDIA`) are shown.
  - **When Multi-Persona Posting is Enabled**: Members can switch between distinct ThinkPages personas (`Citizen`, `Institution`, `Government`, `Character`), displaying the persona name and corresponding badge on feed cards.

### Pillar 2: Members (`ThinktankRosterTab.tsx`)
- **Authentic Member Identity & Sovereignty**: Displays the member's authentic nation name, national flag emoji, custom user avatar, and `@username` handle.
- **Role Badges & Tenure**: Features distinct role badges (`👑 Owner`, `🛡️ Admin`, `Member`) and member join tenure dates with real-time roster search.

---

### Roadmap Pillars (Deferred / Future Phases)
- **Group Chat (`ThinktankChatTab.tsx`)**: Real-time synchronized messaging powered by the ThinkShare messaging infrastructure.
- **Collaborative Docs (`ThinktankPapersTab.tsx`)**: Split-view editor for creating, searching, editing, and versioning group articles and policy drafts.

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
  - Direct invitation dispatch by username or user ID via `api.thinkpages.inviteToThinktank`.
- **Multi-Persona Posting Toggle**:
  - Switch between authentic sovereign user accounts (default) and multi-persona identity chips (`Government`, `Media`, `Citizen`).

---

## 7. Database Models & Schema

ThinkTanks utilizes models defined across `prisma/schema/social.prisma`:

| Model | Purpose |
| :--- | :--- |
| **`ThinktankGroup`** | Group entity (`id`, `name`, `description`, `category`, `avatar`, `type`, `settings`, `memberCount`, `conversationId`, `createdBy`) |
| **`ThinktankMember`** | User membership and role (`id`, `groupId`, `userId`, `role`: `owner` \| `admin` \| `member`, `isActive`, `joinedAt`) |
| **`ThinktankCollaborativeDoc`** | Shared document (`id`, `groupId`, `title`, `content`, `authorId`, `isPublished`, `createdAt`, `updatedAt`) |
| **`ThinkshareConversation`** | Linked real-time chat channel for group discussions |

---

## 8. tRPC API Reference

All ThinkTank operations are exposed via the `thinkpages` tRPC router (`src/server/api/routers/thinkpages/thinktanks/`):

| Procedure | Type | Input | Description |
| :--- | :--- | :--- | :--- |
| `api.thinkpages.getThinktanks` | Query | `{ userId?, type?: "all" \| "joined" \| "created" }` | Returns active groups with computed `isMember` and `userRole` |
| `api.thinkpages.getThinktankById` | Query | `{ groupId: string, userId?: string }` | Returns complete group details, member relations, and settings |
| `api.thinkpages.createThinktank` | Mutation | `{ name, description?, category?, type?, avatar?, createdBy }` | Creates group, sets initial avatar, and assigns owner |
| `api.thinkpages.joinThinktank` | Mutation | `{ groupId: string, userId: string }` | Joins a group and adds user to linked conversation participants |
| `api.thinkpages.leaveThinktank` | Mutation | `{ groupId: string, userId: string }` | Leaves a group and updates membership counts |
| `api.thinkpages.updateGroupSettings` | Mutation | `{ groupId, allowPersonaPosting?, bannerUrl?, rules? }` | Updates group configurations and banner art |
| `api.thinkpages.inviteToThinktank` | Mutation | `{ groupId, userIds, invitedBy }` | Dispatches group invitations to specified users |
| `api.thinkpages.getGroupFeed` | Query | `{ groupId: string, limit?: number }` | Returns group timeline posts with author accounts and reactions |
| `api.thinkpages.createGroupPost` | Mutation | `{ groupId, accountId?, content, mediaUrls? }` | Publishes a note to the group feed |

---

## 9. Related Systems & Documentation

- [ThinkPages Social Backbone & ThinkShare](./social.md)
- [WikiOS Engine Specification](./wikios/WIKIOS.md)
- [Facet Design System Specification](../reference/facet-design-system.md)
- [Complete API Catalog](../reference/api-complete.md#thinkpages-router)
