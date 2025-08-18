# Thinkshare Components

This directory contains all the components related to the Thinkshare messaging feature of the IxStats application.

## Structure

- `ThinkshareMessages.tsx`: The main entry component for the Thinkshare messaging interface. It orchestrates the various sub-components.
- `ThinkshareHeader.tsx`: Displays the header section of the Thinkshare interface.
- `ConversationList.tsx`: Manages and displays the list of conversations.
- `ConversationListHeader.tsx`: Contains the header and search input for the conversation list.
- `ConversationListContent.tsx`: Renders the scrollable content area of the conversation list, including loading states and individual conversation cards.
- `ConversationCard.tsx`: Represents a single conversation in the list.
- `ChatArea.tsx`: Manages the display of messages within a selected conversation, including the chat header, message list, and message input.
- `ChatHeader.tsx`: Displays the header for the active chat conversation.
- `MessageList.tsx`: Renders the list of messages and typing indicators within a conversation.
- `MessageBubble.tsx`: Displays an individual message, including content, reactions, and actions.
- `MessageInput.tsx`: Provides the rich text input area for sending messages.
- `MessageTimestamp.tsx`: A utility component for formatting and displaying message timestamps.
- `TypingIndicator.tsx`: Displays a typing indicator for a participant.
- `ReplyPreview.tsx`: Shows a preview of the message being replied to.
- `NewConversationModal.tsx`: A modal for initiating new conversations.

## Usage

To use the Thinkshare messaging feature, import `ThinkshareMessages` from this directory:

```typescript
import { ThinkshareMessages } from '~/components/thinkshare/ThinkshareMessages';
```

Ensure that all necessary props are passed to `ThinkshareMessages` as required.
