"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

/**
 * Single prompt view with all responses and a submission form.
 */
export function BlurbPromptDetail({ slug }: { slug: string }) {
  const { isSignedIn } = useAuth();

  const { data: prompt, isLoading: promptLoading } = api.blurbs.getPrompt.useQuery({ slug });

  const {
    data: responsesData,
    isLoading: responsesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = api.blurbs.getResponsesForPrompt.useInfiniteQuery(
    { promptId: prompt?.id ?? "", limit: 20 },
    {
      enabled: !!prompt?.id,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    }
  );

  const { data: myResponse } = api.blurbs.getMyResponse.useQuery(
    { promptId: prompt?.id ?? "" },
    { enabled: !!prompt?.id && !!isSignedIn }
  );

  const responses = responsesData?.pages.flatMap((p) => p.responses) ?? [];

  if (promptLoading) {
    return (
      <div className="py-12 text-center text-sm text-[var(--wikios-text-dim)]">Loading...</div>
    );
  }

  if (!prompt) {
    return (
      <div className="py-12 text-center text-sm text-[var(--wikios-text-dim)]">
        Prompt not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prompt header */}
      <div className="glass-hierarchy-child rounded-xl border border-white/10 p-5 sm:p-6">
        <h1 className="text-lg font-bold text-[var(--wikios-text)] sm:text-xl">{prompt.title}</h1>
        <p className="mt-2 text-sm text-[var(--wikios-text-muted)] sm:text-base">
          {prompt.question}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary" className="text-xs">
            {prompt._count.responses} {prompt._count.responses === 1 ? "response" : "responses"}
          </Badge>
          {prompt.status === "CLOSED" && (
            <Badge variant="outline" className="text-xs text-[var(--wikios-text-dim)]">
              Closed
            </Badge>
          )}
        </div>
      </div>

      {/* Submission form */}
      {isSignedIn && prompt.status === "ACTIVE" && !myResponse && (
        <BlurbSubmissionForm promptId={prompt.id} />
      )}

      {myResponse && (
        <div className="glass-hierarchy-child rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="mb-2 text-xs font-medium text-emerald-400">Your response</p>
          <p className="text-sm whitespace-pre-wrap text-[var(--wikios-text-muted)]">
            {myResponse.content}
          </p>
        </div>
      )}

      {!isSignedIn && prompt.status === "ACTIVE" && (
        <div className="glass-hierarchy-child rounded-xl border border-white/10 p-4 text-center">
          <p className="text-sm text-[var(--wikios-text-muted)]">
            Sign in to submit your response.
          </p>
        </div>
      )}

      {/* Responses list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--wikios-text-muted)]">Responses</h2>

        {responsesLoading && (
          <p className="text-sm text-[var(--wikios-text-dim)]">Loading responses...</p>
        )}

        {!responsesLoading && responses.length === 0 && (
          <p className="text-sm text-[var(--wikios-text-dim)]">No responses yet. Be the first!</p>
        )}

        {responses.map((r) => (
          <div
            key={r.id}
            className={`glass-hierarchy-child rounded-xl border p-4 ${
              r.featured ? "border-amber-500/30 bg-amber-500/5" : "border-white/10"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              {r.country?.flag && (
                <img src={r.country.flag} alt="" className="h-3.5 w-5 rounded-sm object-cover" />
              )}
              <Link
                href={withBasePath(
                  `/w/${encodeURIComponent((r.country?.name ?? "").replace(/ /g, "_"))}`
                )}
                className="text-sm font-medium text-[var(--wikios-text)] transition-colors hover:text-white"
              >
                {r.country?.name ?? "Unknown"}
              </Link>
              {r.featured && (
                <Badge variant="outline" className="border-amber-500/30 text-xs text-amber-400">
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap text-[var(--wikios-text-muted)]">
              {r.content}
            </p>
            {r.linkedArticles &&
              Array.isArray(r.linkedArticles) &&
              (r.linkedArticles as { title: string; url: string }[]).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(r.linkedArticles as { title: string; url: string }[]).map((article, i) => (
                    <Link
                      key={i}
                      href={withBasePath(article.url)}
                      className="text-xs text-blue-400 underline hover:text-blue-300"
                    >
                      {article.title}
                    </Link>
                  ))}
                </div>
              )}
            <p className="mt-2 text-xs text-[var(--wikios-text-dim)]">
              {new Date(r.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        ))}

        {hasNextPage && (
          <div className="pt-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading..." : "Load more"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Submission form (internal)
// ---------------------------------------------------------------------------

function BlurbSubmissionForm({ promptId }: { promptId: string }) {
  const [content, setContent] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [linkedArticles, setLinkedArticles] = useState<{ title: string; url: string }[]>([]);

  const utils = api.useUtils();

  const submitMutation = api.blurbs.submitResponse.useMutation({
    onSuccess: () => {
      setContent("");
      setLinkedArticles([]);
      utils.blurbs.getResponsesForPrompt.invalidate({ promptId });
      utils.blurbs.getMyResponse.invalidate({ promptId });
      utils.blurbs.getActivePrompts.invalidate();
      utils.blurbs.getBlurbCount.invalidate();
    },
  });

  const addArticle = () => {
    if (articleTitle.trim() && linkedArticles.length < 5) {
      const url =
        articleUrl.trim() || `/w/${encodeURIComponent(articleTitle.trim().replace(/ /g, "_"))}`;
      setLinkedArticles([...linkedArticles, { title: articleTitle.trim(), url }]);
      setArticleTitle("");
      setArticleUrl("");
    }
  };

  const removeArticle = (index: number) => {
    setLinkedArticles(linkedArticles.filter((_, i) => i !== index));
  };

  return (
    <div className="glass-hierarchy-child rounded-xl border border-white/10 p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--wikios-text-muted)]">Your response</h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your country's perspective..."
        maxLength={1000}
        rows={4}
        className="w-full resize-none rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-2 text-sm text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:border-[var(--wikios-accent)] focus:outline-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-xs text-[var(--wikios-text-dim)]">{content.length}/1000</span>
      </div>

      {/* Link wiki articles */}
      <div className="mt-3">
        <p className="mb-1.5 text-xs text-[var(--wikios-text-dim)]">
          Link wiki articles (optional, max 5)
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            placeholder="Article title"
            className="flex-1 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-1.5 text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:border-[var(--wikios-accent)] focus:outline-none"
            onKeyDown={(e) => e.key === "Enter" && addArticle()}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={addArticle}
            disabled={!articleTitle.trim() || linkedArticles.length >= 5}
            className="text-xs"
          >
            Add
          </Button>
        </div>
        {linkedArticles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {linkedArticles.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-[var(--wikios-text-muted)]"
              >
                {a.title}
                <button
                  onClick={() => removeArticle(i)}
                  className="ml-0.5 text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text-muted)]"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            submitMutation.mutate({
              promptId,
              content,
              linkedArticles: linkedArticles.length > 0 ? linkedArticles : undefined,
            })
          }
          disabled={!content.trim() || content.length > 1000 || submitMutation.isPending}
        >
          {submitMutation.isPending ? "Submitting..." : "Submit"}
        </Button>
      </div>

      {submitMutation.error && (
        <p className="mt-2 text-xs text-red-400">{submitMutation.error.message}</p>
      )}
    </div>
  );
}
