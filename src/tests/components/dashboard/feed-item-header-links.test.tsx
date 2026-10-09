/**
 * Phase 4b: forum items in the feed link to the native thread, an app path. It must render as a Next `<Link>` (so
 * production's base path is added) in the same tab, not as a raw `<a target="_blank">` that would lose it.
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/wiki-os/reader/WikiLinkPreview", () => ({
  WikiHtmlContent: ({ html }: { html: string }) => <span>{html}</span>,
  WikiLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ForumLinkPreview: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { FeedItemHeader } from "~/components/dashboard/sections/feed/FeedItemHeader";

const ACTIVITY = { timestamp: new Date("2026-10-09T10:00:00Z") };

describe("FeedItemHeader external link", () => {
  it("opens a native forum thread in the app, through Next's Link", () => {
    render(
      <FeedItemHeader activity={ACTIVITY} label="Forum" titleHtml="New forum thread: Hi" externalUrl="/thinkpages/t/t1" />
    );
    const link = screen.getByRole("link", { name: /open/i });
    expect(link.getAttribute("href")).toBe("/thinkpages/t/t1");
    expect(link.getAttribute("target")).toBeNull();
  });

  it("keeps an off-site URL in a new tab", () => {
    render(
      <FeedItemHeader activity={ACTIVITY} label="Wiki" titleHtml="Edit" externalUrl="https://example.org/x" />
    );
    expect(screen.getByRole("link", { name: /open/i }).getAttribute("target")).toBe("_blank");
  });
});
