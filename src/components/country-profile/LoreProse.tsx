import Link from "next/link";
import { OpenBook } from "iconoir-react";
import { cn } from "~/lib/utils/cn";

/**
 * The wiki Reading style: the WikiOS reading
 * face (`--wikios-font-reading`, the same token `.wikios-article-content` reads) at
 * a reading size with comfortable leading. Shared by every block of lore prose.
 */
const READING_STYLE =
  "font-(family-name:--wikios-font-reading) text-label text-[calc(1.0625rem*var(--text-scale,1))] leading-[1.7] text-pretty";

/** Drop cap: the first letter in the National display face, tinted. */
const DROP_CAP =
  "first-letter:font-display first-letter:text-tint first-letter:float-left first-letter:mt-1 first-letter:mr-2 first-letter:text-[3.4em] first-letter:leading-[0.8] first-letter:font-bold";

/**
 * LoreProse — wiki lore in the Reading style: a 38rem measure, the reading face, generous
 * leading, and a drop cap on the opening paragraph. Data never sits inside this block; weave it
 * around the prose.
 */
interface LoreProseProps {
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
      <div className={cn("space-y-4", READING_STYLE)}>
        {paragraphs.map((paragraph, index) => (
          <p key={index} className={cn(index === 0 && dropCap && DROP_CAP)}>
            {paragraph}
          </p>
        ))}
      </div>
      {source && (
        <Link
          href={source.href}
          className="text-footnote text-label-secondary hover:text-tint focus-visible:outline-tint rounded-control-sm mt-3 inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <OpenBook aria-hidden className="size-3.5" />
          From the wiki: {source.heading}
        </Link>
      )}
    </div>
  );
}
