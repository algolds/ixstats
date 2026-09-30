/** @jest-environment node */
/**
 * Plan 408: text an administrator deleted (MediaWiki revision deletion) is unknown to a reader,
 * exactly like an unfilled placeholder: never an empty page, even with size 0 and no rev id.
 */
import { getRevisionWikitext } from "~/lib/wiki-os/adapters/mediawiki/bridge";

const mockFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: { wikiRevision: { findFirst: (...a: unknown[]) => mockFindFirst(...a) } },
}));

const row = (overrides: Record<string, unknown>) => ({
  wikitext: "",
  byteSize: 0,
  textDeleted: false,
  mwRevId: null,
  source: "ixwiki",
  createdAt: new Date("2026-06-01T00:00:00Z"),
  article: { title: "Foo" },
  ...overrides,
});

beforeEach(() => jest.clearAllMocks());

describe("getRevisionWikitext and deleted text", () => {
  it("reports a deleted revision's text as unknown even when it is empty with size 0", async () => {
    mockFindFirst.mockResolvedValue(row({ textDeleted: true }));

    await expect(getRevisionWikitext("cnative00000001")).resolves.toMatchObject({ wikitext: null });
    expect(mockFindFirst.mock.calls[0]?.[0].select).toMatchObject({ textDeleted: true });
  });

  it("still reads a native revision that really is empty, and ordinary text", async () => {
    mockFindFirst.mockResolvedValueOnce(row({}));
    await expect(getRevisionWikitext("cnative00000002")).resolves.toMatchObject({ wikitext: "" });

    mockFindFirst.mockResolvedValueOnce(row({ wikitext: "body", byteSize: 4 }));
    await expect(getRevisionWikitext("cnative00000003")).resolves.toMatchObject({
      wikitext: "body",
    });
  });
});
