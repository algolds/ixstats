/** @jest-environment node */
/**
 * Plan 402: redirects resolve from Postgres rows alone (the wikitext, never a stored column), follow
 * at most two hops, survive loops, and never call MediaWiki for a missing page. Plan 404: only the
 * first 1024 characters of a page are read, in the database.
 */
import { ixwikiResolveRedirect } from "~/lib/wiki-os/adapters/mediawiki/bridge/pg-reader";

interface Row {
  title: string;
  redirectTargetSlug: string | null;
  redirectTargetFragment: string | null;
  wikitext: string;
}

const HEAD_LENGTH = 1024;

const mockRows = new Map<string, Row>();
const mockFindUnique = jest.fn();
const mockFindMany = jest.fn();

/** The raw query as Prisma's tagged template hands it over, with `left(x, n)` done the way Postgres does it. */
const mockQueryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
  const sql = strings.join("$");
  const left = /left\("wikitext", (\d+)\)/.exec(sql);
  const length = Number(left?.[1] ?? Infinity);
  if (sql.includes('"title" =')) {
    const row = mockRows.get(String(values[0]));
    return row ? [{ head: row.wikitext.slice(0, length) }] : [];
  }
  if (sql.includes('"slug" =')) {
    return [...mockRows.values()]
      .filter((row) => row.title.toLowerCase().replace(/ /g, "_") === values[0])
      .slice(0, 2)
      .map((row) => ({ head: row.wikitext.slice(0, length) }));
  }
  throw new Error(`unexpected query: ${sql}`);
});

jest.mock("~/server/db", () => ({
  db: {
    $queryRaw: (...a: Parameters<typeof mockQueryRaw>) => mockQueryRaw(...a),
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
  ...page(title, `#REDIRECT [[${target}${fragment ? `#${fragment}` : ""}]]`),
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
});

afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("ixwikiResolveRedirect", () => {
  it("follows a redirect and reports its fragment", async () => {
    add(redirectTo("Old", "New", "Sec one"), page("New"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "New",
      fragment: "Sec one",
    });
    const [strings, ...values] = mockQueryRaw.mock.calls[0]!;
    expect(strings.join("$")).toContain(`"source" = 'ixwiki' AND "title" = $`);
    expect(values).toEqual(["Old"]);
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

  it("never follows a stale column: the wikitext decides", async () => {
    const staleColumn: Row = {
      ...page("Article", "Now a real article."),
      redirectTargetSlug: "Elsewhere",
      redirectTargetFragment: "Old",
    };
    add(staleColumn);

    await expect(ixwikiResolveRedirect("Article")).resolves.toEqual({
      title: "Article",
      fragment: null,
    });
  });

  it("follows the wikitext's target when the column names another page", async () => {
    add({ ...redirectTo("Old", "Right"), redirectTargetSlug: "Wrong", redirectTargetFragment: "X" });

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "Right",
      fragment: null,
    });
  });

  it("keeps the most recent fragment of an earlier hop when the last hop has none", async () => {
    add(redirectTo("A", "B", "Part one"), redirectTo("B", "C"), page("C"));

    await expect(ixwikiResolveRedirect("A")).resolves.toEqual({
      title: "C",
      fragment: "Part one",
    });
  });

  it("prefers the last hop's own fragment", async () => {
    add(redirectTo("A", "B", "Part one"), redirectTo("B", "C", "Part two"), page("C"));

    await expect(ixwikiResolveRedirect("A")).resolves.toEqual({
      title: "C",
      fragment: "Part two",
    });
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

  it("canonicalizes the target the wikitext names", async () => {
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
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the input when the database fails", async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error("db down"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({ title: "Old", fragment: null });
  });
});

describe("ixwikiResolveRedirect reads only the head of a page (plan 404)", () => {
  const megabytes = (n: number) => "x".repeat(n * 1024 * 1024);

  /** The rows the raw queries actually returned, i.e. what crossed from the database. */
  const returnedHeads = async () =>
    (
      await Promise.all(
        mockQueryRaw.mock.results.map((r) => r.value as Promise<{ head: string }[]>)
      )
    )
      .flat()
      .map((row) => row.head);

  it("transfers only the prefix of a 2 MB page that is not a redirect", async () => {
    add(page("Big", `Intro.\n${megabytes(2)}`));

    await expect(ixwikiResolveRedirect("Big")).resolves.toEqual({ title: "Big", fragment: null });

    const [strings] = mockQueryRaw.mock.calls[0]!;
    const sql = strings.join("$");
    expect(sql).toContain(`SELECT left("wikitext", ${HEAD_LENGTH}) AS head`);
    expect(sql).not.toMatch(/SELECT\s+"?wikitext/);
    const heads = await returnedHeads();
    expect(heads).toHaveLength(1);
    expect(heads[0]!.length).toBeLessThanOrEqual(HEAD_LENGTH);
    // Not one query reads the client's whole-row path.
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("still follows a redirect that sits in front of 2 MB of text", async () => {
    add(page("Old", `#REDIRECT [[New page#Part]]\n${megabytes(2)}`), page("New page"));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: "New page",
      fragment: "Part",
    });
    for (const head of await returnedHeads()) expect(head.length).toBeLessThanOrEqual(HEAD_LENGTH);
  });

  it("reads the prefix in the slug fallback too", async () => {
    add(page("NATO", `#REDIRECT [[North Atlantic Treaty Organization]]\n${megabytes(2)}`));

    await expect(ixwikiResolveRedirect("nato")).resolves.toMatchObject({
      title: "North Atlantic Treaty Organization",
    });

    const fallback = mockQueryRaw.mock.calls[1]!;
    expect(fallback[0].join("$")).toContain(`left("wikitext", ${HEAD_LENGTH})`);
    expect(fallback[0].join("$")).toContain(`"slug" = $`);
    for (const head of await returnedHeads()) expect(head.length).toBeLessThanOrEqual(HEAD_LENGTH);
  });

  it("does not guess between two case-variant rows", async () => {
    add(redirectTo("NATO", "A"), redirectTo("NAto", "B"));

    await expect(ixwikiResolveRedirect("nato")).resolves.toEqual({ title: "nato", fragment: null });
  });

  it("follows a redirect whose target is a long title", async () => {
    const longTitle = `Treaty of ${"Long ".repeat(40)}Name`;
    add(redirectTo("Old", longTitle), page(longTitle));

    await expect(ixwikiResolveRedirect("Old")).resolves.toEqual({
      title: longTitle,
      fragment: null,
    });
  });
});
