import { cn } from "~/lib/utils/cn";

/**
 * The wiki Reading style: the WikiOS reading
 * face (`--wikios-font-reading`, the same token `.wikios-article-content` reads) at
 * a reading size with comfortable leading. Shared by every block of lore prose.
 */
export const READING_STYLE =
  "font-(family-name:--wikios-font-reading) text-label text-[calc(1.0625rem*var(--text-scale,1))] leading-[1.7] text-pretty";

/** The opening paragraph, set larger as a lead (the magazine opener). */
const LEAD = "text-[1.3em] leading-[1.45] font-medium";

/**
 * LoreProse — wiki lore in the Reading style: a 38rem measure, the reading face, generous
 * leading, and the opening paragraph set as a lead. Data never sits inside this block; weave it
 * around the prose.
 */
interface LoreProseProps {
  paragraphs: readonly string[];
  className?: string;
}

export function LoreProse({ paragraphs, className }: LoreProseProps) {
  if (paragraphs.length === 0) return null;
  return (
    <div className={cn("max-w-[38rem] space-y-4", READING_STYLE, className)}>
      {paragraphs.map((paragraph, index) => (
        <p key={index} className={cn(index === 0 && LEAD)}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}
