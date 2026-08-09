# Thinkpages Component Architecture & Modular Blueprint

High-performance, Apple-polished social knowledge sharing suite built for Next.js 16 and React 19.

---

## Folder & Component Taxonomy

All components are organized into specialized domain sub-directories:

### 1. Main Orchestrators (`src/components/thinkpages/`)
- `ThinkpagesPost.tsx` (227 lines) — Top-level post router dispatches between `<HeroPostView>` and `<StandardPostView>`.
- `GlassCanvasComposer.tsx` (422 lines) — Modular post composer container with 100% pixel-perfect original UX & glassmorphism styling.
- `GlassPlateEditor.tsx` (484 lines) — Rich PlateJS Slate editor container.
- `AccountCreationModal.tsx` (584 lines) — Multi-step persona account creation wizard.
- `SportsBulletinCard.tsx` (315 lines) — Apple HIG-inspired sports matchday & standings bulletin card.

---

### 2. Post Suite (`src/components/thinkpages/post/`)
- `ThinkpagesPostUtils.tsx` (103 lines) — Centralized domain primitives (`ACCOUNT_TYPE_ICONS`, `ACCOUNT_TYPE_COLORS`, `REACTION_ICONS`, `getDiscordEmojiUrl`, `proxyDiscordUrl`, `<RelativeTimestamp>`).
- `StandardPostView.tsx` (594 lines) — Standard feed post item card renderer.
- `HeroPostView.tsx` (383 lines) — Dedicated hero view renderer for featured and detail posts.
- `RepostCard.tsx` (92 lines) — Quote post card layout, author header, and quote media grid.
- `ReactionPills.tsx` (67 lines) — Reaction counter pills row above engagement actions.
- `ThreadReplies.tsx` (99 lines) — Collapsible thread replies container and recursive post mapper.
- `PostHeader.tsx` (173 lines) — Author metadata, avatar, badges, timestamp, and dropdown menu.
- `PostBody.tsx` (93 lines) — Post body content renderer, blurb tags, and sports bulletin card dispatcher.
- `PostMediaGrid.tsx` (68 lines) — Flexible media attachment grid with lightbox triggers.
- `PostInlineLinkPreview.tsx` (172 lines) — Smart inline link previews for Wiki, Forum, League, and Club links.
- `PostFooterActions.tsx` (109 lines) — Footer engagement statistics and reaction counters.
- `PostModals.tsx` (209 lines) — Delete confirmation, flag/report dialog, reactions dialog, and image lightbox modal.
- `PostComposers.tsx` (161 lines) — In-line edit composer and reply composer with auto-focus.
- `useThinkpagesPost.ts` (457 lines) — Custom React hook encapsulating state, tRPC mutations, and handlers.

---

### 3. Composer Suite (`src/components/thinkpages/composer/`)
- `useGlassCanvasComposer.ts` (545 lines) — Custom React hook managing composer state, live data queries, and post mutations.
- `ComposerAccountSwitcher.tsx` (132 lines) — Avatar button & floating macOS glass account switcher dropdown.
- `ComposerLiveDataDrawer.tsx` (199 lines) — Expandable 8-tile live data chart grid drawer.
- `ComposerActionBar.tsx` (230 lines) — Bottom action bar with character count, media triggers, GIF picker, poll button, Discord crossposting switch, and Share button.
- `ComposerPollModal.tsx` (262 lines) — Interactive DOM portal poll configuration modal with backdrop blur.

---

### 4. Editor Suite (`src/components/thinkpages/editor/`)
- `EditorPlugins.tsx` (133 lines) — Slate plugins for formatting, embeds, and rich elements.
- `EditorToolbar.tsx` (154 lines) — Formatting toolbar (Bold, Italic, Lists, Links, Emoji).
- `WikiAndStashPopovers.tsx` (314 lines) — Popover drawers for inserting Wiki links, Wiki embeds, Stashes assets, and emojis.
- `MentionMenuPortal.tsx` (94 lines) — Portal dropdown for `@` mention autocomplete (users, leagues, clubs, countries).
- `SlateSerializer.ts` (242 lines) — Slate-to-HTML serializer, HTML-to-Slate deserializer, and Slate node manipulators.
- `useGlassPlateEditor.ts` (554 lines) — Custom React hook managing PlateJS editor instance and selection states.

---

### 5. Account Suite (`src/components/thinkpages/account/`)
- `AccountTypeSelector.tsx` (126 lines) — Persona selection cards (Government, Media, Citizen).
- `AccountDetailsForm.tsx` (170 lines) — Account form inputs (displayName, username check, bio, profile image picker).

---

### 6. Primitives & Helpers (`src/components/thinkpages/primitives/`)
- `PostActions.tsx` (700 lines) — Engagement bar (Like, Repost, Reply, Share, Reactions).
- `ReactionCacheUpdater.ts` (159 lines) — Optimistic React Query cache update helpers.
