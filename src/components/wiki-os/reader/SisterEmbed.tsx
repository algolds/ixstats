"use client";
/**
 * SisterEmbed: the live embed of a `Template:Sister` box in an IxWiki page (sister-embed.ts), mounted by the reader
 * (`ArticleWidgetPortals`) into the box. It reads `wikios.sisterEmbed` once an hour and never retries. Every state
 * keeps the line "From <Wiki>: <title>" linking to the page in the reader:
 *  - the whole page, a section or the infobox: that wiki's sanitized HTML in a contained prose well, capped in height
 *    (a part the service cut short offers the rest there);
 *  - a card: the page's image, title and summary;
 *  - a page or part the wiki does not have: says which;
 *  - an outage (`isWikiOutage`): "<Wiki> could not be reached just now." and the page there;
 *  - a page the wiki answered but could not render, or any other failure: the page there, without blaming the wiki.
 * Its HTML has no ids and no `data-sister-*` (the sanitizer's embed mode), so nothing inside it is mounted on; its
 * images already carry the base path, and `useHtmlMarkup` adds it only to app links.
 */
import Link from "next/link";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useHtmlMarkup } from "~/components/wiki-os/shared/useHtmlMarkup";
import { api, type RouterOutputs } from "~/trpc/react";
import { publicArticleUrl, WIKI_SOURCES, wikiReaderPath } from "~/lib/wiki-os/config";
import { SISTER_EMBED_CLASS } from "~/lib/wiki-os/sister-dom";
import type { SisterEmbedRequest } from "~/lib/wiki-os/sister-embed";
import type { SisterReaderId } from "~/lib/wiki-os/wiki-hosts";
import { isWikiOutage, unreachableText } from "~/lib/wiki-os/wiki-outage";
import { assetUrl } from "~/lib/base-path";

const EMBED_STALE_MS = 3_600_000;
/** The article's containment for another wiki's HTML (content.css): layout and paint containment, isolation. */
const CONTAINED = "wikios-sister-article";
const NOTE_CLASS = "text-footnote text-label-secondary";
const LINK_CLASS = "text-caption text-tint hover:text-tint-hover transition-colors";

/** What `wikios.sisterEmbed` answers. */
type EmbedAnswer = RouterOutputs["wikios"]["sisterEmbed"];

type EmbedError = { data?: { code?: string } | null } | null;

/** The procedure's input: `section` is left out when there is none (it is optional, not nullable). */
function embedInput({ wiki, title, mode, section }: SisterEmbedRequest) {
  return { wiki, title, mode, ...(section !== null ? { section } : {}) };
}

function SourceLine({ wiki, title }: { wiki: SisterReaderId; title: string }) {
  return (
    <p className={NOTE_CLASS}>
      From {WIKI_SOURCES[wiki].name}: <Link href={wikiReaderPath(title, wiki)}>{title}</Link>
    </p>
  );
}

function OnWiki({ wiki, title, verb }: { wiki: SisterReaderId; title: string; verb: string }) {
  return (
    <a href={publicArticleUrl(title, wiki)} rel="noreferrer" className={LINK_CLASS}>
      {verb} on {WIKI_SOURCES[wiki].name}
    </a>
  );
}

function HtmlEmbed({
  wiki,
  title,
  html,
  truncated,
}: {
  wiki: SisterReaderId;
  title: string;
  html: string;
  truncated: boolean;
}) {
  const markup = useHtmlMarkup(html);
  return (
    <Card variant="well" content="prose" className={`${SISTER_EMBED_CLASS} my-4 space-y-3`}>
      <div
        className={`${CONTAINED} max-h-[48rem] overflow-y-auto`}
        dangerouslySetInnerHTML={markup}
      />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SourceLine wiki={wiki} title={title} />
        {truncated && <OnWiki wiki={wiki} title={title} verb="Continue" />}
      </div>
    </Card>
  );
}

function CardEmbed({
  wiki,
  answer,
}: {
  wiki: SisterReaderId;
  answer: { title: string; summary: string; imageUrl: string | null };
}) {
  return (
    <Card
      variant="well"
      content="entity"
      className={`${SISTER_EMBED_CLASS} ${CONTAINED} my-4 flex items-start gap-3`}
    >
      {answer.imageUrl && (
        <img
          src={assetUrl(answer.imageUrl) ?? undefined}
          loading="lazy"
          referrerPolicy="no-referrer"
          alt=""
          className="rounded-control size-16 shrink-0 object-cover"
        />
      )}
      <div className="min-w-0 space-y-1">
        <Link href={wikiReaderPath(answer.title, wiki)} className="text-headline">
          {answer.title}
        </Link>
        <p className="text-body text-label-secondary">{answer.summary}</p>
        <p className={NOTE_CLASS}>From {WIKI_SOURCES[wiki].name}</p>
      </div>
    </Card>
  );
}

/** What a box that holds no part says: still loading, the page or part is not there, or the read failed. */
function EmbedNote({
  request,
  answer,
  error,
}: {
  request: SisterEmbedRequest;
  answer: EmbedAnswer | undefined;
  error: EmbedError | undefined;
}) {
  const { wiki, title } = request;
  const name = WIKI_SOURCES[wiki].name;
  if (answer?.status === "missing") {
    return <p className={NOTE_CLASS}>{`“${title}” does not exist on ${name}.`}</p>;
  }
  if (answer?.status === "no-part") {
    const text =
      answer.part === "section"
        ? `${name} has no section “${request.section ?? ""}” in “${title}”.`
        : `“${title}” on ${name} has no infobox.`;
    return <p className={NOTE_CLASS}>{text}</p>;
  }
  if (!answer && !error) return <Skeleton className="rounded-control-sm h-24 w-full" />;
  return (
    <div className="space-y-1">
      <p className={NOTE_CLASS}>
        {isWikiOutage(error)
          ? unreachableText(wiki)
          : `“${title}” on ${name} could not be shown here.`}
      </p>
      <OnWiki wiki={wiki} title={title} verb="Open" />
    </div>
  );
}

export function SisterEmbed({ request }: { request: SisterEmbedRequest }) {
  const { data: answer, error } = api.wikios.sisterEmbed.useQuery(embedInput(request), {
    staleTime: EMBED_STALE_MS,
    retry: false,
  });
  const { wiki } = request;

  if (answer?.status === "ok" && answer.kind === "html") {
    return (
      <HtmlEmbed wiki={wiki} title={answer.title} html={answer.html} truncated={answer.truncated} />
    );
  }
  if (answer?.status === "ok") return <CardEmbed wiki={wiki} answer={answer} />;
  return (
    <Card variant="well" content="prose" className={`${SISTER_EMBED_CLASS} my-4 space-y-2`}>
      <SourceLine wiki={wiki} title={request.title} />
      <EmbedNote request={request} answer={answer} error={error} />
    </Card>
  );
}
