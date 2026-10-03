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
  OpenBook as BookOpen,
} from "iconoir-react";
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
  onViewDetails?: () => void;
  onAddParticipants?: () => void;
  onMuteToggle?: () => void;
  onArchiveToggle?: () => void;
  onDeleteConversation?: () => void;
  onClearSystemMessages?: () => void;
  isMuted?: boolean;
  isArchived?: boolean;
}

type OfficialKind = "system" | "lorebot";

const OFFICIAL_THREADS = {
  system: {
    title: "System Messages",
    status: "Broadcast Channel",
    subtitle: "Platform broadcasts, simulation digests & system dispatches",
    Icon: Shield,
    iconWrapClass: "bg-yellow/15",
    iconClass: "text-yellow",
  },
  lorebot: {
    title: "LoreBot",
    status: "WikiOS Activity Feed",
    subtitle: "WikiOS activity stream, watchlist updates & lore dispatches",
    Icon: BookOpen,
    iconWrapClass: "bg-teal/15",
    iconClass: "text-teal",
  },
} as const;

function getOfficialKind(conversation: ThinkShareConversation): OfficialKind | null {
  if (conversation.id === SYSTEM_CONVERSATION_ID || conversation.source === "system") {
    return "system";
  }
  if (conversation.id === LOREBOT_CONVERSATION_ID || conversation.source === "lorebot") {
    return "lorebot";
  }
  return null;
}

type Participant = ThinkShareConversation["otherParticipants"][number];

function getDirectView(
  conversation: ThinkShareConversation,
  folder: MessageFolder,
  other: Participant["account"] | undefined,
  participantStatus?: string
) {
  const identity = other
    ? resolveIdentity(
        other.displayName || other.username || "User",
        other.profileImageUrl || other.countryFlag || null,
        folder,
        other.countryName
          ? { country: { name: other.countryName, slug: "", flag: other.countryFlag } }
          : null,
        null,
        conversation.source,
        conversation.conversationType
      )
    : null;
  return {
    identity,
    title:
      identity?.displayName ??
      (conversation.name || other?.displayName || other?.username || "Direct Message"),
    subtitle: participantStatus || "Active now",
    avatarUrl: identity?.avatar || other?.countryFlag || other?.profileImageUrl,
  };
}

function getThreadView(
  conversation: ThinkShareConversation,
  currentUserId: string,
  folder: MessageFolder,
  participantStatus?: string
) {
  const official = getOfficialKind(conversation);
  const isGroup = conversation.type === "group" || conversation.source === "thinktank";
  const others = (conversation.otherParticipants ?? []).filter(
    (p: Participant) => p.accountId !== currentUserId
  );
  const other = others[0]?.account;
  const base = { official, isGroup, other, isDirect: !isGroup && !official };

  if (official) {
    const { title, subtitle } = OFFICIAL_THREADS[official];
    return { ...base, identity: null, title, subtitle, avatarUrl: null };
  }
  if (isGroup) {
    return {
      ...base,
      identity: null,
      title: conversation.name || "ThinkTank",
      subtitle: `${others.length + 1} members • Group Chat`,
      avatarUrl: conversation.avatar,
    };
  }
  return { ...base, ...getDirectView(conversation, folder, other, participantStatus) };
}

function ThreadAvatar({ view }: { view: ReturnType<typeof getThreadView> }) {
  const { official, isGroup, other, avatarUrl, title } = view;
  if (official) {
    const { Icon, iconWrapClass, iconClass } = OFFICIAL_THREADS[official];
    return (
      <div className={cn(iconWrapClass, "rounded-control flex size-9 items-center justify-center")}>
        <Icon className={cn(iconClass, "size-4")} aria-hidden="true" />
      </div>
    );
  }
  if (avatarUrl && other?.countryFlag) {
    return (
      <div className="border-separator bg-fill-4 rounded-control relative flex size-9 items-center justify-center overflow-hidden border">
        <UnifiedCountryFlag
          countryName={other.countryName || title}
          flagUrl={normalizeFlagUrl(avatarUrl)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={title}
        className="border-separator rounded-control size-9 border object-cover"
      />
    );
  }
  return (
    <div
      className={cn(
        "text-headline rounded-control flex size-9 items-center justify-center",
        isGroup ? "bg-tint-fill text-tint" : "bg-fill-3 text-label-secondary"
      )}
    >
      {title.charAt(0).toUpperCase()}
    </div>
  );
}

function ThreadInfo({
  view,
  isDiplomatic,
  participantStatus,
}: {
  view: ReturnType<typeof getThreadView>;
  isDiplomatic: boolean;
  participantStatus?: string;
}) {
  const { official, isGroup, isDirect, identity, title, subtitle } = view;
  return (
    <>
      <div className="relative shrink-0">
        <ThreadAvatar view={view} />
        {isDirect && (
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
        <div className="flex items-center gap-2">
          <h3 className="text-headline text-label truncate">{title}</h3>
          {official ? (
            <Badge variant="warning">Official</Badge>
          ) : (
            identity && <MessagesIdentityBadge identity={identity} />
          )}
          {isDiplomatic && (
            <Badge variant="warning">
              <Shield aria-hidden="true" />
              Diplomatic cable
            </Badge>
          )}
          {isGroup && <Badge variant="secondary">Group chat</Badge>}
        </div>
        <p className="text-footnote text-label-secondary truncate">{subtitle}</p>
      </div>
    </>
  );
}

interface ConversationMenuProps extends Pick<
  MessagesChatHeaderProps,
  | "onViewDetails"
  | "onMuteToggle"
  | "onArchiveToggle"
  | "onDeleteConversation"
  | "onClearSystemMessages"
  | "isMuted"
  | "isArchived"
> {
  isSystemThread: boolean;
  isGroup: boolean;
}

function ConversationMenu({
  onViewDetails,
  onMuteToggle,
  onArchiveToggle,
  onDeleteConversation,
  onClearSystemMessages,
  isMuted,
  isArchived,
  isSystemThread,
  isGroup,
}: ConversationMenuProps) {
  const destructive =
    isSystemThread && onClearSystemMessages
      ? { onClick: onClearSystemMessages, Icon: Refresh, label: "Clear system logs" }
      : onDeleteConversation && {
          onClick: onDeleteConversation,
          Icon: Trash,
          label: isGroup ? "Leave Group" : "Delete Thread",
        };

  return (
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
              <span>View details</span>
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
          {destructive && (
            <DropdownMenuItem
              variant="destructive"
              onClick={destructive.onClick}
              className="text-destructive focus:text-destructive"
            >
              <destructive.Icon />
              <span>{destructive.label}</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const MessagesChatHeader: React.FC<MessagesChatHeaderProps> = ({
  conversation,
  currentUserId,
  activeFolder,
  participantStatus,
  onSearch,
  onBack,
  onAddParticipants,
  isMuted = false,
  isArchived = false,
  ...menuHandlers
}) => {
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const view = getThreadView(conversation, currentUserId, activeFolder, participantStatus);
  const isDiplomatic =
    conversation.source === "diplomatic" || conversation.conversationType === "diplomatic";

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    onSearch?.(e.target.value);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setIsSearchVisible(false);
    onSearch?.("");
  };

  return (
    <header className="border-separator relative flex h-14 shrink-0 items-center justify-between border-b px-3 md:px-4">
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
          <ThreadInfo
            view={view}
            isDiplomatic={isDiplomatic}
            participantStatus={participantStatus}
          />
        )}
      </div>

      {!isSearchVisible && (
        <div className="flex items-center gap-1">
          {!view.official && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSearchVisible(true)}
              aria-label="Search in conversation"
            >
              <Search />
            </Button>
          )}

          {view.isGroup && onAddParticipants && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onAddParticipants}
              aria-label="Add participants"
            >
              <UserPlus />
            </Button>
          )}

          <ConversationMenu
            {...menuHandlers}
            isMuted={isMuted}
            isArchived={isArchived}
            isSystemThread={view.official === "system"}
            isGroup={view.isGroup}
          />
        </div>
      )}
    </header>
  );
};
