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
  X
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThinkShareParticipant, ThinkShareIdentity } from "~/types/thinkshare";
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
import { Button } from "~/components/ui/button";

interface MessagesChatHeaderProps {
  participant?: ThinkShareParticipant;
  isGroup?: boolean;
  groupName?: string;
  memberCount?: number;
  onSearch?: (query: string) => void;
  onBack?: () => void;
  status?: string; // Add status prop
}

export const MessagesChatHeader: React.FC<MessagesChatHeaderProps> = ({
  participant,
  isGroup,
  groupName,
  memberCount,
  onSearch,
  onBack,
  status,
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const identity = participant ? resolveIdentity(participant) : null;
  const displayTitle = isGroup ? groupName : (identity?.name || "Select a conversation");
  
  // Use the passed status or fallback to participant status
  const currentStatus = status || participant?.status || "offline";

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={onBack}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Search messages..."
                className="h-9 pl-9 pr-8"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    onSearch?.("");
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-border"
                />
                {currentStatus !== "offline" && (
                  <span 
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                      currentStatus === "online" ? "bg-emerald-500" : 
                      currentStatus === "away" ? "bg-amber-500" :
                      currentStatus === "busy" ? "bg-rose-500" : "bg-muted-foreground/50"
                    )}
                  />
                )}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {displayTitle}
                </h3>
                <MessagesIdentityBadge identity={identity as ThinkShareIdentity} />
              </div>
              <p className="text-[10px] capitalize text-muted-foreground">
                {isGroup
                  ? `${memberCount || 0} members`
                  : currentStatus}
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
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
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
