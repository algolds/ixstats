"use client";

import { useState, useRef, type ReactNode } from "react";
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

/** Stash state and mutations for one article. */
function useStash(title: string) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();

  const { data: stashData } = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: !!user, retry: false, staleTime: 10_000 }
  );
  const { data: userStashes = [] } = api.wikios.getStashes.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });

  const settled = (message: string) => {
    utils.wikios.isStashed.invalidate({ pageTitle: title });
    utils.wikios.getStashes.invalidate();
    notify.success(message);
  };
  const stash = api.wikios.stashPage.useMutation({
    onSuccess: () => settled(`Saved "${title}" to Lore Stash`),
    onError: (err) => notify.error(err.message || "Failed to stash article"),
  });
  const unstash = api.wikios.unstashPage.useMutation({
    onSuccess: () => settled(`Removed "${title}" from Lore Stash`),
    onError: (err) => notify.error(err.message || "Failed to remove from stash"),
  });

  return {
    userStashes,
    isStashed: stashData?.stashed ?? false,
    stashedIn: stashData?.stashes ?? [],
    isPending: stash.isPending || unstash.isPending,
    stash: stash.mutate,
    unstash: unstash.mutate,
  };
}

function StashAction({ title }: { title: string }) {
  const { user } = useUser();
  const notify = useNotify();
  const { userStashes, isStashed, stashedIn, isPending, stash, unstash } = useStash(title);
  const [open, setOpen] = useState(false);
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);
  const cancelHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };

  const requireUser = () => {
    if (!user) notify.error("Sign in to save to a stash.");
    return !!user;
  };

  const toggleSpecific = (stashId: string) => {
    if (!requireUser()) return;
    const mutate = stashedIn.some((s: any) => s.id === stashId) ? unstash : stash;
    mutate({ pageTitle: title, stashId });
  };

  const handleMainClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!requireUser()) return;
    if (isStashed) setOpen((v) => !v);
    else stash({ pageTitle: title });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionPill
          pressed={isStashed}
          icon={
            isPending ? (
              <Loader2 className="animate-spin" />
            ) : isStashed ? (
              <BookmarkCheck className="fill-current" />
            ) : (
              <Bookmark />
            )
          }
          onClick={handleMainClick}
          onMouseEnter={() => {
            cancelHover();
            hoverTimer.current = setTimeout(() => setOpen(true), 350);
          }}
          onMouseLeave={cancelHover}
          disabled={isPending}
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
                {userStashes.map((item: any) => (
                  <FacetRow
                    key={item.id}
                    onClick={() => toggleSpecific(item.id)}
                    accessory="check"
                    selected={stashedIn.some((s: any) => s.id === item.id)}
                    leading={
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: item.color || "var(--color-info)" }}
                      />
                    }
                    title={item.name}
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
                unstash({ pageTitle: title });
                setOpen(false);
              }}
            >
              <Trash aria-hidden />
              <span>Remove from all stashes</span>
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Like pill with an emoji-reaction popover (local only: nothing is persisted). */
function ReactionAction() {
  const [open, setOpen] = useState(false);
  const [likes, setLikes] = useState(0);
  const [emoji, setEmoji] = useState<string | null>(null);
  const hasLiked = emoji !== null;

  const toggleLike = () => {
    setLikes((n) => (hasLiked ? Math.max(0, n - 1) : n + 1));
    setEmoji(hasLiked ? null : "❤️");
  };
  const react = (choice: string) => {
    setLikes((n) => (hasLiked ? n : n + 1));
    setEmoji(choice);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ActionPill
          pressed={hasLiked}
          tone="destructive"
          icon={
            emoji ? (
              <span className="text-footnote">{emoji}</span>
            ) : (
              <Heart className={cn(hasLiked && "fill-current")} />
            )
          }
          count={likes > 0 ? likes : null}
          onClick={toggleLike}
          title="React or like this article"
        >
          <span className="sr-only">Like</span>
        </ActionPill>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-auto rounded-full p-1">
        <div className="flex items-center gap-1">
          {QUICK_REACTIONS.map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => react(choice)}
              aria-label={`React ${choice}`}
              className="hover:bg-fill-3 text-body focus-visible:outline-tint flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors select-none focus-visible:outline-2"
            >
              {choice}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ShareAction({ title, wikiHref }: { title: string; wikiHref: string }) {
  const notify = useNotify();
  const [copied, setCopied] = useState(false);

  const share = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = typeof window !== "undefined" ? `${window.location.origin}${wikiHref}` : wikiHref;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text: `Check out ${title} on IxWiki`, url });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      notify.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <ActionPill
      icon={copied ? <Check className="text-success" /> : <ShareAndroid />}
      onClick={share}
      title="Share article link"
    >
      {copied ? "Copied" : "Share"}
    </ActionPill>
  );
}

/** The inline Margin note composer that slides open under the toolbar. */
function MarginComposer({
  title,
  open,
  onClose,
  marginHref,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  marginHref: string;
}) {
  const { user } = useUser();
  const notify = useNotify();
  const utils = api.useUtils();
  const [note, setNote] = useState("");

  const createThread = api.wikios.createThread.useMutation({
    onSuccess: () => {
      setNote("");
      onClose();
      utils.wikios.getArticleMarginData.invalidate({ articleTitle: title });
      notify.success("Note added to Margin");
    },
    onError: (err) => notify.error(err.message || "Failed to post Margin note"),
  });
  const isSubmitting = createThread.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      notify.error("Sign in to post Margin notes.");
      return;
    }
    if (!note.trim() || isSubmitting) return;
    createThread.mutate({
      articleTitle: title,
      title: `Note on ${title}`,
      content: note.trim(),
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0, transition: tweenExit }}
          transition={springSmooth}
          className="overflow-hidden"
        >
          <form onSubmit={submit} className="bg-surface-secondary rounded-row mt-3 space-y-2 p-3">
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
                  onClick={onClose}
                  aria-label="Close margin note"
                >
                  <X />
                </Button>
              </div>
            </div>

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Add a note on ${title}`}
              aria-label="Margin note"
              rows={2}
              autoFocus
              className="resize-none"
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                disabled={!note.trim() || isSubmitting}
              >
                {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : null}
                <span>Post note</span>
              </Button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * The social action toolbar under a wiki article in the feed — Margin note, Repost to ThinkPages,
 * Like/react, Save to Stash, Share — plus the inline Margin composer and the repost dialog it
 * opens. Shared by `WikiFeedCard` and `InlineWikiArticlePreview`; each action is an `ActionPill`.
 */
export function WikiArticleActions({ title, trailing }: WikiArticleActionsProps) {
  const { user } = useUser();
  const wikiHref = titleToWikiOSRoute(title);
  const [isMarginOpen, setIsMarginOpen] = useState(false);
  const [isRepostOpen, setIsRepostOpen] = useState(false);

  const { data: discussionsData } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle: title },
    { enabled: !!title, staleTime: 60_000 }
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

  return (
    <>
      <div className="border-separator mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-1">
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

          <ActionPill
            icon={<Repeat2 />}
            onClick={() => setIsRepostOpen(true)}
            title="Repost to ThinkPages feed"
          >
            Repost
          </ActionPill>

          <ReactionAction />
          <StashAction title={title} />
          <ShareAction title={title} wikiHref={wikiHref} />
        </div>

        {trailing}
      </div>

      <MarginComposer
        title={title}
        open={isMarginOpen}
        onClose={() => setIsMarginOpen(false)}
        marginHref={`${wikiHref}?modal=margin`}
      />

      {isRepostOpen && (
        <RepostModal
          open={isRepostOpen}
          onOpenChange={setIsRepostOpen}
          originalPost={{
            id: `wiki-${title}`,
            content: `[blurb:wiki/${encodeURIComponent(title.replace(/ /g, "_"))}|${title}]\n\nExplore the latest encyclopedia updates on ${title}.`,
            author: { name: "WikiOS", username: "wikios" },
            title,
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
