"use client";

import { useId, useState } from "react";
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
import { Button, buttonVariants } from "~/components/ui/button";
import { CutoutCard, CutoutCardHeader } from "~/components/ui/cutout-card";
import { Skeleton } from "~/components/ui/skeleton";
import { EmptyState } from "~/components/ui/empty-state";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn, createUrl } from "~/lib/utils";
import { timeAgo as formatRelativeTime } from "~/lib/format/compact";
import { Card } from "~/components/ui/card";

export function BlurbSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const questionId = useId();
  const { data: prompt, isLoading } = api.blurbs.getRandomActivePrompt.useQuery(undefined, {
    staleTime: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <Card className="no-wiki-tooltip space-y-3 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="rounded-control-sm h-4 w-28" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="space-y-2 py-1">
          <Skeleton className="rounded-control-sm h-4 w-full" />
          <Skeleton className="rounded-control-sm h-4 w-4/5" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="rounded-control-sm h-3 w-20" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      </Card>
    );
  }

  if (!prompt) return null;

  const responseCount = prompt._count?.responses ?? 0;

  return (
    <>
      {/* v2 (c5c6b382): a pressable CutoutCard with the indigo cutout tab header. The whole card
          is the button (Facet 3.1 HIG: no nested controls), so "Respond" is its visual label. */}
      <CutoutCard
        variant="card"
        onClick={() => setModalOpen(true)}
        aria-label="Open blurb of the day"
        aria-describedby={questionId}
        className="no-wiki-tooltip flex flex-col justify-between"
        trackPointerHover={false}
      >
        <CutoutCardHeader
          icon={<Quote />}
          trailing={
            <Badge variant="secondary">
              <Compass aria-hidden />
              Daily prompt
            </Badge>
          }
        >
          Blurb of the day
        </CutoutCardHeader>

        <div className="space-y-3 px-4 pb-4">
          {/* Prompt question */}
          <div className="space-y-1">
            {prompt.title && <p className="text-subhead text-facet-accent-ink">{prompt.title}</p>}
            <blockquote id={questionId} className="text-label text-callout line-clamp-3">
              &ldquo;{prompt.question}&rdquo;
            </blockquote>
          </div>

          {/* Footer meta and call to action */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-label-secondary text-footnote flex items-center gap-2">
              <MessageCircle aria-hidden className="text-facet-accent size-3.5" />
              <span className="font-data tabular-nums">{responseCount}</span>
              {responseCount === 1 ? "response" : "responses"}
            </span>

            <span
              aria-hidden
              className={buttonVariants({
                variant: "secondary",
                size: "sm",
                className: "pointer-events-none rounded-full",
              })}
            >
              <span>Respond</span>
              <ChevronRight />
            </span>
          </div>
        </div>
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
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        {/* Header */}
        <DialogHeader className="border-separator border-b px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <Quote aria-hidden className="text-tint mt-1 size-5 shrink-0" />
            <div className="min-w-0 flex-1 pr-6">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle>{prompt.title ?? "Blurb of the day"}</DialogTitle>
                <Badge variant="secondary" className="tabular-nums">
                  {totalCount} {totalCount === 1 ? "response" : "responses"}
                </Badge>
              </div>
              <p className="text-label text-callout mt-2">&ldquo;{prompt.question}&rdquo;</p>
            </div>
          </div>
        </DialogHeader>

        {/* Submission Form (If signed in and not yet responded) */}
        {isSignedIn && !myResponse && (
          <div className="border-separator bg-surface-secondary border-b px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="border-separator bg-surface rounded-row focus-within:border-tint relative border transition-colors">
                <textarea
                  value={newResponse}
                  onChange={(e) => setNewResponse(e.target.value)}
                  placeholder="Share your country's perspective, culture, or lore..."
                  maxLength={1000}
                  rows={3}
                  aria-label="Your response"
                  className="text-label placeholder:text-label-tertiary text-body w-full resize-none bg-transparent px-3 py-2 focus:outline-none"
                />
                <div className="border-separator text-footnote flex items-center justify-between border-t px-3 py-2">
                  <span
                    className={cn(
                      "tabular-nums transition-colors",
                      newResponse.length > 900 ? "text-caution" : "text-label-secondary"
                    )}
                  >
                    {newResponse.length} / 1000
                  </span>
                  <Button
                    size="sm"
                    variant="default"
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
                        <Loader2 aria-hidden className="animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <Send aria-hidden />
                        <span>Submit dispatch</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {submitMutation.error && (
                <p role="alert" className="text-footnote text-destructive">
                  {submitMutation.error.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* User's existing submitted response */}
        {isSignedIn && myResponse && (
          <div className="border-separator bg-surface-secondary border-b px-5 py-4">
            <div className="text-success text-subhead mb-1 flex items-center gap-2">
              <CheckCircle2 aria-hidden className="size-4" />
              <span>Your country&apos;s dispatch</span>
            </div>
            <p className="text-label text-callout whitespace-pre-wrap">{myResponse.content}</p>
          </div>
        )}

        {/* Unauthenticated note */}
        {!isSignedIn && (
          <div className="border-separator bg-surface-secondary border-b px-5 py-3 text-center">
            <p className="text-label-secondary text-footnote">
              Sign in with your nation to submit a cultural dispatch.
            </p>
          </div>
        )}

        {/* Responses Feed */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-4">
          {responsesLoading && (
            <div className="space-y-2 py-4">
              <Skeleton className="rounded-row h-16" />
              <Skeleton className="rounded-row h-16" />
            </div>
          )}

          {!responsesLoading && responses.length === 0 && (
            <EmptyState
              compact
              icon={<MessageCircle />}
              title="No responses yet"
              message="Be the first country to share a perspective on this topic."
            />
          )}

          {responses.map((r: any) => {
            const countryName = r.country?.name ?? r.user?.country?.name ?? "Unknown";
            const countryFlag = r.country?.flag ?? r.user?.country?.flag;

            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-row bg-surface-secondary border p-3",
                  r.featured ? "border-caution/40" : "border-transparent"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {countryFlag ? (
                      <img src={countryFlag} alt="" className="h-3.5 w-5 rounded-xs object-cover" />
                    ) : (
                      <UnifiedCountryFlag
                        showTooltip={false}
                        countryName={countryName}
                        size="sm"
                        className="shrink-0"
                      />
                    )}
                    <span className="text-label text-headline">{countryName}</span>
                    {r.featured && <Badge variant="warning">Featured</Badge>}
                  </div>

                  {r.createdAt && (
                    <span className="text-label-tertiary text-footnote tabular-nums">
                      {formatRelativeTime(r.createdAt)}
                    </span>
                  )}
                </div>

                <p className="text-label text-callout whitespace-pre-wrap select-text">
                  {r.content}
                </p>

                {r.linkedArticles &&
                  Array.isArray(r.linkedArticles) &&
                  r.linkedArticles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {r.linkedArticles.map(
                        (article: { title: string; url: string }, i: number) => (
                          <Link
                            key={i}
                            href={article.url}
                            className="text-tint text-footnote inline-flex items-center gap-1 underline underline-offset-2"
                          >
                            <ExternalLink aria-hidden className="size-3.5" />
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
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 aria-hidden className="animate-spin" />
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
        <div className="border-separator flex items-center justify-between border-t px-5 py-3">
          <Link
            href={createUrl(`/blurbs/${prompt.slug ?? prompt.id}`)}
            className="text-tint text-footnote inline-flex items-center gap-2 underline-offset-2 hover:underline"
          >
            <ExternalLink aria-hidden className="size-3.5" />
            <span>Open full topic</span>
          </Link>
          <Link
            href={createUrl("/blurbs")}
            className="text-label-secondary hover:text-label text-footnote inline-flex items-center gap-1 transition-colors"
          >
            <span>All topics</span>
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
