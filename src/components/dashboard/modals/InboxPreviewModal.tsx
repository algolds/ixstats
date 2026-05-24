"use client";

import { Mail, MessageSquare, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatTimeAgo } from "~/lib/time-utils";
import { createUrl } from "~/lib/url-utils";
import { useRouter } from "next/navigation";

interface Conversation {
  id: string;
  name?: string | null;
  type: string;
  lastActivity: Date | string;
  unreadCount: number;
  lastMessage?: {
    content: string;
    createdAt?: Date | string;
  } | null;
  otherParticipants?: {
    id: string;
    userId: string;
  }[];
}

interface InboxPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversations: Conversation[];
  totalUnread: number;
}

export function InboxPreviewModal({
  isOpen,
  onClose,
  conversations,
  totalUnread,
}: InboxPreviewModalProps) {
  const router = useRouter();

  const navigateToConversation = (conversationId: string) => {
    onClose();
    router.push(createUrl(`/messages?conversation=${conversationId}`));
  };

  const navigateToThinkShare = () => {
    onClose();
    router.push(createUrl("/messages"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-amber-500" />
            Inbox
            {totalUnread > 0 && (
              <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                {totalUnread} unread
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] space-y-1.5 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="text-muted-foreground/40 mx-auto mb-3 h-10 w-10" />
              <p className="text-muted-foreground text-sm">No conversations yet</p>
              <p className="text-muted-foreground/60 mt-1 text-xs">
                Start a conversation on ThinkShare
              </p>
            </div>
          ) : (
            conversations.slice(0, 8).map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigateToConversation(conv.id)}
                className="border-border/40 hover:bg-muted/40 flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors"
              >
                <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                  <MessageSquare className="text-muted-foreground h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conv.name || `Conversation`}
                    </span>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="shrink-0 px-1 py-0 text-[9px]">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.lastMessage?.content && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {conv.lastMessage.content}
                    </p>
                  )}
                  <span className="text-muted-foreground/60 mt-1 text-[10px]">
                    {formatTimeAgo(new Date(conv.lastActivity))}
                  </span>
                </div>
                <ChevronRight className="text-muted-foreground/40 mt-2 h-4 w-4 shrink-0" />
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button onClick={navigateToThinkShare} className="w-full" variant="outline" size="sm">
            Open ThinkShare
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
