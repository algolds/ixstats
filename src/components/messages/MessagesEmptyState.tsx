"use client";

import { ChatBubble as MessageSquare, Plus } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import type { MessageFolder } from "~/types/messages";
import { MESSAGE_FOLDERS } from "./MessagesFolderNav";

interface MessagesEmptyStateProps {
  activeFolder: MessageFolder;
  onNewConversation?: () => void;
}

export function MessagesEmptyState({ activeFolder, onNewConversation }: MessagesEmptyStateProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);
  const Icon = folderConfig?.icon ?? MessageSquare;

  return (
    <EmptyState
      className="h-full"
      icon={<Icon />}
      title="Select a conversation"
      message="Choose a conversation from the sidebar, or start a new one to begin messaging."
      action={
        activeFolder === "conversations" && onNewConversation ? (
          <Button onClick={onNewConversation}>
            <Plus />
            New Conversation
          </Button>
        ) : undefined
      }
    />
  );
}
