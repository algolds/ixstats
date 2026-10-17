"use client";

import { Button } from "~/components/ui/button";

/** The next page's button, or why the next page did not load. */
export function MoreCards(props: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onMore: () => void;
}) {
  if (props.failed) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p className="text-callout text-label-secondary">More cards did not load.</p>
        <Button size="sm" variant="secondary" onClick={props.onMore}>
          Try again
        </Button>
      </div>
    );
  }
  if (!props.hasMore) return null;
  return (
    <Button variant="secondary" className="w-full" disabled={props.loading} onClick={props.onMore}>
      Show more
    </Button>
  );
}
