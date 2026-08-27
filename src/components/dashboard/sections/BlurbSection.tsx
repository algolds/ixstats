"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChatBubble as MessageCircle,
  OpenNewWindow as ExternalLink,
  NavArrowRight as ChevronRight,
  Send,
  CheckCircle as CheckCircle2,
  Compass,
  Quote,
  SystemRestart as Loader2,
} from "iconoir-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn, createUrl } from "~/lib/utils";

function formatRelativeTime(date: Date | string | number): string {
  const d = new Date(date);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function BlurbSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: prompt, isLoading } = api.blurbs.getRandomActivePrompt.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className="no-wiki-tooltip border-border/50 bg-card/60 relative space-y-3 overflow-hidden rounded-2xl border p-4 shadow-xs backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="bg-muted/40 h-4 w-28 animate-pulse rounded-md" />
          <div className="bg-muted/40 h-4 w-16 animate-pulse rounded-full" />
        </div>
        <div className="space-y-2 py-1">
          <div className="bg-muted/40 h-4 w-full animate-pulse rounded-md" />
          <div className="bg-muted/40 h-4 w-4/5 animate-pulse rounded-md" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <div className="bg-muted/40 h-3 w-20 animate-pulse rounded-md" />
          <div className="bg-muted/40 h-6 w-20 animate-pulse rounded-full" />
        </div>
      </div>
    );
  }

  if (!prompt) return null;

  const responseCount = prompt._count?.responses ?? 0;

  return (
    <>
      <CutoutCard
        onClick={() => setModalOpen(true)}
        className={cn(
          cutoutCardSurfaceClassName,
          "no-wiki-tooltip group relative flex cursor-pointer flex-col justify-between overflow-hidden rounded-xl"
        )}
        trackPointerHover={false}
      >
        {/* Cutout tab header */}
        <div className="relative flex items-center justify-between bg-indigo-500/10 px-4 pt-3 pb-5">
          <div className="text-card-foreground flex items-center gap-2 text-xs font-semibold tracking-tight">
            <Quote className="h-4 w-4 text-indigo-500" />
            <span>Blurb of the Day</span>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-wider text-indigo-700 uppercase dark:border-indigo-400/25 dark:bg-indigo-500/20 dark:text-indigo-300">
            <Compass className="h-2.5 w-2.5 text-indigo-600 dark:text-indigo-400" />
            Daily Prompt
          </span>

          <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
          <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={20} />
        </div>

        <CutoutCardContent className="space-y-3.5 px-4 pt-0 pb-4">
          {/* Prompt Question Body */}
          <div className="space-y-1">
            {prompt.title && (
              <p className="text-[11px] font-medium tracking-tight text-indigo-600/90 dark:text-indigo-400/90">
                {prompt.title}
              </p>
            )}
            <blockquote className="text-foreground/90 line-clamp-3 text-[13px] leading-relaxed font-normal tracking-normal select-text dark:text-zinc-200">
              &ldquo;{prompt.question}&rdquo;
            </blockquote>
          </div>

          {/* Footer Meta & Tactile CTA */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted-foreground/80 flex items-center gap-1.5 text-[11px] font-medium tabular-nums">
              <MessageCircle className="h-3.5 w-3.5 text-indigo-500/70 dark:text-indigo-400/70" />
              {responseCount} {responseCount === 1 ? "response" : "responses"}
            </span>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setModalOpen(true);
              }}
              className="group/btn inline-flex cursor-pointer items-center gap-1 rounded-full border border-indigo-500/25 bg-indigo-500/10 px-2.5 py-1 text-[10px] font-medium text-indigo-700 shadow-2xs transition-all duration-150 hover:border-indigo-500/40 hover:bg-indigo-500/20 active:scale-95 dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:border-indigo-400/40 dark:hover:bg-indigo-500/25"
            >
              <span>Respond</span>
              <ChevronRight className="h-3 w-3 shrink-0 text-indigo-600/80 transition-transform duration-150 group-hover/btn:translate-x-0.5 dark:text-indigo-300/80" />
            </button>
          </div>
        </CutoutCardContent>
      </CutoutCard>

      <BlurbResponseModal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        prompt={prompt}
      />
    </>
  );
}

export function BlurbResponseModal({
  open,
  onCloseAction,
  prompt,
}: {
  open: boolean;
  onCloseAction: () => void;
  prompt: {
    id: string;
    title?: string;
    question: string;
    slug?: string;
    _count?: { responses: number };
  };
}) {
  const [newResponse, setNewResponse] = useState("");
  const utils = api.useUtils();
  const { isSignedIn } = useUser();

  const {
    data: responsesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: responsesLoading,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: prompt.id, limit: 10, featuredFirst: true },
    {
      enabled: open,
      getNextPageParam: (lastPage: any) => lastPage.nextCursor,
    }
  );

  const { data: myResponse } = api.blurbs.getMyResponse.useQuery(
    { promptId: prompt.id },
    { enabled: open && !!isSignedIn }
  );

  const submitMutation = api.blurbs.submitResponse.useMutation({
    onSuccess: () => {
      setNewResponse("");
      utils.blurbs.getResponsesForPrompt.invalidate({ promptId: prompt.id });
      utils.blurbs.getMyResponse.invalidate({ promptId: prompt.id });
      utils.blurbs.getActivePrompts.invalidate();
      utils.blurbs.getBlurbCount.invalidate();
    },
  });

  const responses = responsesData?.pages.flatMap((p: any) => p.responses) ?? [];
  const totalCount = prompt._count?.responses ?? responses.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCloseAction()}>
      <DialogContent className="bg-background/95 flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden rounded-2xl border border-indigo-500/15 p-0 shadow-2xl backdrop-blur-2xl sm:max-w-lg dark:border-indigo-400/20">
        {/* Header */}
        <DialogHeader className="border-border/40 border-b px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/25 dark:bg-indigo-500/20 dark:text-indigo-300">
              <Quote className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold tracking-tight">
                  {prompt.title ?? "Blurb of the Day"}
                </DialogTitle>
                <Badge
                  variant="outline"
                  className="border-indigo-500/25 bg-indigo-500/10 px-2 py-0 text-[10px] font-medium text-indigo-700 tabular-nums dark:border-indigo-400/25 dark:bg-indigo-500/15 dark:text-indigo-300"
                >
                  {totalCount} {totalCount === 1 ? "response" : "responses"}
                </Badge>
              </div>
              <p className="text-foreground/90 mt-1.5 text-xs leading-relaxed font-normal dark:text-zinc-300">
                &ldquo;{prompt.question}&rdquo;
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Submission Form (If signed in and not yet responded) */}
        {isSignedIn && !myResponse && (
          <div className="border-border/30 bg-muted/20 border-b px-5 py-3.5">
            <div className="flex flex-col gap-2.5">
              <div className="border-border/60 bg-card/80 relative rounded-xl border shadow-2xs transition-colors focus-within:border-indigo-500/40">
                <textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Share your country's perspective, culture, or lore..."
                  maxLength={1000}
                  rows={3}
                  className="text-foreground placeholder:text-muted-foreground/60 w-full resize-none bg-transparent px-3 py-2.5 text-xs leading-relaxed focus:outline-none"
                />
                <div className="border-border/30 flex items-center justify-between border-t px-3 py-1.5 text-[10px]">
                  <span
                    className={cn(
                      "font-mono transition-colors",
                      newResponse.length > 900 ? "text-amber-500" : "text-muted-foreground/70"
                    )}
                  >
                    {newResponse.length} / 1000
                  </span>
                  <Button
                    size="sm"
                    className="h-6 cursor-pointer gap-1 rounded-md bg-indigo-600 px-2.5 text-[10px] font-medium text-white shadow-xs hover:bg-indigo-700 active:scale-95 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                    onClick={() =>
                      submitMutation.mutate({
                        promptId: prompt.id,
                        content: newResponse,
                      })
                    }
                    disabled={
                      !newResponse.trim() || newResponse.length > 1000 || submitMutation.isPending
                    }
                  >
                    {submitMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-2.5 w-2.5" />
                        <span>Submit Dispatch</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {submitMutation.error && (
                <p className="text-[10px] font-medium text-red-500 dark:text-red-400">
                  {submitMutation.error.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* User's existing submitted response */}
        {isSignedIn && myResponse && (
          <div className="border-border/30 border-b bg-emerald-500/[0.04] px-5 py-3.5">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Your Country&apos;s Dispatch</span>
            </div>
            <p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-wrap dark:text-zinc-200">
              {myResponse.content}
            </p>
          </div>
        )}

        {/* Unauthenticated note */}
        {!isSignedIn && (
          <div className="border-border/30 bg-muted/15 border-b px-5 py-3 text-center">
            <p className="text-muted-foreground text-xs">
              Sign in with your nation to submit a cultural dispatch.
            </p>
          </div>
        )}

        {/* Responses Feed */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4">
          {responsesLoading && (
            <div className="space-y-2 py-4">
              <div className="bg-muted/40 h-16 animate-pulse rounded-xl" />
              <div className="bg-muted/40 h-16 animate-pulse rounded-xl" />
            </div>
          )}

          {!responsesLoading && responses.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:border-indigo-400/20 dark:bg-indigo-500/15 dark:text-indigo-400">
                <MessageCircle className="h-5 w-5 opacity-80" />
              </div>
              <p className="text-foreground mt-2.5 text-xs font-medium">No responses yet</p>
              <p className="text-muted-foreground mt-0.5 text-[11px]">
                Be the first country to share a perspective on this topic.
              </p>
            </div>
          )}

          {responses.map((r: any) => {
            const countryName = r.country?.name ?? r.user?.country?.name ?? "Unknown";
            const countryFlag = r.country?.flag ?? r.user?.country?.flag;

            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  r.featured
                    ? "border-amber-500/30 bg-amber-500/[0.04]"
                    : "border-border/30 bg-accent/5 hover:bg-accent/15"
                )}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {countryFlag ? (
                      <img
                        src={countryFlag}
                        alt=""
                        className="h-3.5 w-5 rounded-xs object-cover shadow-2xs"
                      />
                    ) : (
                      <UnifiedCountryFlag
                        showTooltip={false}
                        countryName={countryName}
                        size="sm"
                        className="shrink-0"
                      />
                    )}
                    <span className="text-foreground text-xs font-semibold tracking-tight">
                      {countryName}
                    </span>
                    {r.featured && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/30 px-1.5 py-0 text-[8px] font-semibold text-amber-600 dark:text-amber-400"
                      >
                        Featured
                      </Badge>
                    )}
                  </div>

                  {r.createdAt && (
                    <span className="text-muted-foreground/60 text-[10px] tabular-nums">
                      {formatRelativeTime(r.createdAt)}
                    </span>
                  )}
                </div>

                <p className="text-foreground/90 text-xs leading-relaxed whitespace-pre-wrap select-text dark:text-zinc-200">
                  {r.content}
                </p>

                {r.linkedArticles &&
                  Array.isArray(r.linkedArticles) &&
                  r.linkedArticles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.linkedArticles.map(
                        (article: { title: string; url: string }, i: number) => (
                          <Link
                            key={i}
                            href={article.url}
                            className="inline-flex items-center gap-1 text-[10px] text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                          >
                            <ExternalLink className="h-2.5 w-2.5" />
                            {article.title}
                          </Link>
                        )
                      )}
                    </div>
                  )}
              </div>
            );
          })}

          {hasNextPage && (
            <div className="pt-2 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 cursor-pointer text-xs active:scale-95"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more responses"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="border-border/40 flex items-center justify-between border-t px-5 py-3">
          <Link
            href={createUrl(`/blurbs/${prompt.slug ?? prompt.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Open full topic</span>
          </Link>
          <Link
            href={createUrl("/blurbs")}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs transition-colors"
          >
            <span>All topics</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
