/** @jest-environment node */
/**
 * Plan 402: a historical revision imported without its text ("" with a non-zero byteSize) has
 * UNKNOWN text, reported as null, never as an empty page. A revision that really is empty stays "".
 */
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const mockFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: { wikiRevision: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

const createdAt = new Date("2026-06-01T00:00:00Z");
const row = (wikitext: string, byteSize: number) => ({
  wikitext,
  byteSize,
  createdAt,
  article: { title: "Foo" },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ixwikiGetRevisionWikitext placeholders", () => {
  it("reports the text of an imported placeholder revision as unknown", async () => {
    mockFindFirst.mockResolvedValue(row("", 4096));

    await expect(getRevisionWikitext("5001")).resolves.toEqual({
      wikitext: null,
      title: "Foo",
      timestamp: createdAt.toISOString(),
    });
    expect(mockFindFirst.mock.calls[0]?.[0].select).toMatchObject({ byteSize: true });
  });

  it("keeps the text of a revision that really is empty", async () => {
    mockFindFirst.mockResolvedValue(row("", 0));

    await expect(getRevisionWikitext("5002")).resolves.toMatchObject({ wikitext: "" });
  });

  it("keeps the text of an ordinary revision", async () => {
    mockFindFirst.mockResolvedValue(row("body", 4));

    await expect(getRevisionWikitext("5003")).resolves.toMatchObject({ wikitext: "body" });
  });
});
