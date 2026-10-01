"use client";

import { Button } from "~/components/ui/button";

/**
 * The reader's "the server is busy" state: the page may well exist, WikiOS just could not look it up
 * right now (TOO_MANY_REQUESTS). Not the same thing as "no such page", so it offers a retry, never
 * "create this page".
 */
export function ArticleBusy({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="wikios-error rounded-card border-separator bg-surface border p-6" role="status">
      <h2 className="text-title-3 text-label mb-2">WikiOS is busy</h2>
      <p className="text-body text-label-secondary">
        &ldquo;{title}&rdquo; could not be looked up just now. This is not the same as the page
        missing; try again in a moment.
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={onRetry}>Try again</Button>
      </div>
    </div>
  );
}
