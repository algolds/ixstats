"use client";

import { Button } from "~/components/ui/button";

/** The heading and text of each state (see `ArticleBusy`). */
function copyOf(
  title: string,
  external: { name: string } | undefined,
  refused: boolean
): { heading: string; text: string } {
  if (!external) {
    return {
      heading: "WikiOS is busy",
      text: `“${title}” could not be looked up just now. This is not the same as the page missing; try again in a moment.`,
    };
  }
  if (refused) {
    return {
      heading: `“${title}” could not be shown here`,
      text: `You can read it on ${external.name} itself.`,
    };
  }
  return {
    heading: `${external.name} could not be reached`,
    text: `“${title}” could not be loaded from ${external.name} just now. You can read it on ${external.name} itself.`,
  };
}

/**
 * The reader's "the server is busy" state: the page may well exist, WikiOS just could not look it up
 * right now (TOO_MANY_REQUESTS). Not the same thing as "no such page", so it offers a retry, never
 * "create this page". A page of another wiki that could not be reached at all (`external`) also links to
 * the page on that wiki, where the reader's browser can get through. One that wiki answered for but could not
 * render (`refused`, BAD_GATEWAY) is no outage: it says the page could not be shown here, as an embed does, and
 * offers only the page on that wiki, since trying again would get the same answer.
 */
export function ArticleBusy({
  title,
  onRetry,
  external,
  refused = false,
}: {
  title: string;
  onRetry: () => void;
  external?: { name: string; href: string };
  refused?: boolean;
}) {
  const { heading, text } = copyOf(title, external, refused);
  return (
    <div className="wikios-error rounded-card border-separator bg-surface border p-6" role="status">
      <h2 className="text-title-3 text-label mb-2">{heading}</h2>
      <p className="text-body text-label-secondary">{text}</p>
      <div className="mt-4 flex gap-3">
        {!(external && refused) && <Button onClick={onRetry}>Try again</Button>}
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
