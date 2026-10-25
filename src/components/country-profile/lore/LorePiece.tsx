"use client";

import { useRef } from "react";
import { Pin } from "iconoir-react";
import { Skeleton } from "~/components/ui/skeleton";
import { useArticleHtml } from "~/hooks/lore/useArticleHtml";
import { useNearViewport } from "~/hooks/useNearViewport";
import { loreChapterId, type LoreListedPiece } from "~/lib/lore/lore-groups";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { LorePieceActions, type LorePieceActionProps } from "./LorePieceActions";

function PieceLoading({ title }: { title: string }) {
  return (
    <div className="max-w-[44rem] space-y-3" role="status" aria-label={`Loading ${title}`}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className={i === 2 ? "h-4 w-1/2" : "h-4 w-full"} />
      ))}
    </div>
  );
}

/**
 * The piece's page as WikiOS renders it, in WikiOS's article styles (as the forum's wiki embed shows one). The HTML is
 * WikiOS's sanitized view bundle, with its links under the base path, its ids scoped to the chapter and its headings
 * below the piece's title (`useArticleHtml`). It is fetched once the
 * chapter nears the viewport (`near`), so a long list never fetches every page up front; a page already read shows at
 * once. A page that fails to load, or has nothing to show, says so here and nowhere else.
 */
function PieceBody({ title, near }: { title: string; near: boolean }) {
  const { markup, isLoading } = useArticleHtml(title, "ixwiki", {
    enabled: near,
    chapterId: loreChapterId(title),
  });
  if (markup) {
    return (
      <div className="wikios-article-body wikios-article-content max-w-[44rem]">
        <div className={ARTICLE_STYLE_ROOT_CLASS} dangerouslySetInnerHTML={markup} />
      </div>
    );
  }
  if (!near) return <div aria-hidden="true" className="h-24" />;
  if (isLoading) return <PieceLoading title={title} />;
  return <p className="text-callout text-label-secondary">This page could not be loaded</p>;
}

export interface LorePieceProps extends Omit<LorePieceActionProps, "title" | "pinned"> {
  piece: LoreListedPiece;
  /** The server's refusal of the last curation change to this piece, or null. */
  refusal: string | null;
}

/** One piece as a chapter of the Lore tab: its heading and actions, then its page, read inline. */
export function LorePiece({ piece, busy, refusal, ...actions }: LorePieceProps) {
  const ref = useRef<HTMLElement>(null);
  const near = useNearViewport(ref);
  const id = loreChapterId(piece.title);
  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={`${id}-heading`}
      className="flex scroll-mt-[calc(var(--shell-top-offset,5rem)+1rem)] flex-col gap-3"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id={`${id}-heading`} className="text-title-3 text-label min-w-0">
          {piece.title}
        </h3>
        {piece.pinned && (
          <span className="text-footnote text-label-secondary inline-flex items-center gap-1">
            <Pin aria-hidden="true" className="size-3.5" />
            Pinned
          </span>
        )}
        <div className="ml-auto">
          <LorePieceActions title={piece.title} pinned={piece.pinned} busy={busy} {...actions} />
        </div>
      </div>
      {refusal && (
        <p role="alert" className="text-callout text-destructive">
          {refusal}
        </p>
      )}
      <PieceBody title={piece.title} near={near} />
    </section>
  );
}
