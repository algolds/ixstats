import Link from "next/link";
import { OpenBook } from "iconoir-react";
import { createUrl } from "~/lib/utils";
import { cn } from "~/lib/utils/cn";

/**
 * LoreProse — wiki lore in the Reading style (Facet 3 §3: "the one sanctioned content style"):
 * a 38rem measure, the serif body face at a reading size, generous leading, and a drop cap on
 * the opening paragraph. Data never sits inside this block; weave it around the prose.
 */
export interface LoreProseProps {
  paragraphs: readonly string[];
  /** Drop cap on the first paragraph (chapter openers). */
  dropCap?: boolean;
  /** Source line under the prose: the wiki heading and article link. */
  source?: { heading: string; href: string } | null;
  className?: string;
}

export function LoreProse({ paragraphs, dropCap = true, source, className }: LoreProseProps) {
  if (paragraphs.length === 0) return null;
  return (
    <div className={cn("max-w-[38rem]", className)}>
      <div className="text-label space-y-4 font-serif text-[calc(1.0625rem*var(--text-scale,1))] leading-[1.7] text-pretty">
        {paragraphs.map((paragraph, index) => (
          <p
            key={index}
            className={cn(
              index === 0 &&
                dropCap &&
                "first-letter:text-tint first-letter:float-left first-letter:mt-1 first-letter:mr-2 first-letter:font-serif first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:font-semibold"
            )}
          >
            {paragraph}
          </p>
        ))}
      </div>
      {source && (
        <Link
          href={createUrl(source.href)}
          className="text-footnote text-label-secondary hover:text-tint focus-visible:outline-tint rounded-control-sm mt-3 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <OpenBook aria-hidden className="size-3.5" />
          From the wiki: {source.heading}
        </Link>
      )}
    </div>
  );
}
