"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Bookmark,
  Bookmark as BookmarkCheck,
  EditPencil as Edit,
  OpenNewWindow as ExternalLink,
  SystemRestart as Loader2,
  Heart,
  Refresh as Repeat2,
  ShareAndroid,
  Check,
  Trash,
  Xmark as X,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useNotify } from "~/hooks/useNotify";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { formatThinkpagesContentForDisplay, cn } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import {
  normalizeWikiImageUrl,
  extractLeadImageFromWikitext,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiAuthorPopover } from "../WikiAuthorPopover";
import { RepostModal } from "~/components/thinkpages/RepostModal";
import { FacetCard } from "~/components/ui/facet-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { springSmooth, tweenExit } from "~/lib/design/motion";

/** A toolbar action on a feed card (plain, pill-shaped, neutral until pressed). */
const FEED_ACTION =
  "text-label-secondary hover:bg-fill-4 hover:text-label text-caption duration-fast ease-out-facet focus-visible:outline-tint inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors select-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

const QUICK_REACTIONS = ["❤️", "🔥", "👏", "💡", "🤯", "🚀"];

export function WikiFeedCard({ activity }: { activity: any }) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const isGrouped = !!activity._grouped;
  const metadata = activity.content?.metadata ?? {};
  const wikiPageTitle = (metadata.pageTitle as string) || activity.content?.title || "";

  const cleanTitle = useMemo(() => {
    try {
      return decodeURIComponent(wikiPageTitle)
        .replace(/^(Wiki edit|New wiki page):\s*/i, "")
        .replace(/_/g, " ")
        .trim();
    } catch {
      return wikiPageTitle
        .replace(/^(Wiki edit|New wiki page):\s*/i, "")
        .replace(/_/g, " ")
        .trim();
    }
  }, [wikiPageTitle]);

  const wikiHref = titleToWikiOSRoute(cleanTitle);
  const marginHref = `${titleToWikiOSRoute(cleanTitle)}?modal=margin`;

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki: "ixwiki" },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  const { data: pageImages } = api.wikios.getPageImages.useQuery(
    { title: cleanTitle },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

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
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
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

  // ─── Post Actions (ShareAndroid / Like / Reaction) ──────────────────────────────────
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
        notify.success("Article link copied to clipboard!");
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

  const formattedIntroHtml = useMemo(() => {
    const raw = intro?.text || intro?.intro || activity.content?.metadata?.blurb || "";
    if (!raw) return "";
    return parseWikitextToHtml(raw, "ixwiki");
  }, [intro?.text, intro?.intro, activity.content?.metadata?.blurb]);

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

  const descText = activity.content?.description ?? "";
  const descHtml = descText ? formatThinkpagesContentForDisplay(descText) : "";

  return (
    <FacetCard padding="md" className="group">
      {/* ── 1. Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <WikiOSLogomark aria-hidden className="text-wiki mt-0.5 size-5 shrink-0" />

          {/* Title & metadata */}
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Link
                href={wikiHref}
                className="text-label text-headline truncate underline-offset-2 hover:underline"
              >
                {cleanTitle}
              </Link>
              {activity._isNew && <Badge variant="info">New</Badge>}
            </div>

            {/* Author / subtitle / diff metadata */}
            <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-1.5">
              {isGrouped ? (
                <span>
                  <span className="text-label font-medium tabular-nums">{activity._editCount}</span>{" "}
                  edits by{" "}
                  {activity._editors?.map((editor: string, idx: number) => (
                    <span key={editor}>
                      {idx > 0 && ", "}
                      <WikiAuthorPopover username={editor} />
                    </span>
                  ))}
                </span>
              ) : (
                activity.user?.name && (
                  <span className="flex items-center gap-1">
                    <span>by</span>
                    <WikiAuthorPopover username={activity.user.name} />
                  </span>
                )
              )}

              {!isGrouped && descHtml && (
                <>
                  <span aria-hidden className="text-label-tertiary">
                    ·
                  </span>
                  <WikiHtmlContent html={descHtml} as="span" className="text-label-secondary" />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Timestamp & open link */}
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-label-secondary text-footnote tabular-nums">
            {timeAgo(new Date(activity.timestamp))}
          </span>
          <Button asChild variant="tinted" size="sm" className="rounded-full">
            <Link href={wikiHref}>
              <span>Open</span>
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      {/* ── 2. Excerpt & lead image ── */}
      {(formattedIntroHtml || leadImage) && (
        <div className="mt-3 flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            {formattedIntroHtml && (
              <WikiHtmlContent
                html={formattedIntroHtml}
                className="text-label text-callout line-clamp-3 [&_a]:transition-colors"
              />
            )}
          </div>

          {/* Lead image thumbnail */}
          {leadImage && (
            <Link
              href={wikiHref}
              className="border-separator bg-fill-4 rounded-row focus-visible:outline-tint relative h-20 w-28 shrink-0 overflow-hidden border focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-24 sm:w-34"
              title={`View ${cleanTitle}`}
            >
              <img
                src={leadImage}
                alt={cleanTitle}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </Link>
          )}
        </div>
      )}

      {/* ── 3. Grouped edit history ── */}
      {isGrouped && activity._subEdits && activity._subEdits.length > 1 && (
        <div className="mt-3">
          <Button
            type="button"
            variant="gray"
            size="sm"
            className="rounded-full"
            aria-expanded={isHistoryExpanded}
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "duration-fast ease-out-facet transition-transform",
                isHistoryExpanded && "rotate-180"
              )}
            />
            <span>
              {isHistoryExpanded ? "Hide edit history" : `Show ${activity._subEdits.length} edits`}
            </span>
          </Button>

          {isHistoryExpanded && (
            <ul className="bg-surface-secondary rounded-row mt-2 space-y-1 p-3">
              {activity._subEdits.map((sub: any, i: number) => {
                const subDesc = sub.content?.description ?? "";
                return (
                  <li
                    key={i}
                    className="text-label-secondary text-footnote flex items-center justify-between py-0.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                      <span className="text-label shrink-0 font-medium">
                        {sub.user?.name ?? "?"}
                      </span>
                      <span aria-hidden className="text-label-tertiary">
                        ·
                      </span>
                      <span className="truncate">{subDesc}</span>
                    </div>
                    <span className="ml-2 shrink-0 tabular-nums">
                      {timeAgo(new Date(sub.timestamp))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── 4. Action toolbar ── */}
      <div className="border-separator mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-1">
          {/* Margin note */}
          <button
            type="button"
            onClick={() => setIsMarginOpen((v) => !v)}
            aria-pressed={isMarginOpen}
            className={cn(FEED_ACTION, isMarginOpen && "bg-tint-fill text-tint")}
            title="Leave a note or comment on Margin"
          >
            <Edit aria-hidden className="size-3.5" />
            <span>Margin</span>
            {marginThreadsCount > 0 && (
              <Badge variant="tinted" className="tabular-nums">
                {marginThreadsCount}
              </Badge>
            )}
          </button>

          {/* Repost to ThinkPages */}
          <button
            type="button"
            onClick={() => setIsRepostOpen(true)}
            className={FEED_ACTION}
            title="Repost to ThinkPages feed"
          >
            <Repeat2 aria-hidden className="size-3.5" />
            <span>Repost</span>
          </button>

          {/* Like & emoji reaction */}
          <Popover open={isReactionOpen} onOpenChange={setIsReactionOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={handleToggleLike}
                aria-pressed={hasLiked}
                className={cn(FEED_ACTION, hasLiked && "bg-red/10 text-red")}
                title="React or like this article"
              >
                {selectedEmoji ? (
                  <span className="text-footnote">{selectedEmoji}</span>
                ) : (
                  <Heart aria-hidden className={cn("size-3.5", hasLiked && "fill-current")} />
                )}
                {localLikes > 0 ? (
                  <span className="tabular-nums">{localLikes}</span>
                ) : (
                  <span className="sr-only">Like</span>
                )}
              </button>
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
                aria-pressed={isStashed}
                className={cn(FEED_ACTION, isStashed && "bg-tint-fill text-tint")}
                title={isStashed ? "Manage stashes" : "Save to Stash"}
              >
                {isPendingStash ? (
                  <Loader2 aria-hidden className="size-3.5 animate-spin" />
                ) : isStashed ? (
                  <BookmarkCheck aria-hidden className="size-3.5 fill-current" />
                ) : (
                  <Bookmark aria-hidden className="size-3.5" />
                )}
                <span>{isStashed ? "Saved" : "Save to Stash"}</span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="w-64 p-3">
              <div className="text-footnote space-y-2">
                <div className="border-separator flex items-center justify-between border-b pb-2">
                  <span className="text-label text-headline flex items-center gap-1.5">
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
                          aria-pressed={active}
                          className={cn(
                            "rounded-row text-body flex w-full cursor-pointer items-center justify-between px-2 py-1.5 text-left transition-colors",
                            active ? "bg-tint-fill text-tint" : "hover:bg-fill-4 text-label"
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: stash.color || "var(--color-info)" }}
                            />
                            <span className="truncate">{stash.name}</span>
                          </div>
                          {active && <Check aria-hidden className="size-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isStashed && (
                  <Button
                    type="button"
                    variant="plain"
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
          <button
            type="button"
            onClick={handleShare}
            className={FEED_ACTION}
            title="Share article link"
          >
            {copied ? (
              <Check aria-hidden className="text-success size-3.5" />
            ) : (
              <ShareAndroid aria-hidden className="size-3.5" />
            )}
            <span>{copied ? "Copied" : "Share"}</span>
          </button>
        </div>
      </div>

      {/* ── 5. Inline margin note composer ── */}
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
                <span className="text-subhead text-label flex items-center gap-1.5">
                  <Edit aria-hidden className="text-label-secondary size-4" />
                  Add margin note or discussion
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
                placeholder={`Leave a note or start a discussion on ${cleanTitle}...`}
                aria-label="Margin note"
                rows={2}
                autoFocus
                className="resize-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="gray"
                  size="sm"
                  onClick={() => setIsMarginOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="filled"
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

      {/* ── 6. Repost Modal ── */}
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
    </FacetCard>
  );
}
