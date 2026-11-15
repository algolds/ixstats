"use client";

import { useReducedMotion } from "motion/react";
import type { LoreGroup, LoreListedPiece } from "~/lib/lore/lore-groups";
import { loreChapterId } from "~/lib/lore/lore-groups";
import { scrollToChapter } from "~/lib/lore/scroll-to-chapter";
import { stripHtml } from "~/lib/utils/sanitize-html";
import type { TocEntry } from "~/lib/wiki-os/transformers/html-transformer";

/** A link that scrolls to its target in place, leaving the address (the tab's own URL) alone. */
function JumpLink({
  id,
  children,
  className,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <a
      href={`#${id}`}
      onClick={(event) => {
        event.preventDefault();
        const target = document.getElementById(id);
        if (target) scrollToChapter(target, reduceMotion ? "auto" : "smooth");
      }}
      className={className}
    >
      {children}
    </a>
  );
}

const LINK =
  "text-label hover:text-tint focus-visible:outline-tint rounded-control-sm transition-colors focus-visible:outline-2";

/** The pieces' part of the contents: each type on its own line, its pieces after it. */
function PieceIndex({ groups }: { groups: LoreGroup<LoreListedPiece>[] }) {
  return (
    <nav aria-label="Lore pieces" className="flex flex-col gap-1.5">
      {groups.map((group) => (
        <div
          key={group.type}
          className="text-callout flex flex-wrap items-baseline gap-x-3 gap-y-1"
        >
          <h4 className="text-label-secondary font-normal">{group.label}</h4>
          {group.pieces.map((piece) => (
            <JumpLink key={piece.title} id={loreChapterId(piece.title)} className={LINK}>
              {stripHtml(piece.title)}
            </JumpLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

/**
 * The Lore tab's contents, inline at the top of the page: the article's sections numbered (top level only, in up to
 * four columns as the width allows), then the lore pieces by type. Each jumps in place. Nothing when the article has a
 * single section and there are no pieces.
 */
export function LoreContents({
  toc,
  groups,
}: {
  toc: TocEntry[];
  groups: LoreGroup<LoreListedPiece>[];
}) {
  const sections = toc.filter((t) => t.level <= 2);
  const hasSections = sections.length > 1;
  if (!hasSections && groups.length === 0) return null;
  return (
    <nav aria-label="Contents" className="bg-fill-4 rounded-row flex flex-col gap-3 px-5 py-4">
      <h3 className="text-headline text-label">Contents</h3>
      {hasSections && (
        <ol className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {sections.map((item, i) => (
            <li key={item.id} className="text-callout flex min-w-0 gap-2.5">
              <span className="text-label-tertiary w-5 shrink-0 text-right tabular-nums">
                {i + 1}
              </span>
              <JumpLink id={item.id} className={`${LINK} min-w-0 truncate`}>
                {stripHtml(item.text)}
              </JumpLink>
            </li>
          ))}
        </ol>
      )}
      {groups.length > 0 && (
        <div className={hasSections ? "border-separator border-t pt-3" : undefined}>
          <PieceIndex groups={groups} />
        </div>
      )}
    </nav>
  );
}
