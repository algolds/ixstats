import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils/cn";

/**
 * Marks a parked revision: a MediaWiki edit that was not made on top of WikiOS's current revision. It
 * is kept in the history and in the lists of edits, but it is never the page's live text.
 */
export function ParkedBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Made in MediaWiki on an older version of the page: kept in the history, not the live text"
      className={cn("border-destructive/40 text-destructive px-1.5 py-0 font-semibold", className)}
    >
      conflict, not live
    </Badge>
  );
}
