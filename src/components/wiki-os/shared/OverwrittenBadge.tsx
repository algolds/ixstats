import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils/cn";

/**
 * Marks an overwritten revision: a save that a later one on the other wiki replaced (the conflict rule kept the later
 * save on both wikis). It stays in the history and in the lists of edits, with its text, but it is not the page's
 * live text.
 */
export function OverwrittenBadge({ className }: { className?: string }) {
  return (
    <Badge
      variant="outline"
      title="Kept in the history: a later edit on the other wiki was kept"
      className={cn("border-destructive/40 text-destructive px-1.5 py-0 font-semibold", className)}
    >
      overwritten
    </Badge>
  );
}
