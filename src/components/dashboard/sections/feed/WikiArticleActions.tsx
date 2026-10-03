"use client";

import { useMemo, useState, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  Bookmark as BookmarkCheck,
  EditPencil as Edit,
  SystemRestart as Loader2,
  Heart,
  Refresh as Repeat2,
  ShareAndroid,
  Check,
  Trash,
  Xmark as X,
} from "iconoir-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { cn } from "~/lib/utils";
import { RepostModal } from "~/components/thinkpages/RepostModal";
import { ActionPill } from "~/components/ui/action-pill";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { springSmooth, tweenExit } from "~/lib/design/motion";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";

const QUICK_REACTIONS = ["❤️", "🔥", "👏", "💡", "🤯", "🚀"];

interface WikiArticleActionsProps {
  /** The article title, already decoded (spaces, not underscores). */
  title: string;
  /** Rendered at the end of the toolbar row (e.g. an "Open in Wiki" button). */
  trailing?: ReactNode;
}

/**
 * The social action toolbar under a wiki article in the feed — Margin note, Repost to ThinkPages,
 * Like/react, Save to Stash, Share — plus the inline Margin composer and the repost dialog it
 * opens. Shared by `WikiFeedCard` and `InlineWikiArticlePreview`; each action is an `ActionPill`.
 */
export function WikiArticleActions({ title: cleanTitle, trailing }: WikiArticleActionsProps) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const wikiHref = titleToWikiOSRoute(cleanTitle);
  const marginHref = `${wikiHref}?modal=margin`;

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: stashData } = api.wikios.isStashed.useQuery(
    { pageTitle: cleanTitle },
    { enabled: !!user, retry: false, staleTime: 10_000 }
  );
  const { data: userStashes = [] } = api.wikios.getStashes.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: discussionsData } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 60_000 }
  );
  const marginThreadsCount = (discussionsData as any)?.threads?.length ?? 0;

  const { data: accounts = [] } = api.thinkpages.getMyAccounts.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
  });
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user,
    staleTime: 60_000,
  });

  // ─── State ───────────────────────────────────────────────────────────────────
  const [isStashPopoverOpen, setIsStashPopoverOpen] = useState(false);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [marginNote, setMarginNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isReactionOpen, setIsReactionOpen] = useState(false);
  const [isRepostOpen, setIsRepostOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localLikes, setLocalLikes] = useState(0);
  const [hasLiked, setHasLiked] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);

  const hoverStashTimer = useRef<NodeJS.Timeout | null>(null);

  const isStashed = stashData?.stashed ?? false;
  const stashedIn = useMemo(() => stashData?.stashes ?? [], [stashData?.stashes]);

  // ─── Stash Mutations ─────────────────────────────────────────────────────────
  const stashMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      utils.wikios.isStashed.invalidate({ pageTitle: cleanTitle });
      utils.wikios.getStashes.invalidate();
      notify.success(`Saved "${cleanTitle}" to Lore Stash`);
    },
    onError: (err) => notify.error(err.message || "Failed to stash article"),
  });

  const unstashMutation = api.wikios.unstashPage.useMutation({
    onSuccess: () => {
      utils.wikios.isStashed.invalidate({ pageTitle: cleanTitle });
      utils.wikios.getStashes.invalidate();
      notify.success(`Removed "${cleanTitle}" from Lore Stash`);
    },
    onError: (err) => notify.error(err.message || "Failed to remove from stash"),
  });

  const isPendingStash = stashMutation.isPending || unstashMutation.isPending;

  const handleToggleSpecificStash = useCallback(
    (stashId: string) => {
      if (!user) {
        notify.error("Sign in to save to a stash.");
        return;
      }
      const inThisStash = stashedIn.some((s: any) => s.id === stashId);
      if (inThisStash) {
        unstashMutation.mutate({ pageTitle: cleanTitle, stashId });
      } else {
        stashMutation.mutate({ pageTitle: cleanTitle, stashId });
      }
    },
    [user, stashedIn, cleanTitle, stashMutation, unstashMutation, notify]
  );

  const handleMainStashClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) {
        notify.error("Sign in to save to a stash.");
        return;
      }
      if (isStashed) {
        setIsStashPopoverOpen((v) => !v);
      } else {
        stashMutation.mutate({ pageTitle: cleanTitle });
      }
    },
    [user, isStashed, cleanTitle, stashMutation, notify]
  );

  // ─── Margin Note Mutation ────────────────────────────────────────────────────
  const createThreadMutation = api.wikios.createThread.useMutation({
    onSuccess: () => {
      setIsSubmittingNote(false);
      setMarginNote("");
      setIsMarginOpen(false);
      utils.wikios.getArticleMarginData.invalidate({ articleTitle: cleanTitle });
      notify.success("Note added to Margin");
    },
    onError: (err) => {
      setIsSubmittingNote(false);
      notify.error(err.message || "Failed to post Margin note");
    },
  });

  const handleSubmitMarginNote = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) {
        notify.error("Sign in to post Margin notes.");
        return;
      }
      if (!marginNote.trim() || isSubmittingNote) return;

      setIsSubmittingNote(true);
      createThreadMutation.mutate({
        articleTitle: cleanTitle,
        title: `Note on ${cleanTitle}`,
        content: marginNote.trim(),
      });
    },
    [user, marginNote, isSubmittingNote, cleanTitle, createThreadMutation, notify]
  );

  // ─── Post Actions (Share / Like / Reaction) ──────────────────────────────────
  const handleShare = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const fullUrl =
        typeof window !== "undefined" ? `${window.location.origin}${wikiHref}` : wikiHref;

      if (typeof navigator !== "undefined" && navigator.share) {
        try {
          await navigator.share({
            title: cleanTitle,
            text: `Check out ${cleanTitle} on IxWiki`,
            url: fullUrl,
          });
          return;
        } catch {
          // Fall through to clipboard
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(fullUrl);
        setCopied(true);
        notify.success("Link copied");
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [cleanTitle, wikiHref, notify]
  );

  const handleToggleLike = useCallback(() => {
    if (hasLiked) {
      setHasLiked(false);
      setLocalLikes((prev) => Math.max(0, prev - 1));
      setSelectedEmoji(null);
    } else {
      setHasLiked(true);
      setLocalLikes((prev) => prev + 1);
      setSelectedEmoji("❤️");
    }
  }, [hasLiked]);

  const handleSelectReactionEmoji = useCallback(
    (emoji: string) => {
      setSelectedEmoji(emoji);
      setHasLiked(true);
      setLocalLikes((prev) => (hasLiked ? prev : prev + 1));
      setIsReactionOpen(false);
    },
    [hasLiked]
  );

  return (
    <>
      {/* ── Action toolbar ── */}
      <div className="border-separator mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Margin note */}
          <ActionPill
            pressed={isMarginOpen}
            icon={<Edit />}
            count={
              marginThreadsCount > 0 ? (
                <Badge variant="secondary" className="tabular-nums">
                  {marginThreadsCount}
                </Badge>
              ) : null
            }
            onClick={() => setIsMarginOpen((v) => !v)}
            title="Leave a note or comment on Margin"
          >
            Margin
          </ActionPill>

          {/* Repost to ThinkPages */}
          <ActionPill
            icon={<Repeat2 />}
            onClick={() => setIsRepostOpen(true)}
            title="Repost to ThinkPages feed"
          >
            Repost
          </ActionPill>

          {/* Like & emoji reaction */}
          <Popover open={isReactionOpen} onOpenChange={setIsReactionOpen}>
            <PopoverTrigger asChild>
              <ActionPill
                pressed={hasLiked}
                tone="destructive"
                icon={
                  selectedEmoji ? (
                    <span className="text-footnote">{selectedEmoji}</span>
                  ) : (
                    <Heart className={cn(hasLiked && "fill-current")} />
                  )
                }
                count={localLikes > 0 ? localLikes : null}
                onClick={handleToggleLike}
                title="React or like this article"
              >
                <span className="sr-only">Like</span>
              </ActionPill>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-auto rounded-full p-1">
              <div className="flex items-center gap-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectReactionEmoji(emoji)}
                    aria-label={`React ${emoji}`}
                    className="hover:bg-fill-3 text-body focus-visible:outline-tint flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors select-none focus-visible:outline-2"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Save to stash */}
          <Popover open={isStashPopoverOpen} onOpenChange={setIsStashPopoverOpen}>
            <PopoverTrigger asChild>
              <ActionPill
                pressed={isStashed}
                icon={
                  isPendingStash ? (
                    <Loader2 className="animate-spin" />
                  ) : isStashed ? (
                    <BookmarkCheck className="fill-current" />
                  ) : (
                    <Bookmark />
                  )
                }
                onClick={handleMainStashClick}
                onMouseEnter={() => {
                  if (hoverStashTimer.current) clearTimeout(hoverStashTimer.current);
                  hoverStashTimer.current = setTimeout(() => setIsStashPopoverOpen(true), 350);
                }}
                onMouseLeave={() => {
                  if (hoverStashTimer.current) clearTimeout(hoverStashTimer.current);
                }}
                disabled={isPendingStash}
                title={isStashed ? "Manage stashes" : "Save to Stash"}
              >
                {isStashed ? "Saved" : "Save to Stash"}
              </ActionPill>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-3">
              <div className="text-footnote space-y-2">
                <div className="border-separator flex items-center justify-between border-b pb-2">
                  <span className="text-label text-headline flex items-center gap-2">
                    <Bookmark aria-hidden className="text-label-secondary size-4" />
                    Lore stash
                  </span>
                  <Link
                    href="/stashes"
                    className="text-tint text-footnote underline-offset-2 hover:underline"
                  >
                    View all
                  </Link>
                </div>

                {userStashes.length === 0 ? (
                  <p className="text-label-secondary text-footnote py-1">
                    You have no custom stashes. Saving an article creates your default stash.
                  </p>
                ) : (
                  <FacetList variant="plain" className="max-h-48 overflow-y-auto">
                    <FacetListSection aria-label="Your stashes">
                      {userStashes.map((stash: any) => (
                        <FacetRow
                          key={stash.id}
                          onClick={() => handleToggleSpecificStash(stash.id)}
                          accessory="check"
                          selected={stashedIn.some((s: any) => s.id === stash.id)}
                          leading={
                            <span
                              aria-hidden
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: stash.color || "var(--color-info)" }}
                            />
                          }
                          title={stash.name}
                        />
                      ))}
                    </FacetListSection>
                  </FacetList>
                )}

                {isStashed && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive w-full justify-start"
                    onClick={() => {
                      unstashMutation.mutate({ pageTitle: cleanTitle });
                      setIsStashPopoverOpen(false);
                    }}
                  >
                    <Trash aria-hidden />
                    <span>Remove from all stashes</span>
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Share */}
          <ActionPill
            icon={copied ? <Check className="text-success" /> : <ShareAndroid />}
            onClick={handleShare}
            title="Share article link"
          >
            {copied ? "Copied" : "Share"}
          </ActionPill>
        </div>

        {trailing}
      </div>

      {/* ── Inline margin note composer ── */}
      <AnimatePresence>
        {isMarginOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: tweenExit }}
            transition={springSmooth}
            className="overflow-hidden"
          >
            <form
              onSubmit={handleSubmitMarginNote}
              className="bg-surface-secondary rounded-row mt-3 space-y-2 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-subhead text-label flex items-center gap-2">
                  <Edit aria-hidden className="text-label-secondary size-4" />
                  Add a Margin note
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={marginHref}
                    className="text-tint text-footnote underline-offset-2 hover:underline"
                  >
                    Open Margin reader
                  </Link>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setIsMarginOpen(false)}
                    aria-label="Close margin note"
                  >
                    <X />
                  </Button>
                </div>
              </div>

              <Textarea
                value={marginNote}
                onChange={(e) => setMarginNote(e.target.value)}
                placeholder={`Add a note on ${cleanTitle}`}
                aria-label="Margin note"
                rows={2}
                autoFocus
                className="resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsMarginOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  disabled={!marginNote.trim() || isSubmittingNote}
                >
                  {isSubmittingNote ? <Loader2 aria-hidden className="animate-spin" /> : null}
                  <span>Post note</span>
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Repost dialog ── */}
      {isRepostOpen && (
        <RepostModal
          open={isRepostOpen}
          onOpenChange={setIsRepostOpen}
          originalPost={{
            id: `wiki-${cleanTitle}`,
            content: `[blurb:wiki/${encodeURIComponent(cleanTitle.replace(/ /g, "_"))}|${cleanTitle}]\n\nExplore the latest encyclopedia updates on ${cleanTitle}.`,
            author: { name: "WikiOS", username: "wikios" },
            title: cleanTitle,
          }}
          countryId={userProfile?.countryId ?? ""}
          selectedAccount={accounts[0] || null}
          accounts={accounts}
          isOwner={true}
          onPost={() => setIsRepostOpen(false)}
        />
      )}
    </>
  );
}
