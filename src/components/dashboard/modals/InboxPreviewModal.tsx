"use client";

import { Mail, MessageSquare, ChevronRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog";
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

export function InboxPreviewModal({ isOpen, onClose, conversations, totalUnread }: InboxPreviewModalProps) {
  const router = useRouter();

  const navigateToConversation = (conversationId: string) => {
    onClose();
    router.push(createUrl(`/thinkpages/thinkshare?conversation=${conversationId}`));
  };

  const navigateToThinkShare = () => {
    onClose();
    router.push(createUrl("/thinkpages/thinkshare"));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-amber-500" />
            Inbox
            {totalUnread > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                {totalUnread} unread
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto space-y-1.5">
          {conversations.length === 0 ? (
            <div className="py-8 text-center">
              <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Start a conversation on ThinkShare</p>
            </div>
          ) : (
            conversations.slice(0, 8).map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigateToConversation(conv.id)}
                className="flex w-full items-start gap-3 rounded-lg border border-border/40 p-3 text-left transition-colors hover:bg-muted/40"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {conv.name || `Conversation`}
                    </span>
                    {conv.unreadCount > 0 && (
                      <Badge variant="destructive" className="shrink-0 text-[9px] px-1 py-0">
                        {conv.unreadCount}
                      </Badge>
                    )}
                  </div>
                  {conv.lastMessage?.content && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {conv.lastMessage.content}
                    </p>
                  )}
                  <span className="mt-1 text-[10px] text-muted-foreground/60">
                    {formatTimeAgo(new Date(conv.lastActivity))}
                  </span>
                </div>
                <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/40" />
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
