// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";

export function BlurbSection() {
  const [modalOpen, setModalOpen] = useState(false);
  const { data: prompt } = api.blurbs.getRandomActivePrompt.useQuery();

  if (!prompt) return null;

  return (
    <>
      <div className="border-border/20 border-t pt-2.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <MessageCircle className="h-3 w-3 text-purple-400" />
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Blurb of the Day
          </span>
        </div>
        <div className="border-border/30 bg-muted/20 rounded-lg border p-2.5">
          <p className="text-foreground text-[11px] leading-relaxed italic">
            &ldquo;{prompt.question}?&rdquo;
          </p>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-muted-foreground text-[10px]">
            📝 {prompt._count?.responses ?? 0} responses
          </span>
          <button
            onClick={() => setModalOpen(true)}
            className="cursor-pointer text-[10px] font-medium text-purple-500 transition-colors hover:text-purple-400"
          >
            Write Response →
          </button>
        </div>
      </div>

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
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: prompt.id, limit: 8, featuredFirst: true },
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onCloseAction()}>
      <DialogContent className="flex max-h-[80vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="border-border/30 border-b px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
              <MessageCircle className="h-4 w-4 text-purple-400" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-sm font-semibold">
                {prompt.title ?? "Blurb of the Day"}
              </DialogTitle>
              <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                {prompt.question}
              </p>
              <Badge variant="secondary" className="mt-1.5 text-[10px]">
                {prompt._count?.responses ?? 0}{" "}
                {(prompt._count?.responses ?? 0) === 1 ? "response" : "responses"}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Submission Form (If active and not answered yet) */}
        {isSignedIn && !myResponse && (
          <div className="border-border/20 bg-muted/10 border-b px-5 py-3">
            <div className="flex flex-col gap-2">
              <textarea
                value={newResponse}
                onChange={(e) => setNewResponse(e.target.value)}
                placeholder="Share your country's perspective..."
                maxLength={1000}
                rows={3}
                className="border-border/40 w-full resize-none rounded-lg border bg-white/5 px-3 py-2 text-xs focus:border-purple-500 focus:outline-none"
              />
              <div className="text-muted-foreground flex items-center justify-between text-[10px]">
                <span>{newResponse.length}/1000 characters</span>
                <Button
                  size="sm"
                  className="h-6 bg-purple-600 px-3 text-[10px] text-white hover:bg-purple-700"
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
                  {submitMutation.isPending ? "Submitting..." : "Submit Response"}
                </Button>
              </div>
              {submitMutation.error && (
                <p className="mt-1 text-[10px] text-red-400">{submitMutation.error.message}</p>
              )}
            </div>
          </div>
        )}

        {/* User's existing response */}
        {isSignedIn && myResponse && (
          <div className="border-border/20 border-b bg-emerald-500/5 px-5 py-3">
            <h4 className="mb-1 text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
              Your Submitted Response
            </h4>
            <p className="text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
              {myResponse.content}
            </p>
          </div>
        )}

        {/* Sign in prompt */}
        {!isSignedIn && (
          <div className="border-border/20 bg-muted/10 border-b px-5 py-3 text-center">
            <p className="text-muted-foreground text-xs">
              Sign in to submit your country's response.
            </p>
          </div>
        )}

        {/* Responses */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-3">
          {responses.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No responses yet. Be the first!
            </p>
          )}
          {responses.map((r: any) => (
            <div
              key={r.id}
              className={cn(
                "rounded-lg border p-3",
                r.featured ? "border-amber-500/30 bg-amber-500/5" : "border-border/30"
              )}
            >
              <div className="mb-1 flex items-center gap-2">
                {r.country?.flag && (
                  <img src={r.country.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
                )}
                <span className="text-foreground text-xs font-medium">
                  {r.country?.name ?? "Unknown"}
                </span>
                {r.featured && (
                  <Badge
                    variant="outline"
                    className="border-amber-500/30 px-1 py-0 text-[9px] text-amber-400"
                  >
                    Featured
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground line-clamp-4 text-xs whitespace-pre-wrap">
                {r.content}
              </p>
            </div>
          ))}
          {hasNextPage && (
            <div className="py-1 text-center">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-border/30 flex items-center justify-between border-t px-5 py-3">
          <Link
            href={createUrl(`/blurbs/${prompt.slug ?? prompt.id}`)}
            className="inline-flex items-center gap-1.5 text-xs text-purple-400 transition-colors hover:text-purple-300"
          >
            <ExternalLink className="h-3 w-3" />
            Open full prompt
          </Link>
          <Link
            href={createUrl("/blurbs")}
            className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          >
            All prompts →
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
