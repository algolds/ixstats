/** @jest-environment node */
/**
 * Plan 402: a historical revision imported without its text ("" for a synced revision, or "" with
 * a non-zero byteSize) has UNKNOWN text, reported as null, never as an empty page. A native
 * WikiOS revision that really is empty stays "". Both kinds of reference are scoped to IxWiki.
 */
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const mockFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: { wikiRevision: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

const createdAt = new Date("2026-06-01T00:00:00Z");
const row = (wikitext: string, byteSize: number, mwRevId: number | null = null) => ({
  wikitext,
  byteSize,
  mwRevId,
  source: "ixwiki",
  createdAt,
  article: { title: "Foo" },
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ixwikiGetRevisionWikitext placeholders", () => {
  it("reports the text of an imported placeholder revision as unknown", async () => {
    mockFindFirst.mockResolvedValue(row("", 4096));

    await expect(getRevisionWikitext("cnative00000001")).resolves.toEqual({
      wikitext: null,
      title: "Foo",
      source: "ixwiki",
      timestamp: createdAt.toISOString(),
    });
    expect(mockFindFirst.mock.calls[0]?.[0].select).toMatchObject({
      byteSize: true,
      mwRevId: true,
      source: true,
    });
  });

  it("reports an empty synced revision as unknown whatever its byteSize says", async () => {
    mockFindFirst.mockResolvedValue(row("", 0, 5001));

    await expect(getRevisionWikitext("5001")).resolves.toMatchObject({ wikitext: null });
  });

  it("keeps the text of a native revision that really is empty", async () => {
    mockFindFirst.mockResolvedValue(row("", 0));

    await expect(getRevisionWikitext("cnative00000002")).resolves.toMatchObject({ wikitext: "" });
  });

  it("keeps the text of an ordinary revision, synced or native", async () => {
    mockFindFirst.mockResolvedValue(row("body", 4, 5003));
    await expect(getRevisionWikitext("5003")).resolves.toMatchObject({ wikitext: "body" });

    mockFindFirst.mockResolvedValue(row("body", 4));
    await expect(getRevisionWikitext("cnative00000003")).resolves.toMatchObject({
      wikitext: "body",
    });
  });
});

describe("ixwikiGetRevisionWikitext source scope", () => {
  it("scopes a MediaWiki revision id to ixwiki", async () => {
    mockFindFirst.mockResolvedValue(row("body", 4, 5003));

    await getRevisionWikitext("5003");

    expect(mockFindFirst.mock.calls[0]?.[0].where).toEqual({ source: "ixwiki", mwRevId: 5003 });
  });

  it("scopes a WikiOS revision row id to ixwiki too", async () => {
    mockFindFirst.mockResolvedValue(row("body", 4));

    await getRevisionWikitext("cnative00000004");

    expect(mockFindFirst.mock.calls[0]?.[0].where).toEqual({
      source: "ixwiki",
      id: "cnative00000004",
    });
  });

  it("returns null for a revision that is not IxWiki's", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getRevisionWikitext("cforeign0000001")).resolves.toBeNull();
  });
});
