"use client";

import { Eye } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";
import { useWatchToggle } from "../useWatchToggle";

/**
 * Watch / Watching: a toggle Button in the thread's header actions, next to Stash. Its name is always "Watch thread" and
 * `aria-pressed` carries the state, so a screen reader says "Watch thread, pressed"; the visible text shows the state.
 */
export function WatchThreadButton({
  threadId,
  watching,
  iconOnly = false,
}: {
  threadId: string;
  watching: boolean;
  /** A square icon button for a narrow header; the name stays for assistive technology. */
  iconOnly?: boolean;
}) {
  const { setWatching, isPending } = useWatchToggle();
  return (
    <Button
      variant="ghost"
      size={iconOnly ? "icon-sm" : "sm"}
      className={cn(watching ? "text-tint" : "text-label-secondary", "pointer-coarse:min-h-11")}
      aria-label="Watch thread"
      aria-pressed={watching}
      disabled={isPending}
      onClick={() => void setWatching(threadId, !watching)}
    >
      <Eye aria-hidden />
      {iconOnly ? null : watching ? "Watching" : "Watch"}
    </Button>
  );
}
