"use client";

import { MessageSquare, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { MessageFolder } from "~/types/messages";
import { MESSAGE_FOLDERS } from "./MessagesFolderNav";

interface MessagesEmptyStateProps {
  activeFolder: MessageFolder;
  onNewConversation?: () => void;
}

export function MessagesEmptyState({
  activeFolder,
  onNewConversation,
}: MessagesEmptyStateProps) {
  const folderConfig = MESSAGE_FOLDERS.find((f) => f.id === activeFolder);
  const Icon = folderConfig?.icon ?? MessageSquare;

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-1 text-base font-semibold text-foreground">
        Select a conversation
      </h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">
        Choose a conversation from the sidebar, or start a new one to begin messaging.
      </p>
      {activeFolder === "personal" && onNewConversation && (
        <Button
          onClick={onNewConversation}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-700 hover:to-teal-700"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New Conversation
        </Button>
      )}
    </div>
  );
}
