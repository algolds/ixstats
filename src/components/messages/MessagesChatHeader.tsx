"use client";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Users, Search, MoreVertical } from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { resolveIdentity, MessagesIdentityBadge } from "./MessagesIdentityBadge";

interface MessagesChatHeaderProps {
  conversation: ThinkShareConversation;
  currentUserId: string;
  activeFolder: MessageFolder;
}

export function MessagesChatHeader({
  conversation,
  currentUserId,
  activeFolder,
}: MessagesChatHeaderProps) {
  const isGroup = conversation.type === "group";
  const otherParticipant = conversation.otherParticipants[0];

  const participantName =
    otherParticipant?.account?.displayName ?? conversation.name ?? "Unknown";
  const participantAvatar = otherParticipant?.account?.profileImageUrl ?? null;
  const identity = resolveIdentity(participantName, participantAvatar, activeFolder);

  const isSelf = otherParticipant?.accountId === currentUserId;
  const displayTitle = isGroup
    ? conversation.name ?? "Group Chat"
    : isSelf
      ? `${identity.displayName} (You)`
      : identity.displayName;

  const participantCount = (conversation.otherParticipants?.length ?? 0) + 1;

  const initials = identity.displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/50 px-4">
      <div className="flex min-w-0 items-center gap-3">
        {isGroup ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600">
            <Users className="h-4 w-4 text-white" />
          </div>
        ) : (
          <Avatar className="h-8 w-8">
            <AvatarImage src={identity.avatar ?? undefined} />
            <AvatarFallback
              className={cn(
                "text-xs font-semibold text-white",
                isSelf
                  ? "bg-gradient-to-br from-blue-500 to-purple-600"
                  : "bg-gradient-to-br from-emerald-500 to-teal-600"
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {displayTitle}
            </h3>
            <MessagesIdentityBadge identity={identity} />
          </div>
          <p className="text-xs text-muted-foreground">
            {isGroup
              ? `${participantCount} members`
              : conversation.isActive
                ? "Active"
                : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Search in conversation"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="More options"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
