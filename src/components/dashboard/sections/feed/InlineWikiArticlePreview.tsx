"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  BookmarkSolid as BookmarkCheck,
  EditPencil as Edit,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  Heart,
  Refresh as Repeat2,
  ShareAndroid as Share,
  Check,
  Trash,
  Xmark as X,
} from "iconoir-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import {
  normalizeWikiImageUrl,
  extractLeadImageFromWikitext,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";
import { cn } from "~/lib/utils";
import { RepostModal } from "~/components/thinkpages/RepostModal";

export { parseWikitextToHtml };

const QUICK_REACTIONS = ["❤️", "🔥", "👏", "💡", "🤯", "🚀"];

export function InlineWikiArticlePreview({
  title,
  wiki = "ixwiki",
}: {
  title: string;
  wiki?: "ixwiki" | "iiwiki";
}) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const cleanTitle = useMemo(() => {
    try {
      return decodeURIComponent(title).replace(/_/g, " ").trim();
    } catch {
      return title.replace(/_/g, " ").trim();
    }
  }, [title]);

  // ─── Queries ─────────────────────────────────────────────────────────────────
  // Article text intro
  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  // Eligible article images
  const { data: pageImages } = api.wikios.getPageImages.useQuery(
    { title: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  // Stash status & user stashes
  const { data: stashData } = api.wikios.isStashed.useQuery(
    { pageTitle: cleanTitle },
    { enabled: !!user, retry: false, staleTime: 10_000 }
  );
  const { data: userStashes = [] } = api.wikios.getStashes.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });

  // Margin discussion count
  const { data: discussionsData } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 60_000 }
  );
  const marginThreadsCount = (discussionsData as any)?.threads?.length ?? 0;

  // Thinkpages accounts for repost modal
  const { data: accounts = [] } = api.thinkpages.getMyAccounts.useQuery(undefined, {
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
        notify.error("Please sign in to save to Stash.");
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
        notify.error("Please sign in to save to Stash.");
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
      notify.success("Note added to Margin!");
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
        notify.error("Please sign in to post Margin notes.");
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
      const wikiHref = titleToWikiOSRoute(cleanTitle);
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
        notify.success("Article link copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      }
    },
    [cleanTitle, notify]
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

  const formattedHtml = useMemo(() => {
    const raw = intro?.text || intro?.intro || "";
    if (!raw) return "";
    return parseWikitextToHtml(raw, wiki);
  }, [intro?.text, intro?.intro, wiki]);

  const leadImage = useMemo(() => {
    // 1. Check pageImages from API query
    if (pageImages && Array.isArray(pageImages) && pageImages.length > 0) {
      const eligible =
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl) &&
            !img.title?.toLowerCase().endsWith(".svg") &&
            !img.title?.toLowerCase().includes("flag") &&
            !img.title?.toLowerCase().includes("icon")
        ) ||
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl)
        ) ||
        pageImages[0];

      const rawUrl = eligible?.thumbUrl || eligible?.url || null;
      if (rawUrl) {
        const normalized = normalizeWikiImageUrl(rawUrl);
        if (normalized) return normalized;
      }
    }

    // 2. Fallback: extract genuine lead image from raw wikitext / intro text
    const rawText = intro?.text || intro?.intro || "";
    if (rawText) {
      const fromWikitext = extractLeadImageFromWikitext(rawText);
      if (fromWikitext) {
        const normalized = normalizeWikiImageUrl(fromWikitext);
        if (normalized) return normalized;
      }
      const fromHtml = extractLeadImageFromHtml(rawText);
      if (fromHtml) {
        const normalized = normalizeWikiImageUrl(fromHtml);
        if (normalized) return normalized;
      }
    }

    return null;
  }, [pageImages, intro?.text, intro?.intro]);

  if (!formattedHtml && !leadImage) return null;

  const wikiHref = titleToWikiOSRoute(cleanTitle);
  const marginHref = `${titleToWikiOSRoute(cleanTitle)}?modal=margin`;

  return (
    <div className="group/preview mt-2.5 overflow-hidden rounded-2xl border border-teal-500/20 bg-teal-500/[0.04] p-3.5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-teal-500/35 hover:bg-teal-500/[0.07] sm:p-4 dark:bg-teal-500/[0.04] dark:hover:bg-teal-500/[0.08]">
      {/* Content & Lead Image Row */}
      <div className="flex items-start gap-3.5">
        <div className="min-w-0 flex-1 space-y-1">
          {formattedHtml && (
            <WikiHtmlContent
              html={formattedHtml}
              className="text-foreground/85 group-hover/preview:text-foreground line-clamp-3 text-xs leading-relaxed font-normal tracking-tight sm:text-[13px] [&_a]:transition-colors"
            />
          )}
        </div>

        {/* Lead Image Thumbnail */}
        {leadImage && (
          <Link
            href={wikiHref}
            className="border-border/40 relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border bg-black/5 shadow-xs transition-transform duration-200 group-hover/preview:scale-[1.02] active:scale-95 sm:h-22 sm:w-32 dark:border-white/10 dark:bg-white/5"
            title={`View ${cleanTitle}`}
          >
            <img
              src={leadImage}
              alt={cleanTitle}
              className="h-full w-full object-cover transition-transform duration-300 group-hover/preview:scale-105"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </Link>
        )}
      </div>

      {/* ── Action Toolbar Row ── */}
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-teal-500/15 pt-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {/* 1. Margin Note / Comment Button */}
          <button
            type="button"
            onClick={() => setIsMarginOpen((v) => !v)}
            className={cn(
              "group inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none active:scale-95",
              isMarginOpen
                ? "bg-yellow-400/20 font-semibold text-yellow-600 ring-1 ring-yellow-400/40 dark:text-yellow-400"
                : "text-muted-foreground hover:bg-yellow-400/15 hover:text-yellow-600 dark:hover:text-yellow-400"
            )}
            title="Leave a note or comment on Margin"
          >
            <Edit className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            <span>Margin</span>
            {marginThreadsCount > 0 && (
              <span className="py-0.2 rounded-full bg-yellow-400/25 px-1.5 text-[10px] font-bold text-yellow-700 dark:text-yellow-300">
                {marginThreadsCount}
              </span>
            )}
          </button>

          {/* 2. Repost to ThinkPages Feed */}
          <button
            type="button"
            onClick={() => setIsRepostOpen(true)}
            className="group text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none hover:bg-emerald-500/10 hover:text-emerald-500 active:scale-95"
            title="Repost to ThinkPages feed"
          >
            <Repeat2 className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            <span>Repost</span>
          </button>

          {/* 3. Like & Emoji Reaction Button */}
          <Popover open={isReactionOpen} onOpenChange={setIsReactionOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleToggleLike}
                className={cn(
                  "group inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none active:scale-95",
                  hasLiked
                    ? "bg-rose-500/15 font-semibold text-rose-500"
                    : "text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
                )}
                title="React or like this article"
              >
                {selectedEmoji ? (
                  <span className="text-xs transition-transform group-hover:scale-125">
                    {selectedEmoji}
                  </span>
                ) : (
                  <Heart
                    className={cn(
                      "h-3.5 w-3.5 transition-transform group-hover:scale-110",
                      hasLiked && "fill-rose-500 text-rose-500"
                    )}
                  />
                )}
                {localLikes > 0 && <span>{localLikes}</span>}
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="border-border/80 bg-popover/95 z-[200000] w-auto rounded-full border p-1.5 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-1 px-1">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelectReactionEmoji(emoji)}
                    className="hover:bg-accent/50 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-sm transition-all duration-150 select-none hover:scale-125 active:scale-95"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* 4. Save to Stash Popover Button */}
          <Popover open={isStashPopoverOpen} onOpenChange={setIsStashPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleMainStashClick}
                onMouseEnter={() => {
                  if (hoverStashTimer.current) clearTimeout(hoverStashTimer.current);
                  hoverStashTimer.current = setTimeout(() => setIsStashPopoverOpen(true), 350);
                }}
                onMouseLeave={() => {
                  if (hoverStashTimer.current) clearTimeout(hoverStashTimer.current);
                }}
                disabled={isPendingStash}
                className={cn(
                  "group inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none active:scale-95",
                  isStashed
                    ? "bg-amber-500/15 font-semibold text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-400"
                )}
                title={isStashed ? "Manage stashes" : "Save to Stash"}
              >
                {isPendingStash ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isStashed ? (
                  <BookmarkCheck className="h-3.5 w-3.5 text-amber-500 transition-transform group-hover:scale-110" />
                ) : (
                  <Bookmark className="transition-hover h-3.5 w-3.5 group-hover:scale-110" />
                )}
                <span>{isStashed ? "Saved" : "Save to Stash"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="top"
              align="start"
              className="border-border/80 bg-popover/95 z-[200000] w-64 rounded-2xl border p-3 shadow-2xl backdrop-blur-xl"
            >
              <div className="space-y-2.5 text-xs">
                <div className="border-border/50 flex items-center justify-between border-b pb-2">
                  <span className="text-foreground flex items-center gap-1.5 font-semibold">
                    <Bookmark className="h-3.5 w-3.5 text-amber-500" />
                    Lore Stash
                  </span>
                  <Link
                    href="/stashes"
                    className="text-muted-foreground hover:text-foreground text-[10px] transition-colors"
                  >
                    View all →
                  </Link>
                </div>

                {userStashes.length === 0 ? (
                  <p className="text-muted-foreground py-1 text-[11px]">
                    No custom stashes found. Click Save to Stash to create your default stash.
                  </p>
                ) : (
                  <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                    {userStashes.map((stash: any) => {
                      const active = stashedIn.some((s: any) => s.id === stash.id);
                      return (
                        <button
                          key={stash.id}
                          type="button"
                          onClick={() => handleToggleSpecificStash(stash.id)}
                          className={cn(
                            "flex w-full cursor-pointer items-center justify-between rounded-xl px-2 py-1.5 text-left transition-colors",
                            active
                              ? "bg-amber-500/15 font-medium text-amber-600 dark:text-amber-300"
                              : "hover:bg-accent/40 text-foreground"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: stash.color || "var(--color-info)" }}
                            />
                            <span className="truncate text-xs">{stash.name}</span>
                          </div>
                          {active && <Check className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isStashed && (
                  <button
                    type="button"
                    onClick={() => {
                      unstashMutation.mutate({ pageTitle: cleanTitle });
                      setIsStashPopoverOpen(false);
                    }}
                    className="border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/15 flex w-full cursor-pointer items-center gap-1.5 rounded-xl border px-2 py-1.5 text-[11px] font-medium transition-colors"
                  >
                    <Trash className="h-3 w-3" />
                    <span>Remove from all stashes</span>
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* 5. Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="group text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 select-none hover:bg-cyan-500/10 hover:text-cyan-500 active:scale-95"
            title="Share article link"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-cyan-500" />
            ) : (
              <Share className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
            )}
            <span>{copied ? "Copied!" : "Share"}</span>
          </button>
        </div>

        {/* Open in Wiki Link */}
        <Link
          href={wikiHref}
          className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-600 transition-all duration-150 hover:bg-teal-500/20 hover:text-teal-700 active:scale-95 dark:text-teal-400 dark:hover:text-teal-300"
        >
          <span>Open in Wiki</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* ── Inline Margin Note Composer ── */}
      <AnimatePresence>
        {isMarginOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="mt-3 overflow-hidden border-t border-yellow-400/20 pt-3"
          >
            <form
              onSubmit={handleSubmitMarginNote}
              className="space-y-2 rounded-xl border border-yellow-400/20 bg-yellow-400/[0.04] p-3"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                  <Edit className="h-3.5 w-3.5" />
                  Add Margin Note / Discussion
                </span>
                <div className="flex items-center gap-2">
                  <Link
                    href={marginHref}
                    className="text-muted-foreground text-[10px] transition-colors hover:text-yellow-500"
                  >
                    Open Margin reader →
                  </Link>
                  <button
                    type="button"
                    onClick={() => setIsMarginOpen(false)}
                    className="text-muted-foreground hover:bg-accent/40 hover:text-foreground cursor-pointer rounded-md p-0.5"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <textarea
                value={marginNote}
                onChange={(e) => setMarginNote(e.target.value)}
                placeholder={`Leave a note or start a discussion on ${cleanTitle}...`}
                rows={2}
                autoFocus
                className="border-border/50 bg-background/80 text-foreground placeholder:text-muted-foreground/60 w-full resize-none rounded-lg border p-2 text-xs focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/30 focus:outline-hidden"
              />

              <div className="flex items-center justify-end gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsMarginOpen(false)}
                  className="text-muted-foreground hover:bg-accent/40 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!marginNote.trim() || isSubmittingNote}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-yellow-500 px-3 py-1 text-xs font-semibold text-stone-950 shadow-xs transition-all hover:bg-yellow-400 active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  <span>Post Note</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Repost Modal ── */}
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
          countryId={
            ((user as any)?.publicMetadata?.countryId as string) || (user as any)?.countryId || ""
          }
          selectedAccount={accounts[0] || null}
          accounts={accounts}
          isOwner={true}
          onPost={() => {
            setIsRepostOpen(false);
            notify.success(`Reposted "${cleanTitle}" to ThinkPages!`);
          }}
        />
      )}
    </div>
  );
}
