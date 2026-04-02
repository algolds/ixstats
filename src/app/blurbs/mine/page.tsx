"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { usePageTitle } from "~/hooks/usePageTitle";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { User, BookOpen } from "lucide-react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { BlurbsNav } from "~/components/blurbs/BlurbsNav";
import { createUrl } from "~/lib/url-utils";

function MyBlurbsList() {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.blurbs.getMyBlurbs.useInfiniteQuery(
      { limit: 12 },
      { getNextPageParam: (lastPage) => lastPage.nextCursor }
    );

  const responses = data?.pages.flatMap((p) => p.responses) ?? [];

  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Loading your blurbs...
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <Card className="glass-hierarchy-child">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <BookOpen className="h-10 w-10 text-muted-foreground" />
          <h3 className="text-base font-semibold">No blurbs yet</h3>
          <p className="text-sm text-muted-foreground">
            Browse active prompts and share your country&apos;s perspective.
          </p>
          <Link href={withBasePath("/blurbs")}>
            <Button size="sm">Browse Prompts</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {responses.map((r) => (
        <Link
          key={r.id}
          href={withBasePath(`/blurbs/${r.prompt.slug}`)}
          className="glass-hierarchy-child block rounded-xl border border-white/10 p-4 transition-colors hover:border-white/20"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {r.country?.flag && (
                <img
                  src={r.country.flag}
                  alt=""
                  className="h-3.5 w-5 rounded-sm object-cover"
                />
              )}
              <span className="text-xs font-medium text-muted-foreground truncate">
                {r.prompt.title}
              </span>
            </div>
            {r.featured && (
              <Badge variant="outline" className="shrink-0 border-amber-500/30 text-[10px] text-amber-400">
                Featured
              </Badge>
            )}
          </div>
          <p className="text-sm text-[var(--wikios-text-muted)] line-clamp-3 whitespace-pre-wrap">
            {r.content}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {new Date(r.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </Link>
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
  );
}

export default function MyBlurbsPage() {
  usePageTitle({ title: "My Blurbs" });
  const { isSignedIn } = useAuth();

  return (
    <WikiOSLayout>
      <div className="mx-auto max-w-3xl py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">My Blurbs</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Your responses across all prompts.
            </p>
          </div>
          <BlurbsNav />
        </div>

        {isSignedIn ? (
          <MyBlurbsList />
        ) : (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
              <User className="h-10 w-10 text-muted-foreground" />
              <h3 className="text-base font-semibold">Sign In Required</h3>
              <p className="text-sm text-muted-foreground">
                Sign in to see your blurb responses.
              </p>
              <Link href={createUrl("/setup")}>
                <Button size="sm">Sign In</Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </WikiOSLayout>
  );
}
