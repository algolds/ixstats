"use client";

import { useState } from "react";
import Link from "next/link";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { api } from "~/trpc/react";
import { withBasePath } from "~/lib/base-path";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

type LinkedArticle = { title: string; url: string };

function ResponseCard({ response: r }: { response: any }) {
  const articles: LinkedArticle[] = Array.isArray(r.linkedArticles) ? r.linkedArticles : [];

  return (
    <div
      className={`bg-surface rounded-card border p-4 ${
        r.featured ? "border-yellow/40" : "border-separator"
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        {r.country?.flag && (
          <img src={r.country.flag} alt="" className="rounded-control-sm h-3.5 w-5 object-cover" />
        )}
        <Link
          href={withBasePath(
            `/wiki/${encodeURIComponent((r.country?.name ?? "").replace(/ /g, "_"))}`
          )}
          className="text-headline text-label hover:text-tint transition-colors"
        >
          {r.country?.name ?? "Unknown"}
        </Link>
        {r.featured && <Badge variant="warning">Featured</Badge>}
      </div>
      <p className="text-body text-label-secondary whitespace-pre-wrap">{r.content}</p>
      {articles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {articles.map((article, i) => (
            <Link
              key={i}
              href={withBasePath(article.url)}
              className="text-footnote text-tint underline"
            >
              {article.title}
            </Link>
          ))}
        </div>
      )}
      <p className="text-footnote text-label-secondary mt-2">
        {new Date(r.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </p>
    </div>
  );
}

function PromptHeader({ prompt }: { prompt: any }) {
  const count: number = prompt._count.responses;
  return (
    <div className="bg-surface rounded-card border-separator border p-5 sm:p-6">
      <h1 className="text-title-3 text-label sm:text-title-2">{prompt.title}</h1>
      <p className="text-body text-label-secondary mt-2">{prompt.question}</p>
      <div className="mt-3 flex items-center gap-3">
        <Badge variant="default" className="tabular-nums">
          {count} {count === 1 ? "response" : "responses"}
        </Badge>
        {prompt.status === "CLOSED" && <Badge variant="outline">Closed</Badge>}
      </div>
    </div>
  );
}

/** The submission form, the user's own response, or a sign-in hint. */
function ResponseSection({
  prompt,
  isSignedIn,
  myResponse,
}: {
  prompt: any;
  isSignedIn: boolean;
  myResponse?: { content: string } | null;
}) {
  const isActive = prompt.status === "ACTIVE";
  return (
    <>
      {isSignedIn && isActive && !myResponse && <BlurbSubmissionForm promptId={prompt.id} />}

      {myResponse && (
        <div className="bg-tint-fill rounded-card p-4">
          <p className="text-caption text-tint mb-2">Your response</p>
          <p className="text-body text-label-secondary whitespace-pre-wrap">{myResponse.content}</p>
        </div>
      )}

      {!isSignedIn && isActive && (
        <div className="bg-surface rounded-card border-separator border p-4 text-center">
          <p className="text-body text-label-secondary">Sign in to submit your response.</p>
        </div>
      )}
    </>
  );
}

/**
 * Single prompt view with all responses and a submission form.
 */
export function BlurbPromptDetail({ slug }: { slug: string }) {
  const { isSignedIn } = useWikiAuth();

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
    return <div className="text-body text-label-secondary py-12 text-center">Loading...</div>;
  }

  if (!prompt) {
    return (
      <div className="text-body text-label-secondary py-12 text-center">Prompt not found.</div>
    );
  }

  return (
    <div className="space-y-6">
      <PromptHeader prompt={prompt} />

      <ResponseSection prompt={prompt} isSignedIn={!!isSignedIn} myResponse={myResponse} />

      {/* Responses list */}
      <div className="space-y-3">
        <h2 className="text-headline text-label-secondary">Responses</h2>

        {responsesLoading && <p className="text-body text-label-secondary">Loading responses...</p>}

        {!responsesLoading && responses.length === 0 && (
          <p className="text-body text-label-secondary">No responses yet.</p>
        )}

        {responses.map((r) => (
          <ResponseCard key={r.id} response={r} />
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

function BlurbSubmissionForm({ promptId }: { promptId: string }) {
  const [content, setContent] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [linkedArticles, setLinkedArticles] = useState<LinkedArticle[]>([]);

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
        articleUrl.trim() || `/wiki/${encodeURIComponent(articleTitle.trim().replace(/ /g, "_"))}`;
      setLinkedArticles([...linkedArticles, { title: articleTitle.trim(), url }]);
      setArticleTitle("");
      setArticleUrl("");
    }
  };

  const removeArticle = (index: number) => {
    setLinkedArticles(linkedArticles.filter((_, i) => i !== index));
  };

  return (
    <div className="bg-surface rounded-card border-separator border p-4 sm:p-5">
      <h3 className="text-headline text-label-secondary mb-3">Your response</h3>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your country's perspective..."
        maxLength={1000}
        rows={4}
        aria-label="Your response"
        className="resize-none"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-footnote text-label-secondary tabular-nums">
          {content.length}/1000
        </span>
      </div>

      {/* Link wiki articles */}
      <div className="mt-3">
        <p className="text-footnote text-label-secondary mb-2">
          Link wiki articles (optional, max 5)
        </p>
        <div className="flex gap-2">
          <Input
            type="text"
            value={articleTitle}
            onChange={(e) => setArticleTitle(e.target.value)}
            placeholder="Article title"
            aria-label="Article title"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addArticle()}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={addArticle}
            disabled={!articleTitle.trim() || linkedArticles.length >= 5}
          >
            Add
          </Button>
        </div>
        {linkedArticles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {linkedArticles.map((a, i) => (
              <span
                key={i}
                className="bg-fill-3 text-caption text-label-secondary inline-flex items-center gap-1 rounded-full px-2 py-0.5"
              >
                {a.title}
                <button
                  onClick={() => removeArticle(i)}
                  className="text-label-secondary hover:text-label-secondary ml-0.5"
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
        <p className="text-footnote text-red mt-2">{submitMutation.error.message}</p>
      )}
    </div>
  );
}
