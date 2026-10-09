"use client";

import { memo, useMemo } from "react";
import { ActionCardView, type ActionCardData } from "~/components/action-links";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { splitActionTokens } from "~/lib/action-links";
import { withBasePath } from "~/lib/base-path";
import { rebaseRootRelativeUrls } from "~/lib/thinkpages-forum/html-urls";
import { POST_IMAGE_CLASSES } from "~/components/shared/editor/postImageClasses";

interface PostBodyProps {
  /** Stored sanitized post HTML, possibly containing `[ixaction=<id>]` tokens. */
  html: string;
  /** Cards for the whole page of posts, keyed by activity id (see useThreadActionCards). */
  cards: ReadonlyMap<string, ActionCardData>;
  /** False while the batch loads or failed: a missing card must not read as "Unverified action" yet. */
  cardsReady: boolean;
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
  if (errored) return <span className="text-label-secondary text-sm">Action unavailable</span>;
  if (!ready) return <Skeleton aria-busy="true" className="h-14 w-full" />;
  return <ActionCardView card={cards.get(id) ?? null} />;
}

/**
 * A forum post body: sanitized HTML with each action token replaced by its verified card, and root-relative image
 * and link URLs under the base path.
 */
export const PostBody = memo(function PostBody({
  html,
  cards,
  cardsReady,
  cardsErrored = false,
}: PostBodyProps) {
  // Stored HTML is root-relative (uploads, imported attachments); the base path is added here, once.
  const segments = useMemo(
    () => splitActionTokens(rebaseRootRelativeUrls(html, withBasePath)),
    [html]
  );
  return (
    <div
      className={cn(
        "text-body text-label [&_a]:text-tint leading-relaxed break-words select-text [&_a]:underline [&_p]:my-2",
        POST_IMAGE_CLASSES
      )}
    >
      {segments.map((segment, i) =>
        segment.kind === "html" ? (
          // contentHtml is sanitized when the post is written, so it is safe to inject here.
          <div key={i} dangerouslySetInnerHTML={{ __html: segment.text }} />
        ) : (
          <div key={i} className="my-2">
            <ActionSlot id={segment.id} cards={cards} ready={cardsReady} errored={cardsErrored} />
          </div>
        )
      )}
    </div>
  );
});
