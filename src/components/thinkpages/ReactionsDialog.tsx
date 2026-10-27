"use client";

import React from "react";
import { Virtuoso } from "react-virtuoso";
import { SystemRestart as Loader2, Heart, ChatBubble as MessageSquare } from "iconoir-react";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { EmptyState } from "~/components/ui/empty-state";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import {
  AccountTypeIcon,
  REACTION_ICONS,
  accountTypeColor,
  getDiscordEmojiUrl,
  getInitials,
} from "./post/ThinkpagesPostUtils";

interface ReactionsDialogProps {
  postId: string;
  isOpen: boolean;
  onClose: () => void;
  onAccountClick?: (accountId: string) => void;
  discordMsgId?: string | null;
}

type PostReaction = any;

const REACTION_COLORS: { [key: string]: string } = {
  like: "text-red",
  laugh: "text-yellow",
  angry: "text-red",
  fire: "text-orange",
  thumbsup: "text-green",
  thumbsdown: "text-label-secondary",
};

function DiscordImportNotice({ discordMsgUrl }: { discordMsgUrl: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="bg-discord/15 rounded-card flex size-16 items-center justify-center">
        <DiscordGlyph className="text-discord size-8" />
      </div>

      <div className="max-w-sm space-y-2">
        <h4 className="text-headline text-label">Imported from Discord</h4>
        <p className="text-callout text-label-secondary mx-auto max-w-[280px]">
          These reactions were synchronized directly from our official{" "}
          <span className="text-discord font-semibold">#ixtwitter</span> Discord channel! Local
          profile directories aren't stored on the website, but you can view all reaction profiles
          directly inside Discord.
        </p>
      </div>

      <Button
        asChild
        size="lg"
        className="bg-discord hover:bg-discord-hover w-full max-w-[260px] text-white"
      >
        <a href={discordMsgUrl} target="_blank" rel="noopener noreferrer">
          <MessageSquare aria-hidden="true" />
          Open original Discord post
        </a>
      </Button>
    </div>
  );
}

function ReactionRow({
  reaction,
  apiDiscordEmojis,
  onAccountClick,
}: {
  reaction: PostReaction;
  apiDiscordEmojis?: Array<{ name: string; url: string }>;
  onAccountClick?: (accountId: string) => void;
}) {
  const { account, reactionType } = reaction;
  const discordUrl = getDiscordEmojiUrl(reactionType, apiDiscordEmojis);
  const ReactionIcon = REACTION_ICONS[reactionType];
  const typeColor = accountTypeColor(account.accountType, "text-label-secondary bg-fill-4");
  const openAccount = account.isDiscordUser ? undefined : () => onAccountClick?.(account.id);

  return (
    <div className="hover:bg-fill-4 rounded-row mb-2 flex items-center gap-3 p-2 transition-colors">
      <button
        type="button"
        onClick={openAccount}
        className={cn("shrink-0 transition-transform", account.isDiscordUser && "cursor-default")}
        disabled={!!account.isDiscordUser}
      >
        <Avatar className="border-separator size-10 border">
          <AvatarImage src={account.profileImageUrl || undefined} />
          <AvatarFallback className={cn("text-caption", typeColor)}>
            {getInitials(account.displayName)}
          </AvatarFallback>
        </Avatar>
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAccount}
            className={cn(
              "text-headline text-label truncate text-left transition-colors",
              account.isDiscordUser ? "cursor-default" : "hover:text-tint hover:underline"
            )}
            disabled={!!account.isDiscordUser}
          >
            {account.displayName}
          </button>
          {account.verified && (
            <span
              className="text-footnote inline-flex size-4 shrink-0 items-center justify-center leading-none"
              title="Verified"
            >
              ✅
            </span>
          )}
          {account.bio?.startsWith("Former Nation") && (
            <span className="text-footnote text-label-secondary shrink-0">[Former Nation]</span>
          )}
          {account.isDiscordUser ? (
            <Badge className="bg-discord/15 text-discord" variant="secondary">
              <DiscordGlyph />
              <span>Discord</span>
            </Badge>
          ) : (
            <span
              className={cn(
                "rounded-control-sm flex shrink-0 items-center justify-center p-0.5",
                typeColor
              )}
            >
              <AccountTypeIcon type={account.accountType} className="size-3.5" />
            </span>
          )}
        </div>
        <p className="text-footnote text-label-secondary truncate text-left">@{account.username}</p>
      </div>

      {discordUrl ? (
        <div className="bg-fill-3 rounded-full p-2">
          <img src={discordUrl} alt={reactionType} className="size-4 object-contain" />
        </div>
      ) : ReactionIcon ? (
        <div className={cn("bg-fill-3 rounded-full p-2", REACTION_COLORS[reactionType])}>
          <ReactionIcon className="size-4" />
        </div>
      ) : (
        <Badge variant="default">{reactionType}</Badge>
      )}
    </div>
  );
}

export function ReactionsDialog({
  postId,
  isOpen,
  onClose,
  onAccountClick,
  discordMsgId,
}: ReactionsDialogProps) {
  const [selectedTab, setSelectedTab] = React.useState<string>("all");

  const { data: allReactions, isLoading } = api.thinkpages.getPostReactions.useQuery(
    { postId },
    { enabled: isOpen }
  );

  const { data: discordEmojisData } = api.thinkpages.getDiscordEmojis.useQuery(
    {},
    { enabled: isOpen, staleTime: 5 * 60_000 }
  );
  const apiDiscordEmojis = discordEmojisData?.emojis;

  const reactionsByType = (allReactions ?? []).reduce<Record<string, PostReaction[]>>(
    (acc, reaction: PostReaction) => {
      (acc[reaction.reactionType] ??= []).push(reaction);
      return acc;
    },
    {}
  );
  const filteredReactions: PostReaction[] =
    selectedTab === "all" ? (allReactions ?? []) : (reactionsByType[selectedTab] ?? []);

  const discordMsgUrl = discordMsgId
    ? `https://discord.com/channels/552179975769161729/557223534418722818/${discordMsgId}`
    : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[580px] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-separator border-b px-6 py-4 text-left">
          <DialogTitle className="text-title-3">Post activity</DialogTitle>
          <DialogDescription>View interactions and reactions</DialogDescription>
        </DialogHeader>

        {discordMsgUrl && !allReactions?.length && !isLoading ? (
          <DiscordImportNotice discordMsgUrl={discordMsgUrl} />
        ) : (
          <>
            <ToggleGroup
              type="single"
              variant="pill"
              size="sm"
              aria-label="Filter reactions"
              value={selectedTab}
              onValueChange={(value) => setSelectedTab(value || "all")}
              className="border-separator flex scrollbar-none items-center gap-2 overflow-x-auto border-b px-4 py-2"
            >
              <ToggleGroupItem value="all" className="tabular-nums">
                All ({allReactions?.length || 0})
              </ToggleGroupItem>
              {Object.entries(reactionsByType).map(([type, reactions]) => {
                const discordUrl = getDiscordEmojiUrl(type, apiDiscordEmojis);
                const Icon = REACTION_ICONS[type];

                return (
                  <ToggleGroupItem key={type} value={type} className="tabular-nums">
                    {discordUrl ? (
                      <img src={discordUrl} alt={type} className="size-3.5 object-contain" />
                    ) : Icon ? (
                      <Icon
                        className={cn("size-3.5", selectedTab !== type && REACTION_COLORS[type])}
                        aria-label={type}
                      />
                    ) : (
                      <span>{type}</span>
                    )}
                    <span>{reactions.length}</span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>

            <div className="flex-1 p-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16">
                  <Loader2
                    className="text-label-secondary size-6 animate-spin"
                    aria-hidden="true"
                  />
                  <span className="text-footnote text-label-secondary">Loading reactions...</span>
                </div>
              ) : filteredReactions.length === 0 ? (
                <EmptyState compact icon={<Heart />} title="No local reactions yet" />
              ) : (
                <Virtuoso
                  style={{ height: 350 }}
                  data={filteredReactions}
                  overscan={50}
                  itemContent={(_index, reaction: PostReaction) => (
                    <ReactionRow
                      reaction={reaction}
                      apiDiscordEmojis={apiDiscordEmojis}
                      onAccountClick={onAccountClick}
                    />
                  )}
                />
              )}
            </div>

            {discordMsgUrl && (
              <div className="border-separator border-t p-3 text-center">
                <a
                  href={discordMsgUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-caption text-discord hover:text-discord-hover inline-flex items-center justify-center gap-2 transition-colors hover:underline"
                >
                  <MessageSquare className="size-3.5" aria-hidden="true" />
                  Open original conversation in Discord
                </a>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DiscordGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 127.14 96.36" aria-hidden="true">
      <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.19,77.19,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.19,77.19,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.5-5c.87-.64,1.71-1.32,2.51-2a75.46,75.46,0,0,0,73,0c.8.7,1.64,1.38,2.51,2a68.43,68.43,0,0,1-10.5,5,77.7,77.7,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.58-18.83C129.24,48.72,123.36,25.9,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.88,46,53.7,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.12,46,95.94,53,91,65.69,84.69,65.69Z" />
    </svg>
  );
}
