"use client";

import { MessageSquare, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
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
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="bg-muted/50 mb-4 flex h-16 w-16 items-center justify-center rounded-2xl">
        <Icon className="text-muted-foreground h-8 w-8" />
      </div>
      <h3 className="text-foreground mb-1 text-base font-semibold">Select a conversation</h3>
      <p className="text-muted-foreground mb-6 max-w-sm text-sm">
        Choose a conversation from the sidebar, or start a new one to begin messaging.
      </p>
      {activeFolder === "conversations" && onNewConversation && (
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
