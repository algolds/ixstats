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
import { Badge } from "~/components/ui/badge";
import { SearchField } from "~/components/ui/search-field";
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
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
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

  // One opaque header for every thread type; the thread kind shows in its badge.
  const headerTheme = "border-b border-separator";

  return (
    <header
      className={cn(
        "relative flex h-14 shrink-0 items-center justify-between px-3 md:px-4",
        headerTheme
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="text-label-secondary mr-1 -ml-1 size-8 shrink-0"
            title="Back to conversation list"
            aria-label="Back to conversation list"
          >
            <ArrowLeft />
          </Button>
        )}

        {isSearchVisible ? (
          <div className="flex flex-1 items-center gap-2 pr-2">
            <SearchField
              autoFocus
              containerClassName="flex-1"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search in conversation..."
              aria-label="Search in conversation"
            />
            <Button variant="ghost" size="icon-sm" onClick={clearSearch} aria-label="Close search">
              <Xmark />
            </Button>
          </div>
        ) : (
          <>
            <div className="relative shrink-0">
              {isSystemThread ? (
                <div className="bg-yellow/15 rounded-control flex size-9 items-center justify-center">
                  <Shield className="text-yellow size-4" aria-hidden="true" />
                </div>
              ) : isLoreBotThread ? (
                <div className="bg-teal/15 rounded-control flex size-9 items-center justify-center">
                  <BookOpen className="text-teal size-4" aria-hidden="true" />
                </div>
              ) : avatarUrl ? (
                primaryOther?.countryFlag ? (
                  <div className="border-separator bg-fill-4 rounded-control relative flex size-9 items-center justify-center overflow-hidden border">
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
                    className="border-separator rounded-control size-9 border object-cover"
                  />
                )
              ) : (
                <div
                  className={cn(
                    "text-headline rounded-control flex size-9 items-center justify-center",
                    isGroup ? "bg-tint-fill text-tint" : "bg-fill-3 text-label-secondary"
                  )}
                >
                  {displayTitle.charAt(0).toUpperCase()}
                </div>
              )}

              {/* Online status indicator */}
              {!isSystemThread && !isLoreBotThread && !isGroup && (
                <span
                  className={cn(
                    "ring-surface absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2",
                    participantStatus?.toLowerCase().includes("online")
                      ? "bg-success"
                      : "bg-label-tertiary"
                  )}
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-headline text-label truncate">{displayTitle}</h3>
                {isSystemThread || isLoreBotThread ? (
                  <Badge variant="caution">Official</Badge>
                ) : (
                  identity && <MessagesIdentityBadge identity={identity} />
                )}
                {isDiplomatic && (
                  <Badge variant="caution">
                    <Shield aria-hidden="true" />
                    Diplomatic Cable
                  </Badge>
                )}
                {isGroup && <Badge variant="tinted">Group Chat</Badge>}
              </div>
              <p className="text-footnote text-label-secondary truncate">
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
        <div className="flex items-center gap-1">
          {!isSystemThread && !isLoreBotThread && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSearch}
              aria-label="Search in conversation"
            >
              <Search />
            </Button>
          )}

          {isGroup && onAddParticipants && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddParticipants}
              aria-label="Add participants"
            >
              <UserPlus />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Conversation actions"
            >
              <MoreVert className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel>Conversation</DropdownMenuGroupLabel>
                {onViewDetails && (
                  <DropdownMenuItem onClick={onViewDetails}>
                    <InfoCircle />
                    <span>View Details</span>
                  </DropdownMenuItem>
                )}
                {onMuteToggle && !isSystemThread && (
                  <DropdownMenuItem onClick={onMuteToggle}>
                    <BellOff />
                    <span>{isMuted ? "Unmute Thread" : "Mute Thread"}</span>
                  </DropdownMenuItem>
                )}
                {onArchiveToggle && !isSystemThread && (
                  <DropdownMenuItem onClick={onArchiveToggle}>
                    <Archive />
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
                    <Refresh />
                    <span>Clear System Logs</span>
                  </DropdownMenuItem>
                ) : (
                  onDeleteConversation && (
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={onDeleteConversation}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash />
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
