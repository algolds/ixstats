"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import {
  RssFeed,
  Send,
  User,
  MediaImage,
  ChatBubble,
  Heart,
  Repeat,
  Group,
  Plus,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface ThinktankFeedTabProps {
  groupId: string;
  groupName: string;
  allowPersonaPosting?: boolean;
  isMember?: boolean;
  currentUserId: string;
  onJoin?: () => void;
}

export function ThinktankFeedTab({
  groupId,
  groupName,
  allowPersonaPosting = false,
  isMember = true,
  currentUserId,
  onJoin,
}: ThinktankFeedTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [postContent, setPostContent] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);

  // Queries
  const { data: feedData, isLoading: isLoadingFeed } = api.thinkpages.getGroupFeed.useQuery(
    { groupId, limit: 30 },
    { enabled: Boolean(groupId), staleTime: 15000 }
  );

  const { data: myAccountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: Boolean(currentUserId),
  });

  const accounts = myAccountsData ?? [];
  const activeAccountId = selectedAccountId || accounts[0]?.id || "";

  // Join Mutation (for overlay CTA)
  const joinMutation = api.thinkpages.joinThinktank.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Joined group successfully!");
      void utils.thinkpages.getThinktankById.invalidate({ groupId });
      void utils.thinkpages.getThinktanks.invalidate();
      void utils.thinkpages.getGroupFeed.invalidate({ groupId });
      onJoin?.();
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to join group");
    },
  });

  // Post Mutation
  const createPostMutation = api.thinkpages.createGroupPost.useMutation({
    onSuccess: () => {
      soundEffects.success();
      notify.success("Note published to group feed!");
      setPostContent("");
      setMediaUrlInput("");
      setShowMediaInput(false);
      void utils.thinkpages.getGroupFeed.invalidate({ groupId });
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to post note");
    },
  });

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    if (allowPersonaPosting && !activeAccountId) {
      notify.error("Please select a persona account to post.");
      return;
    }

    soundEffects.press();
    createPostMutation.mutate({
      groupId,
      accountId: allowPersonaPosting && activeAccountId ? activeAccountId : undefined,
      content: postContent.trim(),
      mediaUrls: mediaUrlInput.trim() ? [mediaUrlInput.trim()] : undefined,
    });
  };

  const posts = feedData?.posts ?? [];

  return (
    <div className="relative min-h-[550px] w-full">
      {/* ── Main Content / Feed Container (Frosted Blur if not joined) ── */}
      <div
        className={cn(
          "mx-auto max-w-3xl space-y-6 p-4 transition-all duration-300 md:p-6",
          !isMember && "pointer-events-none opacity-40 blur-[5px] filter select-none"
        )}
      >
        {/* ── Group Feed Composer ── */}
        <div className="border-border/50 bg-card/60 overflow-hidden rounded-2xl border p-4 shadow-lg backdrop-blur-xl transition-all dark:border-white/10 dark:bg-white/[0.03]">
          <form onSubmit={handlePublish} className="space-y-3">
            {/* Multi-Persona Selector Chips */}
            {allowPersonaPosting && accounts.length > 0 && (
              <div className="border-border/30 flex flex-wrap items-center gap-1.5 border-b pb-2">
                <span className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] font-semibold">
                  <Group className="h-3 w-3 text-purple-500" /> Post as:
                </span>
                {accounts.map((acc: any) => {
                  const isSelected = (selectedAccountId || accounts[0]?.id) === acc.id;
                  return (
                    <button
                      type="button"
                      key={acc.id}
                      onClick={() => {
                        soundEffects.press();
                        setSelectedAccountId(acc.id);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-150",
                        isSelected
                          ? "bg-emerald-600 text-white shadow-sm dark:bg-emerald-500"
                          : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
                      <span>{acc.displayName || acc.username}</span>
                      <span className="text-[10px] opacity-75">({acc.accountType})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content Textarea */}
            <Textarea
              placeholder={`Share a note, idea, or update with ${groupName}...`}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="placeholder:text-muted-foreground/60 min-h-[90px] resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
            />

            {/* Quick Intent Tag Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {[
                { label: "💡 Note to self", tag: "note-to-self" },
                { label: "🤝 Collaborative", tag: "collaborative" },
                { label: "🔍 Critique wanted", tag: "critique" },
                { label: "🗺️ Lore & Maps", tag: "lore" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.tag}
                  onClick={() => {
                    soundEffects.press();
                    if (!postContent.includes(item.label)) {
                      setPostContent((prev) => `${item.label}\n\n${prev}`.trim());
                    }
                  }}
                  className="border-border/40 bg-muted/30 text-muted-foreground hover:bg-accent/40 hover:text-foreground rounded-md border px-2 py-0.5 text-[10px] font-medium transition-all"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Media URL Row */}
            {showMediaInput && (
              <div className="bg-muted/40 border-border/40 flex items-center gap-2 rounded-xl border px-3 py-1.5">
                <MediaImage className="text-muted-foreground h-4 w-4" />
                <input
                  type="url"
                  placeholder="Paste image or media URL..."
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-xs outline-none"
                />
              </div>
            )}

            {/* Composer Action Toolbar */}
            <div className="border-border/30 flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    soundEffects.press();
                    setShowMediaInput((prev) => !prev);
                  }}
                  className={cn(
                    "h-8 rounded-lg px-2.5 text-xs",
                    showMediaInput
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MediaImage className="mr-1.5 h-3.5 w-3.5" />
                  Media
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-muted-foreground text-[11px]">
                  {postContent.length} / 5000
                </span>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!postContent.trim() || createPostMutation.isPending}
                  className="h-8 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-95 dark:bg-emerald-500 dark:hover:bg-emerald-600"
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {createPostMutation.isPending ? "Posting..." : "Post Note"}
                </Button>
              </div>
            </div>
          </form>
        </div>

        {/* ── Feed Timeline ── */}
        <div className="space-y-4">
          {isLoadingFeed ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
              </div>
              <p className="text-muted-foreground text-xs font-medium">Loading group timeline...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="border-border/60 flex flex-col items-center justify-center rounded-2xl border border-dashed py-16 text-center">
              <div className="bg-muted/60 text-muted-foreground flex h-12 w-12 items-center justify-center rounded-2xl">
                <RssFeed className="h-6 w-6" />
              </div>
              <h3 className="text-foreground mt-3 text-sm font-semibold">
                No Notes or Updates Yet
              </h3>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Be the first to share an idea, note to self, or update in this group.
              </p>
            </div>
          ) : (
            posts.map((post: any) => {
              const personaAccount = post.account;
              const realUser = post.realUser;

              // If multi-persona posting is off, display the real account/user
              const displayName = allowPersonaPosting
                ? personaAccount?.displayName || personaAccount?.username || "Unknown"
                : realUser?.country?.name ||
                  realUser?.forumUsername ||
                  realUser?.wikiUsername ||
                  personaAccount?.displayName ||
                  "Member";

              const countryName = allowPersonaPosting
                ? personaAccount?.country?.name || personaAccount?.countryName
                : realUser?.country?.name || personaAccount?.country?.name;

              const countryFlag = allowPersonaPosting
                ? personaAccount?.country?.flag
                : realUser?.country?.flag || personaAccount?.country?.flag;

              const avatarUrl = allowPersonaPosting
                ? personaAccount?.profileImageUrl || personaAccount?.avatarUrl
                : personaAccount?.profileImageUrl || personaAccount?.avatarUrl;

              const showPersonaBadge =
                allowPersonaPosting &&
                personaAccount?.accountType &&
                personaAccount.accountType.toUpperCase() !== "CITIZEN";

              return (
                <div
                  key={post.id}
                  className="border-border/40 bg-card/60 hover:border-border/80 overflow-hidden rounded-2xl border p-4.5 shadow-sm backdrop-blur-xl transition-all duration-200 dark:border-white/10 dark:bg-white/[0.02]"
                >
                  {/* Author row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="border-border/50 bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border font-bold">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : countryFlag ? (
                          <span className="text-base">{countryFlag}</span>
                        ) : (
                          <User className="text-muted-foreground h-4 w-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground text-xs font-bold">{displayName}</span>
                          {countryName && (
                            <span className="text-muted-foreground text-[10px]">
                              · {countryFlag && allowPersonaPosting ? `${countryFlag} ` : ""}
                              {countryName}
                            </span>
                          )}
                          {showPersonaBadge && (
                            <Badge
                              variant="outline"
                              className="border-purple-500/30 bg-purple-500/10 text-[9px] font-semibold text-purple-600 dark:text-purple-400"
                            >
                              {personaAccount.accountType}
                            </Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground text-[10px]">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="text-foreground/90 mt-3 text-xs leading-relaxed whitespace-pre-wrap">
                    {post.content}
                  </div>

                  {/* Media attachments */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="border-border/40 mt-3 overflow-hidden rounded-xl border bg-black/20">
                      <img
                        src={post.mediaUrls[0]}
                        alt="Post media"
                        className="max-h-96 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="border-border/20 text-muted-foreground mt-3.5 flex items-center gap-4 border-t pt-2.5">
                    <button
                      onClick={() => soundEffects.press()}
                      className="hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      <span>{post.reactions?.length ?? 0}</span>
                    </button>
                    <button
                      onClick={() => soundEffects.press()}
                      className="hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <ChatBubble className="h-3.5 w-3.5" />
                      <span>{post.replies?.length ?? 0}</span>
                    </button>
                    <button
                      onClick={() => soundEffects.press()}
                      className="hover:text-foreground flex items-center gap-1 text-[11px] transition-colors"
                    >
                      <Repeat className="h-3.5 w-3.5" />
                      <span>{post.repostsCount ?? 0}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Floating Frosted Glass Overlay (Apple Design) ── */}
      {!isMember && (
        <div className="bg-background/20 absolute inset-0 z-20 flex items-center justify-center p-4 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="border-border/60 bg-card/85 dark:bg-card/90 flex w-full max-w-md flex-col items-center justify-center rounded-3xl border p-6 text-center shadow-2xl backdrop-blur-2xl md:p-8 dark:border-white/15"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-xs dark:text-emerald-400">
              <Group className="h-7 w-7" />
            </div>

            <h3 className="text-foreground mt-4 text-base font-bold tracking-tight">
              Join {groupName}
            </h3>

            <p className="text-muted-foreground mt-1.5 max-w-xs text-xs leading-relaxed">
              Join this group to post notes, read the full feed, and join the discussion.
            </p>

            <Button
              size="lg"
              disabled={joinMutation.isPending}
              onClick={() => {
                if (!currentUserId) {
                  notify.error("Please sign in to join groups.");
                  return;
                }
                soundEffects.press();
                joinMutation.mutate({ groupId, userId: currentUserId });
              }}
              className="mt-5 w-full max-w-xs cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white shadow-md transition-all hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {joinMutation.isPending ? "Joining Group..." : "Join Group"}
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
