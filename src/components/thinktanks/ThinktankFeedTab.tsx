"use client";

import React, { useState } from "react";
import { springGentle } from "~/lib/design/motion";
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
  Trash,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { EmptyState } from "~/components/ui/empty-state";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";

interface ThinktankFeedTabProps {
  groupId: string;
  groupName: string;
  allowPersonaPosting?: boolean;
  isMember?: boolean;
  /** Whether the caller may read the feed (public group, or a member). */
  canReadFeed?: boolean;
  currentUserId: string;
  onJoin?: () => void;
  /**
   * Shown in place of the composer to non-members of a group anyone may read (a realm board); the feed
   * then stays readable instead of being blurred behind the join overlay.
   */
  readOnlyNotice?: React.ReactNode;
  /** Only offer personas of these countries (a realm board: the caller's nations in the realm). */
  accountCountryIds?: string[];
  /** Group managers (realm-board moderators) may remove posts from the feed. */
  canModerate?: boolean;
}

export function ThinktankFeedTab({
  groupId,
  groupName,
  allowPersonaPosting = false,
  isMember = true,
  canReadFeed = true,
  currentUserId,
  onJoin,
  readOnlyNotice,
  accountCountryIds,
  canModerate = false,
}: ThinktankFeedTabProps) {
  const notify = useNotify();
  const utils = api.useUtils();

  const [postContent, setPostContent] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);
  /** The post awaiting the moderator's removal confirmation (AlertDialog, spec §7.3). */
  const [pendingRemovePostId, setPendingRemovePostId] = useState<string | null>(null);

  // Queries
  const { data: feedData, isLoading: isLoadingFeed } = api.thinkpages.getGroupFeed.useQuery(
    { groupId, limit: 30 },
    { enabled: Boolean(groupId) && canReadFeed, staleTime: 15000 }
  );

  const { data: myAccountsData } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: Boolean(currentUserId),
  });

  const accounts = (myAccountsData ?? []).filter(
    (acc: any) => !accountCountryIds || accountCountryIds.includes(acc.countryId)
  );
  const readOnly = !isMember && readOnlyNotice !== undefined;
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

  const removePostMutation = api.thinkpages.removeGroupPost.useMutation({
    onSuccess: () => {
      soundEffects.release();
      notify.success("Post removed from the feed.");
      void utils.thinkpages.getGroupFeed.invalidate({ groupId });
    },
    onError: (err) => {
      soundEffects.error();
      notify.error(err.message || "Failed to remove post");
    },
  });

  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postContent.trim()) return;

    // A realm board without a persona of the realm falls back to "post as yourself" on the server.
    if (allowPersonaPosting && !activeAccountId && !accountCountryIds) {
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
          "mx-auto max-w-3xl space-y-6 p-4 transition-[opacity,filter] duration-300 md:p-6",
          !isMember && !readOnly && "pointer-events-none opacity-40 blur-[5px] filter select-none"
        )}
      >
        {readOnly && (
          <div className="bg-surface-secondary text-callout text-label-secondary rounded-row p-4">
            {readOnlyNotice}
          </div>
        )}

        {/* ── Group Feed Composer ── */}
        {!readOnly && (
          <div className="border-separator bg-surface rounded-card shadow-card overflow-hidden border p-4">
            <form onSubmit={handlePublish} className="space-y-3">
              {/* Multi-Persona Selector Chips */}
              {allowPersonaPosting && accounts.length > 0 && (
                <div className="border-separator flex flex-wrap items-center gap-2 border-b pb-2">
                  <span className="text-footnote text-label-secondary mr-1 flex items-center gap-1">
                    <Group className="size-3.5" aria-hidden="true" /> Post as:
                  </span>
                  <ToggleGroup
                    type="single"
                    aria-label="Post as"
                    variant="pill"
                    size="sm"
                    disallowEmpty
                    value={selectedAccountId || accounts[0]?.id}
                    onValueChange={(id) => {
                      if (id) setSelectedAccountId(id);
                    }}
                  >
                    {accounts.map((acc: any) => (
                      <ToggleGroupItem key={acc.id} value={acc.id} className="gap-1">
                        <span className="size-2 rounded-full bg-current" aria-hidden="true" />
                        <span>{acc.displayName || acc.username}</span>
                        <span className="text-label-secondary">({acc.accountType})</span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
              )}

              {/* Content Textarea */}
              <Textarea
                placeholder={`Share a note, idea, or update with ${groupName}...`}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                className="min-h-[90px] resize-none border-0 bg-transparent p-1 shadow-none"
              />

              {/* Quick Intent Tag Presets */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { label: "💡 Note to self", tag: "note-to-self" },
                  { label: "🤝 Collaborative", tag: "collaborative" },
                  { label: "🔍 Critique wanted", tag: "critique" },
                  { label: "🗺️ Lore & Maps", tag: "lore" },
                ].map((item) => (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    key={item.tag}
                    onClick={() => {
                      if (!postContent.includes(item.label)) {
                        setPostContent((prev) => `${item.label}\n\n${prev}`.trim());
                      }
                    }}
                    className="rounded-full"
                  >
                    {item.label}
                  </Button>
                ))}
              </div>

              {/* Media URL Row */}
              {showMediaInput && (
                <div className="bg-fill-4 border-separator rounded-row flex items-center gap-2 border px-3 py-2">
                  <MediaImage className="text-label-secondary h-4 w-4" />
                  <input
                    type="url"
                    placeholder="Paste image or media URL..."
                    value={mediaUrlInput}
                    onChange={(e) => setMediaUrlInput(e.target.value)}
                    className="text-label placeholder:text-label-secondary text-footnote w-full bg-transparent outline-none"
                  />
                </div>
              )}

              {/* Composer Action Toolbar */}
              <div className="border-separator flex items-center justify-between border-t pt-2">
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
                      "rounded-control text-footnote h-8 px-3",
                      showMediaInput
                        ? "bg-fill-3 text-label"
                        : "text-label-secondary hover:text-label"
                    )}
                  >
                    <MediaImage />
                    Media
                  </Button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-label-secondary text-footnote">
                    {postContent.length} / 5000
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!postContent.trim() || createPostMutation.isPending}
                  >
                    <Send />
                    {createPostMutation.isPending ? "Posting..." : "Post Note"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ── Feed Timeline ── */}
        <div className="space-y-4">
          {isLoadingFeed ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <span className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
              <p className="text-footnote text-label-secondary">Loading group timeline...</p>
            </div>
          ) : posts.length === 0 ? (
            <FacetCard>
              <EmptyState
                icon={<RssFeed />}
                title="No Notes or Updates Yet"
                message="Be the first to share an idea, note to self, or update in this group."
              />
            </FacetCard>
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
                  className="border-separator bg-surface rounded-card shadow-card overflow-hidden border p-4"
                >
                  {/* Author row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="border-separator bg-fill-3 text-label rounded-control flex size-9 shrink-0 items-center justify-center overflow-hidden border">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="h-full w-full object-cover"
                          />
                        ) : countryFlag ? (
                          <span className="text-body">{countryFlag}</span>
                        ) : (
                          <User className="text-label-secondary size-4" aria-hidden="true" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-headline text-label">{displayName}</span>
                          {countryName && (
                            <span className="text-label-secondary text-footnote">
                              · {countryFlag && allowPersonaPosting ? `${countryFlag} ` : ""}
                              {countryName}
                            </span>
                          )}
                          {showPersonaBadge && (
                            <Badge variant="info">{personaAccount.accountType}</Badge>
                          )}
                        </div>
                        <span className="text-label-secondary text-footnote">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="text-body text-label mt-3 whitespace-pre-wrap">
                    {post.content}
                  </div>

                  {/* Media attachments */}
                  {post.mediaUrls && post.mediaUrls.length > 0 && (
                    <div className="border-separator bg-fill-3 rounded-row mt-3 overflow-hidden border">
                      <img
                        src={post.mediaUrls[0]}
                        alt="Post media"
                        className="max-h-96 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}

                  {/* Actions Footer */}
                  <div className="border-separator text-footnote text-label-secondary mt-3 flex items-center gap-4 border-t pt-2 tabular-nums">
                    {/* Engagement counts (read-only here; react from the full post view). */}
                    <span className="flex items-center gap-1">
                      <Heart className="size-3.5" aria-hidden="true" />
                      <span>{post.reactions?.length ?? 0}</span>
                      <span className="sr-only">reactions</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <ChatBubble className="size-3.5" aria-hidden="true" />
                      <span>{post.replies?.length ?? 0}</span>
                      <span className="sr-only">replies</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Repeat className="size-3.5" aria-hidden="true" />
                      <span>{post.repostsCount ?? 0}</span>
                      <span className="sr-only">reposts</span>
                    </span>
                    {canModerate && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={removePostMutation.isPending}
                        onClick={() => setPendingRemovePostId(post.id)}
                        className="text-label-secondary hover:text-destructive ml-auto"
                      >
                        <Trash aria-hidden="true" />
                        <span>Remove</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <AlertDialog
        open={pendingRemovePostId !== null}
        onOpenChange={(open) => !open && setPendingRemovePostId(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this post from the feed?</AlertDialogTitle>
            <AlertDialogDescription>Members will no longer see it.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingRemovePostId) {
                  removePostMutation.mutate({ groupId, postId: pendingRemovePostId });
                }
                setPendingRemovePostId(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Floating Frosted Glass Overlay (Apple Design) ── */}
      {!isMember && !readOnly && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={springGentle}
            className="border-separator bg-surface-elevated rounded-card shadow-floating flex w-full max-w-md flex-col items-center justify-center border p-6 text-center md:p-8"
          >
            <div className="bg-tint-fill text-tint rounded-card flex size-14 items-center justify-center">
              <Group className="size-7" aria-hidden="true" />
            </div>

            <h3 className="text-title-3 text-label mt-4">Join {groupName}</h3>

            <p className="text-callout text-label-secondary mt-2 max-w-xs">
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
                joinMutation.mutate({ groupId });
              }}
              className="mt-5 w-full max-w-xs"
            >
              <Plus />
              {joinMutation.isPending ? "Joining Group..." : "Join Group"}
            </Button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
