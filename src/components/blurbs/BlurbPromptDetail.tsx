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

  const { data: prompt, isLoading: promptLoading } =
    api.blurbs.getPrompt.useQuery({ slug });

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
      <div className="text-center py-12 text-[var(--wikios-text-dim)] text-sm">
        Loading...
      </div>
    );
  }

  if (!prompt) {
    return (
      <div className="text-center py-12 text-[var(--wikios-text-dim)] text-sm">
        Prompt not found.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prompt header */}
      <div className="glass-hierarchy-child rounded-xl border border-white/10 p-5 sm:p-6">
        <h1 className="text-lg sm:text-xl font-bold text-[var(--wikios-text)]">
          {prompt.title}
        </h1>
        <p className="text-[var(--wikios-text-muted)] mt-2 text-sm sm:text-base">
          {prompt.question}
        </p>
        <div className="flex items-center gap-3 mt-3">
          <Badge variant="secondary" className="text-xs">
            {prompt._count.responses}{" "}
            {prompt._count.responses === 1 ? "response" : "responses"}
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
          <p className="text-xs text-emerald-400 font-medium mb-2">
            Your response
          </p>
          <p className="text-[var(--wikios-text-muted)] text-sm whitespace-pre-wrap">
            {myResponse.content}
          </p>
        </div>
      )}

      {!isSignedIn && prompt.status === "ACTIVE" && (
        <div className="glass-hierarchy-child rounded-xl border border-white/10 p-4 text-center">
          <p className="text-[var(--wikios-text-muted)] text-sm">
            Sign in to submit your response.
          </p>
        </div>
      )}

      {/* Responses list */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--wikios-text-muted)]">
          Responses
        </h2>

        {responsesLoading && (
          <p className="text-[var(--wikios-text-dim)] text-sm">Loading responses...</p>
        )}

        {!responsesLoading && responses.length === 0 && (
          <p className="text-[var(--wikios-text-dim)] text-sm">
            No responses yet. Be the first!
          </p>
        )}

        {responses.map((r) => (
          <div
            key={r.id}
            className={`glass-hierarchy-child rounded-xl border p-4 ${
              r.featured
                ? "border-amber-500/30 bg-amber-500/5"
                : "border-white/10"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              {r.country?.flag && (
                <img
                  src={r.country.flag}
                  alt=""
                  className="w-5 h-3.5 rounded-sm object-cover"
                />
              )}
              <Link
                href={withBasePath(
                  `/w/${encodeURIComponent((r.country?.name ?? "").replace(/ /g, "_"))}`
                )}
                className="text-sm font-medium text-[var(--wikios-text)] hover:text-white transition-colors"
              >
                {r.country?.name ?? "Unknown"}
              </Link>
              {r.featured && (
                <Badge
                  variant="outline"
                  className="text-xs text-amber-400 border-amber-500/30"
                >
                  Featured
                </Badge>
              )}
            </div>
            <p className="text-[var(--wikios-text-muted)] text-sm whitespace-pre-wrap">
              {r.content}
            </p>
            {r.linkedArticles &&
              Array.isArray(r.linkedArticles) &&
              (r.linkedArticles as { title: string; url: string }[]).length >
                0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {(
                    r.linkedArticles as { title: string; url: string }[]
                  ).map((article, i) => (
                    <Link
                      key={i}
                      href={withBasePath(article.url)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline"
                    >
                      {article.title}
                    </Link>
                  ))}
                </div>
              )}
            <p className="text-[var(--wikios-text-dim)] text-xs mt-2">
              {new Date(r.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        ))}

        {hasNextPage && (
          <div className="text-center pt-2">
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
  const [linkedArticles, setLinkedArticles] = useState<
    { title: string; url: string }[]
  >([]);

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
        articleUrl.trim() ||
        `/w/${encodeURIComponent(articleTitle.trim().replace(/ /g, "_"))}`;
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
      <h3 className="text-sm font-semibold text-[var(--wikios-text-muted)] mb-3">
        Your response
      </h3>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your country's perspective..."
        maxLength={1000}
        rows={4}
        className="w-full rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-2 text-sm text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:outline-none focus:border-[var(--wikios-accent)] resize-none"
      />
      <div className="flex items-center justify-between mt-1">
        <span className="text-xs text-[var(--wikios-text-dim)]">
          {content.length}/1000
        </span>
      </div>

      {/* Link wiki articles */}
      <div className="mt-3">
        <p className="text-xs text-[var(--wikios-text-dim)] mb-1.5">
          Link wiki articles (optional, max 5)
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            placeholder="Article title"
            className="flex-1 rounded-lg border border-[var(--wikios-border)] bg-[var(--wikios-surface)] px-3 py-1.5 text-xs text-[var(--wikios-text)] placeholder:text-[var(--wikios-text-dim)] focus:outline-none focus:border-[var(--wikios-accent)]"
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
          <div className="flex flex-wrap gap-1.5 mt-2">
            {linkedArticles.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-xs text-[var(--wikios-text-muted)]"
              >
                {a.title}
                <button
                  onClick={() => removeArticle(i)}
                  className="text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text-muted)] ml-0.5"
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
          disabled={
            !content.trim() ||
            content.length > 1000 ||
            submitMutation.isPending
          }
        >
          {submitMutation.isPending ? "Submitting..." : "Submit"}
        </Button>
      </div>

      {submitMutation.error && (
        <p className="text-red-400 text-xs mt-2">
          {submitMutation.error.message}
        </p>
      )}
    </div>
  );
}
