import React, { useState } from "react";
import {
  Search,
  MoreVertical,
  Info,
  UserPlus,
  Trash2,
  Archive,
  BellOff,
  ChevronLeft,
  X,
  Crown,
  Shield,
  RotateCcw,
} from "lucide-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID } from "~/types/messages";
import { resolveIdentity, MessagesIdentityBadge } from "./MessagesIdentityBadge";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button, buttonVariants } from "~/components/ui/button";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { normalizeFlagUrl } from "~/lib/flags/normalization";

interface MessagesChatHeaderProps {
  conversation: ThinkShareConversation;
  currentUserId: string;
  activeFolder: MessageFolder;
  participantStatus?: string;
  onSearch?: (query: string) => void;
  onBack?: () => void;
  isSidebarCollapsed?: boolean;
  onViewDetails?: () => void;
  onAddParticipants?: () => void;
  onMuteToggle?: () => void;
  onArchiveToggle?: () => void;
  onDeleteConversation?: () => void;
  onClearSystemMessages?: () => void;
  isMuted?: boolean;
  isArchived?: boolean;
  displayNamePreference?: "account" | "country";
}

export const MessagesChatHeader: React.FC<MessagesChatHeaderProps> = ({
  conversation,
  currentUserId,
  activeFolder,
  participantStatus,
  onSearch,
  onBack,
  isSidebarCollapsed = false,
  onViewDetails,
  onAddParticipants,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onClearSystemMessages,
  isMuted = false,
  isArchived = false,
  displayNamePreference = "country",
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isSystemThread = conversation.id === SYSTEM_CONVERSATION_ID || conversation.source === "system";
  const isDiplomatic = conversation.source === "diplomatic" || conversation.conversationType === "diplomatic";
  const isGroup = conversation.type === "group";
  const participant = conversation.otherParticipants[0];

  const participantCountryFlag =
    participant?.account?.countryFlag || participant?.countryFlag || null;
  const participantCountryName =
    participant?.account?.countryName || participant?.countryName || null;

  const participantName =
    displayNamePreference === "account" && participant?.account?.username
      ? `@${participant.account.username}`
      : (participant?.account?.displayName ?? conversation.name ?? "Unknown");
  const participantAvatar = participant?.account?.profileImageUrl ?? null;

  const identity = participant
    ? resolveIdentity(
        participantName,
        participantAvatar,
        activeFolder,
        null,
        null,
        conversation.source,
        conversation.conversationType
      )
    : null;

  const isSelf = participant?.accountId === currentUserId;
  const displayTitle = isSystemThread
    ? "System Messages"
    : isGroup
      ? (conversation.name ?? "ThinkTank Working Table")
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

  // Dynamic header styling by thread type
  const headerTheme = isSystemThread
    ? "bg-amber-500/[0.04] dark:bg-amber-500/10 border-b border-amber-500/20"
    : isDiplomatic
      ? "bg-amber-500/[0.03] dark:bg-amber-500/[0.07] border-b border-amber-500/20"
      : isGroup
        ? "bg-indigo-500/[0.03] dark:bg-indigo-500/10 border-b border-indigo-500/20"
        : "bg-emerald-500/[0.03] dark:bg-emerald-500/10 border-b border-emerald-500/20";

  return (
    <header
      className={cn(
        "relative z-10 flex h-16 shrink-0 items-center justify-between border-b px-4 backdrop-blur-md transition-colors duration-500",
        headerTheme
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground hover:bg-accent/10 shrink-0"
            title={isSidebarCollapsed ? "Show conversation list" : "Hide conversation list"}
          >
            <ChevronLeft
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                isSidebarCollapsed && "rotate-180"
              )}
            />
          </Button>
        )}

        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-md">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2" />
              <Input
                autoFocus
                placeholder="Search messages..."
                className="h-9 pr-8 pl-9 text-xs"
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
            {isSystemThread ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-2xs">
                <Crown className="h-5 w-5" />
              </div>
            ) : !isGroup && participantCountryFlag ? (
              <div className="h-9 w-12 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-2xs">
                <UnifiedCountryFlag
                  countryName={participantCountryName || displayTitle}
                  flagUrl={normalizeFlagUrl(participantCountryFlag)}
                  className="h-full w-full object-cover"
                  showTooltip={false}
                />
              </div>
            ) : !isGroup && participant ? (
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
            ) : null}

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <h3 className="text-foreground truncate text-sm font-semibold">{displayTitle}</h3>
                {isSystemThread ? (
                  <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[8px] font-bold tracking-wider uppercase text-amber-500">
                    Official
                  </span>
                ) : (
                  identity && <MessagesIdentityBadge identity={identity} />
                )}
                {isDiplomatic && (
                  <span className="flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.2 text-[8px] font-bold tracking-wider uppercase text-amber-400">
                    <Shield className="h-2.5 w-2.5" />
                    Diplomatic Cable
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-[10.5px]">
                {isSystemThread
                  ? "Platform broadcasts, simulation digests & system dispatches"
                  : isGroup
                    ? `${memberCount || 0} members`
                    : currentStatus}
              </p>
            </div>
          </>
        )}
      </div>

      {!isSearchVisible && (
        <div className="flex items-center gap-1">
          {!isSystemThread && (
            <Button variant="ghost" size="icon" onClick={toggleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          )}

          {isSystemThread ? (
            onClearSystemMessages && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSystemMessages}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Clear All
              </Button>
            )
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "text-muted-foreground cursor-pointer"
                )}
              >
                <MoreVertical className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuGroupLabel>Conversation Options</DropdownMenuGroupLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onViewDetails}>
                    <Info className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAddParticipants}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Participants
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onMuteToggle}>
                    <BellOff className="mr-2 h-4 w-4" />
                    {isMuted ? "Unmute Notifications" : "Mute Notifications"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onArchiveToggle}>
                    <Archive className="mr-2 h-4 w-4" />
                    {isArchived ? "Unarchive Chat" : "Archive Chat"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDeleteConversation}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Conversation
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}
    </header>
  );
};
