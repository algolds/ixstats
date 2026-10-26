"use client";

/**
 * WikiTooltipBody: the hover preview of a wiki page (`GlobalLinkTooltips`). It always resolves: the page's intro,
 * "No summary for this page." for a page with none (or a read that failed for another reason), "<Wiki> has no page
 * with this title." for a page the wiki does not have (or the reader may not see), and "<Wiki> could not be reached
 * just now." for an outage (`isWikiOutage`), with a plain link to the page on a sister wiki, where the reader's
 * browser can get through. Only the first read waits on the skeleton. An outage is asked once, never retried.
 */

import Link from "next/link";
import { OpenBook as BookOpen } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import {
  publicArticleUrl,
  WIKI_SOURCES,
  wikiReaderPath,
  type WikiSource,
} from "~/lib/wiki-os/config";
import { isWikiOutage, unreachableText } from "~/lib/wiki-os/wiki-outage";

/** How long a preview's intro is kept before it is asked again. */
const INTRO_STALE_MS = 30 * 60_000;
/** Retries of a read that failed for a reason other than an outage. */
const MAX_RETRIES = 2;
const INTRO_CHARS = 300;

type IntroError = { data?: { code?: string } | null } | null;

/** An outage is asked once: the wiki's own breaker and limiter decide when it is worth asking again. */
function retryIntro(failureCount: number, error: IntroError): boolean {
  return !isWikiOutage(error) && failureCount < MAX_RETRIES;
}

type PreviewState =
  | { kind: "loading" }
  | { kind: "intro"; text: string }
  | { kind: "empty" }
  | { kind: "missing" }
  | { kind: "unavailable" };

function previewState(
  data: { text: string; missing: boolean } | undefined,
  error: IntroError | undefined
): PreviewState {
  if (data) {
    if (data.missing) return { kind: "missing" };
    return data.text ? { kind: "intro", text: data.text } : { kind: "empty" };
  }
  if (!error) return { kind: "loading" };
  if (isWikiOutage(error)) return { kind: "unavailable" };
  return error.data?.code === "NOT_FOUND" ? { kind: "missing" } : { kind: "empty" };
}

const NOTE_CLASS = "text-label-secondary text-footnote";

function PreviewText({
  state,
  title,
  wiki,
}: {
  state: PreviewState;
  title: string;
  wiki: WikiSource;
}) {
  const name = WIKI_SOURCES[wiki].name;
  switch (state.kind) {
    case "loading":
      return <Skeleton className="rounded-control-sm h-10 w-full" />;
    case "intro":
      return (
        <p className={`${NOTE_CLASS} line-clamp-4 leading-relaxed`}>
          {state.text.substring(0, INTRO_CHARS)}
          {state.text.length > INTRO_CHARS ? "…" : ""}
        </p>
      );
    case "empty":
      return <p className={NOTE_CLASS}>No summary for this page.</p>;
    case "missing":
      return <p className={NOTE_CLASS}>{name} has no page with this title.</p>;
    case "unavailable":
      return (
        <div className="space-y-1">
          <p className={NOTE_CLASS}>{unreachableText(wiki)}</p>
          {wiki !== "ixwiki" && (
            <a
              href={publicArticleUrl(title, wiki)}
              rel="noreferrer"
              className="text-caption text-tint hover:text-tint-hover block transition-colors"
            >
              Open on {name}
            </a>
          )}
        </div>
      );
  }
}

export function WikiTooltipBody({ title, wiki }: { title: string; wiki: WikiSource }) {
  const { data, error } = api.wikios.getIntro.useQuery(
    { title, wiki },
    { staleTime: INTRO_STALE_MS, retry: retryIntro }
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="text-tint size-3.5 shrink-0" aria-hidden="true" />
        <span className="text-label text-headline truncate">{title}</span>
        <Badge variant="default" className="ml-auto">
          {WIKI_SOURCES[wiki].name}
        </Badge>
      </div>
      <PreviewText state={previewState(data, error)} title={title} wiki={wiki} />
      <Link
        href={wikiReaderPath(title, wiki)}
        className="text-caption text-tint hover:text-tint-hover flex items-center gap-1 transition-colors"
      >
        Read full article
      </Link>
    </div>
  );
}
