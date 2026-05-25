import React, { useState } from "react";
import {
  Search,
  MoreVertical,
  Phone,
  Video,
  Info,
  UserPlus,
  Trash2,
  Archive,
  BellOff,
  ChevronLeft,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { resolveIdentity, MessagesIdentityBadge } from "./MessagesIdentityBadge";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button, buttonVariants } from "~/components/ui/button";

interface MessagesChatHeaderProps {
  conversation: ThinkShareConversation;
  currentUserId: string;
  activeFolder: MessageFolder;
  participantStatus?: string;
  onSearch?: (query: string) => void;
  onBack?: () => void;
}

export const MessagesChatHeader: React.FC<MessagesChatHeaderProps> = ({
  conversation,
  currentUserId,
  activeFolder,
  participantStatus,
  onSearch,
  onBack,
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isGroup = conversation.type === "group";
  const participant = conversation.otherParticipants[0];

  const participantName = participant?.account?.displayName ?? conversation.name ?? "Unknown";
  const participantAvatar = participant?.account?.profileImageUrl ?? null;

  const identity = participant
    ? resolveIdentity(participantName, participantAvatar, activeFolder)
    : null;

  const isSelf = participant?.accountId === currentUserId;
  const displayTitle = isGroup
    ? (conversation.name ?? "Group Chat")
    : isSelf
      ? `${identity?.displayName} (You)`
      : (identity?.displayName ?? "Select a conversation");

  const memberCount = (conversation.otherParticipants?.length ?? 0) + 1;
  const currentStatus = participantStatus || "offline";

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const toggleSearch = () => {
    if (isSearchVisible) {
      setSearchQuery("");
      onSearch?.("");
    }
    setIsSearchVisible(!isSearchVisible);
  };

  return (
    <header className="border-border/40 bg-background/60 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                autoFocus
                placeholder="Search messages..."
                className="h-9 pr-8 pl-9"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    onSearch?.("");
                  }}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={toggleSearch}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            {!isGroup && participant && (
              <div className="relative shrink-0">
                <img
                  src={identity?.avatar || "/avatars/default.png"}
                  alt={displayTitle}
                  className="ring-border h-10 w-10 rounded-full object-cover ring-1"
                />
                {currentStatus !== "offline" && (
                  <span
                    className={cn(
                      "border-background absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2",
                      currentStatus === "online"
                        ? "bg-emerald-500"
                        : currentStatus === "away"
                          ? "bg-amber-500"
                          : currentStatus === "busy"
                            ? "bg-rose-500"
                            : "bg-muted-foreground/50"
                    )}
                  />
                )}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground truncate text-sm font-semibold">{displayTitle}</h3>
                <MessagesIdentityBadge identity={identity} />
              </div>
              <p className="text-muted-foreground text-[10px] capitalize">
                {isGroup ? `${memberCount || 0} members` : currentStatus}
              </p>
            </div>
          </>
        )}
      </div>

      {!isSearchVisible && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={toggleSearch}>
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="hidden sm:inline-flex">
            <Video className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon" }),
                "text-muted-foreground"
              )}
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroupLabel>Conversation Options</DropdownMenuGroupLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Info className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus className="mr-2 h-4 w-4" />
                Add Participants
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <BellOff className="mr-2 h-4 w-4" />
                Mute Notifications
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Archive className="mr-2 h-4 w-4" />
                Archive Chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
};
