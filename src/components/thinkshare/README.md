# ThinkShare Components

**Last updated:** October 2025

ThinkShare delivers the messaging experience across ThinkPages and collaboration flows.

## Component Overview
| Component | Description |
| --- | --- |
| `ThinkshareMessages.tsx` | High-level container coordinating layout and data fetching |
| `ThinkshareHeader.tsx` | Header with participant info, status indicators, quick actions |
| `ConversationList.tsx` (+ header/content/card) | Conversation selector with search + loading states |
| `ChatArea.tsx` | Chat viewport with message list + composer |
| `MessageList.tsx` / `MessageBubble.tsx` | Render messages, reactions, reply previews, timestamps |
| `MessageInput.tsx` | Composer with rich-text support and attachments |
| `TypingIndicator.tsx` | Real-time typing indicator display |
| `ReplyPreview.tsx` | Shows the message being replied to |
| `NewConversationModal.tsx` | Create or invite participants to new threads |

## Data Requirements
- Conversations & messages fetched via `api.thinkpages.getConversation*` (see router) and related mutations for posting/reactions
- Typing indicators and live updates may come from real-time channels; ensure WebSocket bridge toggles are enabled when integrating

## Usage Tips
- Import `ThinkshareMessages` and provide necessary props (current user, selected conversation handlers)
- Maintain consistent theming with ThinkPages components by using shared tokens
- Update `/help/social/thinkshare` and `docs/systems/social.md` when altering messaging workflows

Keep this README aligned with component names and data contracts.
