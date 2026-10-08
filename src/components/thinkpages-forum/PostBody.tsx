"use client";

import { memo, useMemo } from "react";
import { ActionCardView, type ActionCardData } from "~/components/action-links";
import { splitActionTokens } from "~/lib/action-links";

interface PostBodyProps {
  /** Stored sanitized post HTML, possibly containing `[ixaction=<id>]` tokens. */
  html: string;
  /** Cards for the whole page of posts, keyed by activity id (see useThreadActionCards). */
  cards: ReadonlyMap<string, ActionCardData>;
}

/** A forum post body: sanitized HTML with each action token replaced by its verified card. */
export const PostBody = memo(function PostBody({ html, cards }: PostBodyProps) {
  const segments = useMemo(() => splitActionTokens(html), [html]);
  return (
    <div className="text-body text-label [&_a]:text-tint leading-relaxed break-words select-text [&_a]:underline [&_p]:my-2">
      {segments.map((segment, i) =>
        segment.kind === "html" ? (
          // contentHtml is sanitized when the post is written, so it is safe to inject here.
          <div key={i} dangerouslySetInnerHTML={{ __html: segment.text }} />
        ) : (
          <div key={i} className="my-2">
            <ActionCardView card={cards.get(segment.id) ?? null} />
          </div>
        )
      )}
    </div>
  );
});
