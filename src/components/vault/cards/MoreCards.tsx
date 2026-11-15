"use client";

import { Button } from "~/components/ui/button";
import { Signal } from "~/components/ui/signal";

/** The next page's button, or why the next page did not load. */
export function MoreCards(props: {
  hasMore: boolean;
  loading: boolean;
  failed: boolean;
  onMore: () => void;
}) {
  if (props.failed) {
    return (
      <Signal tone="destructive" title="More cards did not load">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>Try loading the next page again.</span>
          <Button size="sm" variant="secondary" onClick={props.onMore}>
            Try again
          </Button>
        </div>
      </Signal>
    );
  }
  if (!props.hasMore) return null;
  return (
    <Button variant="secondary" className="w-full" disabled={props.loading} onClick={props.onMore}>
      Show more
    </Button>
  );
}
