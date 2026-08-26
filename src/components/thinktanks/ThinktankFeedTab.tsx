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
  const { data: feedData, isLoading: isLoadingFeed } =
    api.thinkpages.getGroupFeed.useQuery(
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
          "mx-auto max-w-3xl space-y-6 p-4 md:p-6 transition-all duration-300",
          !isMember && "select-none pointer-events-none filter blur-[5px] opacity-40"
        )}
      >
        {/* ── Group Feed Composer ── */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-4 shadow-lg backdrop-blur-xl transition-all dark:border-white/10 dark:bg-white/[0.03]">
          <form onSubmit={handlePublish} className="space-y-3">
            {/* Multi-Persona Selector Chips */}
            {allowPersonaPosting && accounts.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-border/30">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mr-1">
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
              className="min-h-[90px] resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
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
                  className="rounded-md border border-border/40 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-all"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Media URL Row */}
            {showMediaInput && (
              <div className="flex items-center gap-2 rounded-xl bg-muted/40 px-3 py-1.5 border border-border/40">
                <MediaImage className="h-4 w-4 text-muted-foreground" />
                <input
                  type="url"
                  placeholder="Paste image or media URL..."
                  value={mediaUrlInput}
                  onChange={(e) => setMediaUrlInput(e.target.value)}
                  className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            )}

            {/* Composer Action Toolbar */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
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
                    showMediaInput ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MediaImage className="mr-1.5 h-3.5 w-3.5" />
                  Media
                </Button>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground">
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
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 animate-pulse">
                <span className="h-4 w-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
              </div>
              <p className="text-xs font-medium text-muted-foreground">Loading group timeline...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
                <RssFeed className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">No Notes or Updates Yet</h3>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
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
                : realUser?.country?.name || realUser?.forumUsername || realUser?.wikiUsername || personaAccount?.displayName || "Member";

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
                  className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-4.5 shadow-sm backdrop-blur-xl transition-all duration-200 hover:border-border/80 dark:border-white/10 dark:bg-white/[0.02]"
                >
                  {/* Author row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-muted font-bold text-foreground">
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
                        ) : countryFlag ? (
                          <span className="text-base">{countryFlag}</span>
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-foreground">
                            {displayName}
                          </span>
                          {countryName && (
                            <span className="text-[10px] text-muted-foreground">
                              · {countryFlag && allowPersonaPosting ? `${countryFlag} ` : ""}{countryName}
                            </span>
                          )}
                          {showPersonaBadge && (
                            <Badge
                              variant="outline"
                              className="text-[9px] font-semibold text-purple-600 border-purple-500/30 bg-purple-500/10 dark:text-purple-400"
                            >
                              {personaAccount.accountType}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="mt-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {post.content}
                  </div>

                  {/* Media attachments */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-border/40 bg-black/20">
                      <img
                        src={post.mediaUrls[0]}
                        alt="Post media"
                        className="max-h-96 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="mt-3.5 flex items-center gap-4 border-t border-border/20 pt-2.5 text-muted-foreground">
                    <button
                      onClick={() => soundEffects.press()}
                      className="flex items-center gap-1 text-[11px] hover:text-foreground transition-colors"
                    >
                      <Heart className="h-3.5 w-3.5" />
                      <span>{post.reactions?.length ?? 0}</span>
                    </button>
                    <button
                      onClick={() => soundEffects.press()}
                      className="flex items-center gap-1 text-[11px] hover:text-foreground transition-colors"
                    >
                      <ChatBubble className="h-3.5 w-3.5" />
                      <span>{post.replies?.length ?? 0}</span>
                    </button>
                    <button
                      onClick={() => soundEffects.press()}
                      className="flex items-center gap-1 text-[11px] hover:text-foreground transition-colors"
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
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-background/20 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl border border-border/60 bg-card/85 p-6 md:p-8 text-center shadow-2xl backdrop-blur-2xl dark:border-white/15 dark:bg-card/90"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-xs dark:text-emerald-400">
              <Group className="h-7 w-7" />
            </div>

            <h3 className="mt-4 text-base font-bold text-foreground tracking-tight">
              Join {groupName}
            </h3>

            <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-xs">
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
              className="mt-5 w-full max-w-xs cursor-pointer rounded-xl bg-emerald-600 font-semibold text-white shadow-md hover:bg-emerald-700 active:scale-[0.97] dark:bg-emerald-500 dark:hover:bg-emerald-600 transition-all"
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
