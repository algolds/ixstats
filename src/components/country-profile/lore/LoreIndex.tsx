"use client";

import type { RefObject } from "react";
import { useReducedMotion } from "motion/react";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";
import type { LoreGroup, LoreListedPiece } from "~/lib/lore/lore-groups";
import { loreChapterId } from "~/lib/lore/lore-groups";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

/** The pieces' part of the index: each group, then a link to each piece's chapter. */
function PieceIndex({ groups }: { groups: LoreGroup<LoreListedPiece>[] }) {
  const reduceMotion = useReducedMotion();
  return (
    <nav aria-label="Lore pieces" className="flex flex-col gap-4 pt-4">
      {groups.map((group) => (
        <div key={group.type} className="flex flex-col gap-1">
          <h3 className="text-subhead text-label-secondary px-3">{group.label}</h3>
          <div className="wikios-sticky-toc-list">
            {group.pieces.map((piece) => {
              const id = loreChapterId(piece.title);
              return (
                <a
                  key={piece.title}
                  href={`#${id}`}
                  onClick={(event) => {
                    // Scrolled in place, leaving the address (the tab's own URL) alone.
                    event.preventDefault();
                    document.getElementById(id)?.scrollIntoView({
                      behavior: reduceMotion ? "auto" : "smooth",
                      block: "start",
                    });
                  }}
                  className="wikios-sticky-toc-item"
                >
                  <span className="wikios-sticky-toc-text">{piece.title}</span>
                </a>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * The Lore tab's chapter index on wide screens: the wiki article's chapters (WikiOS's contents, following the section
 * being read), then the pieces by type. Nothing when there is neither.
 */
export function LoreIndex({
  toc,
  groups,
  contentRef,
}: {
  toc: TocEntry[];
  groups: LoreGroup<LoreListedPiece>[];
  contentRef: RefObject<HTMLDivElement | null>;
}) {
  const hasToc = toc.length > 1;
  if (!hasToc && groups.length === 0) return null;
  return (
    <aside
      aria-label="Contents"
      className="sticky top-[calc(var(--shell-top-offset,5rem)+1rem)] hidden max-h-[calc(100vh-var(--shell-top-offset,5rem)-2rem)] w-60 shrink-0 self-start overflow-y-auto lg:block"
    >
      {hasToc && <StickyToc entries={toc} contentRef={contentRef} />}
      {groups.length > 0 && <PieceIndex groups={groups} />}
    </aside>
  );
}
