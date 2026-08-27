import React, { useState } from "react";
import {
  Search,
  MoreVert,
  InfoCircle,
  UserPlus,
  Trash,
  Archive,
  BellOff,
  ArrowLeft,
  Xmark,
  Shield,
  Refresh,
} from "iconoir-react";
import { OpenBook as BookOpen } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { ThinkShareConversation } from "~/types/thinkshare";
import type { MessageFolder } from "~/types/messages";
import { SYSTEM_CONVERSATION_ID, LOREBOT_CONVERSATION_ID } from "~/types/messages";
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
  activeFolder: _activeFolder,
  participantStatus,
  onSearch,
  onBack,
  isSidebarCollapsed: _isSidebarCollapsed,
  onViewDetails,
  onAddParticipants,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onClearSystemMessages,
  isMuted = false,
  isArchived = false,
  // oxlint-disable-next-line eslint/no-unused-vars
  displayNamePreference = "country",
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isSystemThread =
    conversation.id === SYSTEM_CONVERSATION_ID || conversation.source === "system";
  const isLoreBotThread =
    conversation.id === LOREBOT_CONVERSATION_ID || conversation.source === "lorebot";
  const isDiplomatic =
    conversation.source === "diplomatic" || conversation.conversationType === "diplomatic";
  const isGroup = conversation.type === "group" || conversation.source === "thinktank";

  const otherParticipants = (conversation.otherParticipants ?? []).filter(
    (p: any) => p.accountId !== currentUserId
  );
  const primaryOther = otherParticipants[0]?.account;
  const memberCount = otherParticipants.length + 1;

  const identity =
    !isGroup && !isSystemThread && !isLoreBotThread && primaryOther
      ? resolveIdentity(
          primaryOther.displayName || primaryOther.username || "User",
          primaryOther.profileImageUrl || primaryOther.countryFlag || null,
          _activeFolder,
          primaryOther.countryName
            ? {
                country: {
                  name: primaryOther.countryName,
                  slug: "",
                  flag: primaryOther.countryFlag,
                },
              }
            : null,
          null,
          conversation.source,
          conversation.conversationType
        )
      : null;

  const displayTitle = isSystemThread
    ? "System Messages"
    : isLoreBotThread
      ? "LoreBot"
      : isGroup
        ? conversation.name || "ThinkTank"
        : identity
          ? identity.displayName
          : conversation.name ||
            primaryOther?.displayName ||
            primaryOther?.username ||
            "Direct Message";

  const avatarUrl =
    isSystemThread || isLoreBotThread
      ? null
      : isGroup
        ? conversation.avatar
        : identity?.avatar || primaryOther?.countryFlag || primaryOther?.profileImageUrl;

  const currentStatus = isSystemThread
    ? "Broadcast Channel"
    : isLoreBotThread
      ? "WikiOS Activity Feed"
      : participantStatus || (isGroup ? `${memberCount} members` : "Active now");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchVisible(false);
    onSearch?.("");
  };

  const toggleSearch = () => {
    if (isSearchVisible) {
      clearSearch();
    } else {
      setIsSearchVisible(true);
    }
  };

  // Dynamic header styling by thread type
  const headerTheme = isSystemThread
    ? "bg-amber-500/[0.04] dark:bg-amber-500/10 border-b border-amber-500/20"
    : isLoreBotThread
      ? "bg-teal-500/[0.04] dark:bg-teal-500/10 border-b border-teal-500/20"
      : isDiplomatic
        ? "bg-amber-500/[0.03] dark:bg-amber-500/[0.07] border-b border-amber-500/20"
        : isGroup
          ? "bg-emerald-500/[0.04] border-b border-emerald-500/20 dark:bg-emerald-500/10"
          : "bg-muted/[0.08] border-b border-border/40";

  return (
    <header
      className={cn(
        "relative z-10 flex h-14 shrink-0 items-center justify-between px-3 backdrop-blur-xl transition-colors duration-300 md:px-4",
        headerTheme
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-muted-foreground hover:bg-accent/40 hover:text-foreground mr-1 -ml-1 h-8 w-8 shrink-0 rounded-xl active:scale-95"
            title="Back to conversation list"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}

        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2 pr-2">
            <Search className="text-muted-foreground h-4 w-4 shrink-0" />
            <Input
              autoFocus
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search in conversation..."
              className="bg-background/50 h-8 flex-1 rounded-xl text-xs"
            />
            <Button variant="ghost" size="icon" onClick={clearSearch} className="h-7 w-7">
              <Xmark className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <div className="relative shrink-0">
              {isSystemThread ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 shadow-inner">
                  <Shield className="h-4.5 w-4.5 text-amber-500" />
                </div>
              ) : isLoreBotThread ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/15 shadow-inner">
                  <BookOpen className="h-4.5 w-4.5 text-teal-400" />
                </div>
              ) : avatarUrl ? (
                primaryOther?.countryFlag ? (
                  <div className="border-border/30 bg-background/50 relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border shadow-xs">
                    <UnifiedCountryFlag
                      countryName={primaryOther.countryName || displayTitle}
                      flagUrl={normalizeFlagUrl(avatarUrl)}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <img
                    src={avatarUrl}
                    alt={displayTitle}
                    className="border-border/30 h-9 w-9 rounded-xl border object-cover shadow-xs"
                  />
                )
              ) : (
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl border font-bold shadow-xs",
                    isGroup
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "border-border/30 bg-accent/20 text-muted-foreground"
                  )}
                >
                  {displayTitle.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Online status indicator */}
              {!isSystemThread && !isLoreBotThread && !isGroup && (
                <span
                  className={cn(
                    "ring-background absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2",
                    participantStatus?.toLowerCase().includes("online")
                      ? "bg-emerald-500"
                      : "bg-muted-foreground/40"
                  )}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-foreground truncate text-sm font-semibold">{displayTitle}</h3>
                {isSystemThread || isLoreBotThread ? (
                  <span className="py-0.2 flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 text-[8px] font-bold tracking-wider text-amber-500 uppercase">
                    Official
                  </span>
                ) : (
                  identity && <MessagesIdentityBadge identity={identity} />
                )}
                {isDiplomatic && (
                  <span className="py-0.2 flex items-center gap-0.5 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 text-[8px] font-bold tracking-wider text-amber-400 uppercase">
                    <Shield className="h-2.5 w-2.5" />
                    Diplomatic Cable
                  </span>
                )}
                {isGroup && (
                  <span className="py-0.2 flex items-center gap-0.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[8px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                    Group Chat
                  </span>
                )}
              </div>
              <p className="text-muted-foreground text-[10.5px]">
                {isSystemThread
                  ? "Platform broadcasts, simulation digests & system dispatches"
                  : isLoreBotThread
                    ? "WikiOS activity stream, watchlist updates & lore dispatches"
                    : isGroup
                      ? `${memberCount || 0} members • Group Chat`
                      : currentStatus}
              </p>
            </div>
          </>
        )}
      </div>

      {!isSearchVisible && (
        <div className="flex items-center gap-1.5">
          {!isSystemThread && !isLoreBotThread && (
            <Button variant="ghost" size="icon" onClick={toggleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          )}

          {isGroup && onAddParticipants && (
            <Button variant="ghost" size="icon" onClick={onAddParticipants}>
              <UserPlus className="h-4 w-4" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Conversation actions"
            >
              <MoreVert className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel>Conversation</DropdownMenuGroupLabel>
                {onViewDetails && (
                  <DropdownMenuItem onClick={onViewDetails}>
                    <InfoCircle className="mr-2 h-4 w-4" />
                    <span>View Details</span>
                  </DropdownMenuItem>
                )}
                {onMuteToggle && !isSystemThread && (
                  <DropdownMenuItem onClick={onMuteToggle}>
                    <BellOff className="mr-2 h-4 w-4" />
                    <span>{isMuted ? "Unmute Thread" : "Mute Thread"}</span>
                  </DropdownMenuItem>
                )}
                {onArchiveToggle && !isSystemThread && (
                  <DropdownMenuItem onClick={onArchiveToggle}>
                    <Archive className="mr-2 h-4 w-4" />
                    <span>{isArchived ? "Unarchive Thread" : "Archive Thread"}</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                {isSystemThread && onClearSystemMessages ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={onClearSystemMessages}
                    className="text-destructive focus:text-destructive"
                  >
                    <Refresh className="mr-2 h-4 w-4" />
                    <span>Clear System Logs</span>
                  </DropdownMenuItem>
                ) : (
                  onDeleteConversation && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={onDeleteConversation}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      <span>{isGroup ? "Leave Group" : "Delete Thread"}</span>
                    </DropdownMenuItem>
                  )
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </header>
  );
};
