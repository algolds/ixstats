/** @jest-environment node */
/**
 * mirror-history.ts: a title's latest deletion in classic MediaWiki is its newest `delete` entry of the delete log,
 * never a revision deletion (also logged as type `delete`) nor another page's entry.
 */
import type { LogEvent } from "~/lib/wiki-os/services/inbound-mediawiki";

const mockFetchLogEvents = jest.fn();
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/wiki-os/services/inbound-mediawiki", () => ({
  fetchLogEventsPage: (...args: unknown[]) => mockFetchLogEvents(...args),
}));

import { latestClassicDelete } from "~/lib/wiki-os/services/mirror-history";

const event = (logid: number, over: Partial<LogEvent>): LogEvent => ({
  logid,
  type: "delete",
  action: "delete",
  title: "Caphiria",
  user: "Admin",
  timestamp: "2026-10-24T10:00:00Z",
  comment: "",
  params: {},
  ...over,
});

describe("latestClassicDelete", () => {
  it("asks the delete log for the title, and takes its newest delete of the page", async () => {
    mockFetchLogEvents.mockResolvedValue({
      entries: [
        event(4, { action: "revision" }),
        event(3, { title: "Old page" }),
        event(2, {}),
        event(1, {}),
      ],
      next: null,
    });

    await expect(latestClassicDelete("Caphiria")).resolves.toMatchObject({ logid: 2 });

    expect(mockFetchLogEvents).toHaveBeenCalledWith(
      expect.objectContaining({ letype: "delete", letitle: "Caphiria" })
    );
  });

  it("is null for a page classic never deleted", async () => {
    mockFetchLogEvents.mockResolvedValue({
      entries: [event(3, { title: "Old page" })],
      next: null,
    });

    await expect(latestClassicDelete("Caphiria")).resolves.toBeNull();
  });
});
