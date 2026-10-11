"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Button } from "~/components/ui/button";
import { discussedLabel, othersOf } from "~/lib/discussed-in";
import { postHref } from "~/lib/thinkpages-forum/links";
import { cn } from "~/lib/utils/cn";
import { useDiscussionCount } from "./DiscussionCountsProvider";
import { DiscussionList } from "./DiscussionList";

/**
 * "Discussed in N posts" under an action: a link to the post when it is the only one, otherwise a button that opens the
 * list in place. `excludePostId` is the forum post showing the card ("Also discussed in N other posts"). It reads the
 * counts of the surrounding DiscussionCountsProvider and renders nothing without one, while loading, or at zero.
 */
export function DiscussedInBadge({
  activityId,
  excludePostId,
  className,
}: {
  activityId: string;
  excludePostId?: string;
  className?: string;
}) {
  const tally = useDiscussionCount(activityId);
  const [open, setOpen] = useState(false);
  const listId = useId();
  if (!tally) return null;
  const rest = othersOf(tally, excludePostId);
  if (rest.count <= 0) return null;
  const label = discussedLabel(rest.count, excludePostId !== undefined);
  const lone = rest.count === 1 ? rest.postIds[0] : undefined;
  if (lone) {
    return (
      <Link
        href={postHref(lone)}
        className={cn(
          "text-footnote text-tint inline-flex items-center hover:underline pointer-coarse:min-h-11",
          className
        )}
      >
        {label}
      </Link>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        className="text-tint self-start pointer-coarse:min-h-11"
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </Button>
      {open ? (
        <DiscussionList id={listId} activityId={activityId} excludePostId={excludePostId} />
      ) : null}
    </div>
  );
}
