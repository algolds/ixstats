"use client";
// src/components/wiki-os/editor/WikiViewSource.tsx
// "View source": what a reader who cannot edit a page gets for `?action=edit`, as in MediaWiki: the
// page's wikitext, read-only, with the reason it cannot be edited and, for someone signed out, a way to
// sign in. A page that does not exist has no source: the reader is told they cannot create it.

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Textarea } from "~/components/ui/textarea";
import { withBasePath } from "~/lib/base-path";
import { pageEditHref } from "~/lib/wiki-os/page-tools";
import { api } from "~/trpc/react";

export interface WikiViewSourceProps {
  title: string;
  /** Whether the reader is signed in: a signed-out reader is offered a sign-in, a signed-in one is told why not. */
  signedIn: boolean;
  /** Why the server refused the edit (signed-in readers); null for a signed-out one. */
  reason: string | null;
  /** Back to the page. */
  onClose: () => void;
}

export function WikiViewSource({ title, signedIn, reason, onClose }: WikiViewSourceProps) {
  const { data, isLoading, isError } = api.wikios.getWikitext.useQuery(
    { title },
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );
  const back = (
    <Button type="button" size="sm" variant="outline" onClick={onClose}>
      Back to page
    </Button>
  );

  if (isLoading) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (isError || !data) {
    return (
      <section className="space-y-4">
        <p role="alert" className="text-destructive text-sm">
          The source of this page could not be loaded.
        </p>
        {back}
      </section>
    );
  }

  const exists = data.revisionRef !== null || data.wikitext !== "";
  const verb = exists ? "edit" : "create";
  // Back to the editor after signing in: the same URL.
  // (the redirect URL is the address the browser comes back to, so it carries the base path; the <Link> adds its own)
  const signInHref = `/sign-in?redirect_url=${encodeURIComponent(withBasePath(pageEditHref(title)))}`;
  const refusal = signedIn
    ? `You do not have permission to ${verb} this page. ${reason ?? ""}`.trim()
    : `You must be signed in to ${verb} this page.`;

  return (
    <section aria-labelledby="wikios-view-source-heading" className="space-y-4">
      {/* The page's heading, as in MediaWiki ("View source for X" is its #firstHeading): nothing else on this screen is one. */}
      <h1 id="wikios-view-source-heading" className="text-foreground text-lg font-semibold">
        {exists ? `View source for ${title}` : `Cannot create ${title}`}
      </h1>
      <p role="status" className="text-muted-foreground text-sm">
        {exists ? `${refusal} You can view and copy its source.` : refusal}
      </p>
      {exists && (
        <Textarea
          readOnly
          aria-label={`Wikitext source of ${title}`}
          value={data.wikitext}
          rows={20}
          spellCheck={false}
          className="font-mono text-xs"
        />
      )}
      <div className="flex flex-wrap gap-3">
        {!signedIn && (
          <Button asChild size="sm">
            <Link href={signInHref}>{exists ? "Sign in to edit" : "Sign in to create this page"}</Link>
          </Button>
        )}
        {back}
      </div>
    </section>
  );
}
