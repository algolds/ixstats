"use client";

import { ChatBubble } from "iconoir-react";
import { DiscussionList } from "~/components/action-links/DiscussionList";
import {
  DiscussionCountsProvider,
  useDiscussionCount,
} from "~/components/action-links/DiscussionCountsProvider";
import { discussedLabel } from "~/lib/discussed-in";
import { SheetSection } from "./SheetSection";

function DiscussedInBody({ activityId }: { activityId: string }) {
  const tally = useDiscussionCount(activityId);
  if (!tally || tally.count === 0) return null;
  return (
    <SheetSection title={discussedLabel(tally.count, false)} icon={ChatBubble}>
      <DiscussionList activityId={activityId} />
    </SheetSection>
  );
}

/** The forum posts that discuss this directive, newest first (the viewer's own visibility rules apply). */
export function IntentDiscussions({ activityId }: { activityId: string }) {
  return (
    <DiscussionCountsProvider activityIds={[activityId]}>
      <DiscussedInBody activityId={activityId} />
    </DiscussionCountsProvider>
  );
}
