# ThinkPages Component Suite

**Last updated:** October 2025

Components in this folder power the ThinkPages social and collaboration experience.

## Highlights
| Component | Description |
| --- | --- |
| `ThinkpagesSocialPlatform.tsx` | Top-level feed container (lists posts, trending content) |
| `ThinkpagesPost.tsx` | Post card with reactions, metadata, and contextual actions |
| `PostComposer.tsx` | Rich text composer for new posts (uses `RichTextEditor.tsx`) |
| `ThinktankGroups.tsx` | ThinkTank discovery and management UI |
| `LiveEventsFeed.tsx` | Live activity ticker (subscribes to social events) |
| `AccountCreationModal.tsx` / `AccountSettingsModal.tsx` | Onboarding and profile management |
| `EnhancedAccountManager.tsx` | Admin/DM tools for managing ThinkPages users |
| `ReactionPopup.tsx`, `ReactionsDialog.tsx` | Reaction interaction patterns |
| `WikiSearch.tsx`, `WikiImageSearch.tsx` | Integrated wiki lookups for referencing content |
| `GlassCanvasComposer.tsx` | Visual canvas for collaborative storytelling experiments |

Support modules:
- `primitives/` – Shared layout pieces, hover cards, drawers
- `RichTextEditor.tsx` – Editor built on tiptap/lexical style primitives

## Usage Tips
- Keep new components inside `primitives/` when they are generic enough to reuse within ThinkPages
- Shared functionality that could benefit other domains should graduate to `src/components/shared`
- Update `/help/social/*` and `docs/systems/social.md` when adding new user-facing capabilities

This README should be updated whenever major components are added or renamed.
