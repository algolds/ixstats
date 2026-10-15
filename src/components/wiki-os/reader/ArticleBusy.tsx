"use client";

import { Button } from "~/components/ui/button";

/**
 * The reader's "the server is busy" state: the page may well exist, WikiOS just could not look it up
 * right now (TOO_MANY_REQUESTS). Not the same thing as "no such page", so it offers a retry, never
 * "create this page". A page of another wiki that could not be reached at all (`external`) also links to
 * the page on that wiki, where the reader's browser can get through.
 */
export function ArticleBusy({
  title,
  onRetry,
  external,
}: {
  title: string;
  onRetry: () => void;
  external?: { name: string; href: string };
}) {
  return (
    <div className="wikios-error rounded-card border-separator bg-surface border p-6" role="status">
      <h2 className="text-title-3 text-label mb-2">
        {external ? `${external.name} could not be reached` : "WikiOS is busy"}
      </h2>
      <p className="text-body text-label-secondary">
        {external
          ? `“${title}” could not be loaded from ${external.name} just now. You can read it on ${external.name} itself.`
          : `“${title}” could not be looked up just now. This is not the same as the page missing; try again in a moment.`}
      </p>
      <div className="mt-4 flex gap-3">
        <Button onClick={onRetry}>Try again</Button>
        {external && (
          <Button asChild variant="outline">
            <a href={external.href} rel="noreferrer">
              Open on {external.name}
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
