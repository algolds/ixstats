"use client";

import { memo, useMemo, useRef } from "react";
import { ActionCardView, type ActionCardData } from "~/components/action-links";
import { POST_IMAGE_CLASSES } from "~/components/shared/editor/postImageClasses";
import { Skeleton } from "~/components/ui/skeleton";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { splitActionTokens } from "~/lib/action-links";
import { withBasePath } from "~/lib/base-path";
import { rebaseRootRelativeUrls } from "~/lib/thinkpages-forum/html-urls";
import { linkQuoteSources } from "~/lib/thinkpages-forum/post-html";
import { cn } from "~/lib/utils";
import { WikiEmbeds } from "./WikiEmbed";
import type { PostStyle } from "./types";

const NO_CARDS: ReadonlyMap<string, ActionCardData> = new Map();

interface PostBodyProps {
  /** Stored sanitized post HTML, possibly containing `[ixaction=<id>]` tokens. */
  html: string;
  /** `ic` reads as a WikiOS article, `ooc` as compact prose. */
  style: PostStyle;
  /** Cards for the whole page of posts, keyed by activity id (see useThreadActionCards). */
  cards?: ReadonlyMap<string, ActionCardData>;
  /** False while the batch loads or failed: a missing card must not read as "Unverified action" yet. */
  cardsReady?: boolean;
  /** The batch request failed; show "Action unavailable" instead of a verification result. */
  cardsErrored?: boolean;
}

function ActionSlot({
  id,
  cards,
  ready,
  errored,
}: {
  id: string;
  cards: ReadonlyMap<string, ActionCardData>;
  ready: boolean;
  errored: boolean;
}) {
  if (errored) return <span className="text-footnote text-label-secondary">Action unavailable</span>;
  if (!ready) return <Skeleton aria-busy="true" className="h-14 w-full" />;
  return <ActionCardView card={cards.get(id) ?? null} />;
}

/**
 * A forum post body: the stored sanitized HTML through the wiki content renderer (red links, hover previews), with
 * each action token replaced by its verified card, quote authors linked to the quoted post, root-relative image and
 * link URLs under the base path, and wiki embeds hydrated. Styles live in styles/thinkpages-forum.css.
 */
export const PostBody = memo(function PostBody({
  html,
  style,
  cards = NO_CARDS,
  cardsReady = true,
  cardsErrored = false,
}: PostBodyProps) {
  const root = useRef<HTMLDivElement>(null);
  // Stored HTML is root-relative (uploads, imported attachments); the base path is added here, once.
  const segments = useMemo(
    () => splitActionTokens(rebaseRootRelativeUrls(linkQuoteSources(html), withBasePath)),
    [html]
  );
  return (
    <div
      ref={root}
      className={cn(
        "forum-post break-words select-text",
        style === "ic"
          ? "forum-post--ic"
          : "forum-post--ooc text-callout text-label [&_a]:text-tint [&_a]:underline [&_p]:my-2",
        POST_IMAGE_CLASSES
      )}
    >
      {segments.map((segment, i) =>
        segment.kind === "html" ? (
          <WikiHtmlContent key={i} html={segment.text} />
        ) : (
          <div key={i} className="my-2">
            <ActionSlot id={segment.id} cards={cards} ready={cardsReady} errored={cardsErrored} />
          </div>
        )
      )}
      <WikiEmbeds root={root} />
    </div>
  );
});
