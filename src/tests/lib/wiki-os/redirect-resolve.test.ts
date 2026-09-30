/** @jest-environment node */
/**
 * Plan 402: redirects resolve from Postgres rows alone (the stored columns, else the wikitext),
 * follow at most two hops, survive loops, and never call MediaWiki for a missing page.
 */
import { ixwikiResolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-reader";

interface Row {
  title: string;
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
  wikitext: string;
}

const mockRows = new Map<string, Row>();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiArticle: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
      findMany: (...a: unknown[]) => mockFindMany(...a),
    },
  },
}));

const page = (title: string, wikitext = "Body."): Row => ({
  title,
  redirectTargetSlug: null,
  redirectTargetFragment: null,
  wikitext,
});
const redirectTo = (title: string, target: string, fragment: string | null = null): Row => ({
  ...page(title, `#REDIRECT [[${target}]]`),
  redirectTargetSlug: target,
  redirectTargetFragment: fragment,
});
const add = (...rows: Row[]) => rows.forEach((row) => mockRows.set(row.title, row));

const fetchMock = jest.fn();
const realFetch = globalThis.fetch;

beforeEach(() => {
  jest.clearAllMocks();
  mockRows.clear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  mockFindUnique.mockImplementation(
    async (args: { where: { source_title: { title: string } } }) =>
      mockRows.get(args.where.source_title.title) ?? null
  );
  mockFindMany.mockImplementation(async (args: { where: { slug: string } }) =>
    [...mockRows.values()].filter((row) => row.title.toLowerCase().replace(/ /g, "_") === args.where.slug)
  );
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("ixwikiResolveRedirect", () => {
  it("follows a stored redirect and reports its fragment", async () => {
    add(redirectTo("Old", "New", "Sec one"), page("New"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "New",
      fragment: "Sec one",
    });
    expect(mockFindUnique.mock.calls[0]?.[0]).toMatchObject({
      where: { source_title: { source: "ixwiki", title: "Old" } },
      select: {
        redirectTargetSlug: true,
        redirectTargetFragment: true,
        wikitext: true,
      },
    });
  });

  it("resolves a chain A to B to C to C", async () => {
    add(redirectTo("A", "B"), redirectTo("B", "C"), page("C"));

    await expect(ixwikiResolveRedirect("A")).resolves.toEqual({ title: "C", fragment: null });
  });

  it("stops after two hops", async () => {
    add(redirectTo("A", "B"), redirectTo("B", "C"), redirectTo("C", "D"), page("D"));

    await expect(ixwikiResolveRedirect("A")).resolves.toEqual({ title: "C", fragment: null });
  });

  it("ends on B for a loop A to B to A, without hanging", async () => {
    add(redirectTo("A", "B"), redirectTo("B", "A"));

    await expect(ixwikiResolveRedirect("A")).resolves.toEqual({ title: "B", fragment: null });
  });

  it("reads a redirect from its wikitext when the columns are not backfilled yet", async () => {
    add(page("Old", "#redirect [[new_page#Part]]"), page("New page"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "New page",
      fragment: "Part",
    });
  });

  it("returns an ordinary page unchanged, even when #REDIRECT appears later in its text", async () => {
    add(page("Plain", "Intro.\n#REDIRECT [[Elsewhere]]"));

    await expect(ixwikiResolveRedirect("Plain")).resolves.toEqual({
      title: "Plain",
      fragment: null,
    });
  });

  it("canonicalizes the target a stored column holds", async () => {
    add(redirectTo("Old", "new_page"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "New page",
      fragment: null,
    });
  });

  it("follows the one case-variant row a lower-case URL matches", async () => {
    add(redirectTo("NATO", "North Atlantic Treaty Organization"));

    await expect(ixwikiResolveRedirect("nato")).resolves.toMatchObject({
      title: "North Atlantic Treaty Organization",
    });
  });

  it("returns a missing title as given and never calls MediaWiki", async () => {
    await expect(ixwikiResolveRedirect("No_such_page")).resolves.toEqual({
      title: "No_such_page",
      fragment: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a title MediaWiki would refuse as given, without a query", async () => {
    await expect(ixwikiResolveRedirect("a[b")).resolves.toEqual({ title: "a[b", fragment: null });
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the input when the database fails", async () => {
    mockFindUnique.mockRejectedValue(new Error("db down"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({ title: "Old", fragment: null });
  });
});
