"use client";

/**
 * The reader's "the server is busy" state: the page may well exist, WikiOS just could not look it up
 * right now (TOO_MANY_REQUESTS). Not the same thing as "no such page", so it offers a retry, never
 * "create this page".
 */
export function ArticleBusy({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div className="wikios-error facet-hierarchy-child rounded-lg p-6" role="status">
      <h2 className="mb-2 text-lg font-semibold text-amber-400">WikiOS is busy</h2>
      <p className="text-sm text-zinc-400">
        &ldquo;{title}&rdquo; could not be looked up just now. This is not the same as the page
        missing; try again in a moment.
      </p>
      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="wikios-action-btn cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-500"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
