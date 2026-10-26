/**
 * @jest-environment node
 *
 * The wiki harness the benches and parity scripts share: it never hits one wiki host faster than once a second (and
 * ixwiki.com at least a second apart, with the allowlisted IxStats-Builder agent), and reads only a local database.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  fetchUntilSettled,
  isLocalDatabaseUrl,
  chunked,
  mediaWikiParseError,
  mediaWikiParseQuery,
  needsSettling,
  normalizeHtml,
  parseNamespaces,
  parseRevisionMap,
  revisionContentModels,
  similarity,
  throttledFetch,
  type Parsed,
} from "../../../scripts/lib/wikios-harness";
describe("throttledFetch", () => {
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  let starts: Array<{ url: string; at: number; init: RequestInit | undefined }>;

  beforeEach(() => {
    jest.useFakeTimers();
    starts = [];
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      starts.push({ url: String(input), at: Date.now(), init });
      return new Response("ok", { status: 200 });
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("spaces two calls to the same host by at least 1000 ms", async () => {
    const first = throttledFetch("https://spacing.example.test/a", {}, { minIntervalMs: 1000 });
    const second = throttledFetch("https://spacing.example.test/b", {}, { minIntervalMs: 1000 });
    await jest.advanceTimersByTimeAsync(5000);
    const [one, two] = await Promise.all([first, second]);
    expect(one.status).toBe(200);
    expect(two.body).toBe("ok");
    expect(starts).toHaveLength(2);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
  });
  it("never goes below one second for ixwiki.com hosts and sends the allowlisted User-Agent", async () => {
    const first = throttledFetch("https://ixwiki.com/api.php", {}, { minIntervalMs: 0 });
    const second = throttledFetch("https://ixwiki.com/wiki/Main_Page", {}, { minIntervalMs: 0 });
    await jest.advanceTimersByTimeAsync(5000);
    await Promise.all([first, second]);
    expect(starts[1].at - starts[0].at).toBeGreaterThanOrEqual(1000);
    expect(new Headers(starts[0].init?.headers).get("user-agent")).toBe("IxStats-Builder");
  });
  it("resolves with status 0 instead of throwing on an invalid or non-http URL", async () => {
    await expect(throttledFetch("not a url")).resolves.toMatchObject({
      status: 0,
      bytes: 0,
      error: "invalid URL: not a url",
    });
    await expect(throttledFetch("file:///etc/passwd")).resolves.toMatchObject({ status: 0 });
    await expect(throttledFetch("ftp://example.test/x")).resolves.toMatchObject({ status: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("page lists and URLs", () => {
  it("only treats a localhost DATABASE_URL as readable", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:5433/ixstats")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@db.example.com:5432/ixstats")).toBe(false);
    expect(isLocalDatabaseUrl("")).toBe(false);
  });

  it("localhost:15433 is not local; localhost:5433 is", () => {
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:5433/ixstats_proof")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost/ixstats_proof")).toBe(true);
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:15433/ixstats")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u:p@127.0.0.1:15433/ixstats?schema=public")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u:p@[::1]:15433/ixstats")).toBe(false);
    expect(isLocalDatabaseUrl("postgresql://u:p@localhost:015433/ixstats")).toBe(false);
  });
});

describe("the round trip's database guard", () => {
  const script = resolve(__dirname, "../../../scripts/audit/wikios-roundtrip.ts");
  const tunnel = "postgresql://nobody:nothing@localhost:15433/none";
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), "wikios-roundtrip-guard-"));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  // Bun loads .env and .env.local itself; the script adds .env.local.dev. Each must be checked.
  it.each([".env.local.dev", ".env.local", ".env"])(
    "refuses the production tunnel port when DATABASE_URL comes from %s",
    (file) => {
      writeFileSync(join(cwd, file), `DATABASE_URL="${tunnel}"\n`);
      const env: NodeJS.ProcessEnv = { ...process.env };
      delete env.DATABASE_URL;
      const out = join(cwd, "out.json");
      const result = spawnSync(
        "bun",
        [script, "--source", "db", "--namespaces", "all", "--limit", "5", "--out", out],
        { cwd, env, encoding: "utf-8", timeout: 60_000 }
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(/refusing to read it/);
      expect(existsSync(out)).toBe(false);
    },
    90_000
  );
});

describe("parseNamespaces", () => {
  it("parseNamespaces reads all, a list, and the default 0; rejects junk", () => {
    expect(parseNamespaces(undefined)).toEqual([0]);
    expect(parseNamespaces("all")).toBe("all");
    expect(parseNamespaces("0,10,14")).toEqual([0, 10, 14]);
    expect(parseNamespaces("4")).toEqual([4]);
    for (const junk of ["", "ALL", "0,", ",0", "0,,10", "a", "-1", "1.5", "0;10", " 0"]) {
      expect(() => parseNamespaces(junk)).toThrow("--namespaces must be all or a comma list of namespace numbers");
    }
  });
});

describe("settling a WikiOS view", () => {
  type View = { html: string; renderQuality?: string; stale?: boolean };

  it("needsSettling is true for fallback or stale, false for a rendered fresh view", () => {
    expect(needsSettling({ renderQuality: "fallback" })).toBe(true);
    expect(needsSettling({ renderQuality: "rendered", stale: true })).toBe(true);
    expect(needsSettling({ stale: true })).toBe(true);
    expect(needsSettling({ renderQuality: "rendered", stale: false })).toBe(false);
    expect(needsSettling({ renderQuality: "rendered" })).toBe(false);
    expect(needsSettling({})).toBe(false);
  });

  const sequence = (views: Array<Parsed<View>>) => {
    let call = 0;
    return jest.fn(async (): Promise<Parsed<View>> => views[Math.min(call++, views.length - 1)]);
  };

  it("a fallback or stale view is refetched, waiting between tries, until it is rendered and fresh", async () => {
    const fetchOnce = sequence([
      { ok: true, data: { html: "a", renderQuality: "fallback", stale: true } },
      { ok: true, data: { html: "b", renderQuality: "rendered", stale: true } },
      { ok: true, data: { html: "c", renderQuality: "rendered", stale: false } },
      { ok: true, data: { html: "d", renderQuality: "rendered", stale: false } },
    ]);
    const wait = jest.fn(async (_ms: number) => undefined);
    const result = await fetchUntilSettled(fetchOnce, { settleMs: 8000, settleTries: 3, wait });
    expect(result).toEqual({ ok: true, data: { html: "c", renderQuality: "rendered", stale: false } });
    expect(fetchOnce).toHaveBeenCalledTimes(3);
    expect(wait.mock.calls).toEqual([[8000], [8000]]);
  });

  it("one still unsettled after the tries is returned as such", async () => {
    const fetchOnce = sequence([{ ok: true, data: { html: "a", renderQuality: "fallback", stale: true } }]);
    const wait = jest.fn(async (_ms: number) => undefined);
    const result = await fetchUntilSettled(fetchOnce, { settleMs: 5, settleTries: 3, wait });
    expect(result).toEqual({ ok: true, data: { html: "a", renderQuality: "fallback", stale: true } });
    expect(fetchOnce).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenCalledTimes(3);
  });

  it("a fresh view and a failure are not refetched; no tries means one fetch", async () => {
    const wait = jest.fn(async (_ms: number) => undefined);
    const fresh = sequence([{ ok: true, data: { html: "a", renderQuality: "rendered", stale: false } }]);
    await fetchUntilSettled(fresh, { settleMs: 5, settleTries: 3, wait });
    expect(fresh).toHaveBeenCalledTimes(1);
    const failed = sequence([{ ok: false, error: "WikiOS HTTP 500: boom" }]);
    expect(await fetchUntilSettled(failed, { settleMs: 5, settleTries: 3, wait })).toEqual({
      ok: false,
      error: "WikiOS HTTP 500: boom",
    });
    expect(failed).toHaveBeenCalledTimes(1);
    const noTries = sequence([{ ok: true, data: { html: "a", renderQuality: "fallback" } }]);
    await fetchUntilSettled(noTries, { settleMs: 5, settleTries: 0, wait });
    expect(noTries).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("a refetch that fails is returned as the failure", async () => {
    const fetchOnce = sequence([
      { ok: true, data: { html: "a", renderQuality: "fallback" } },
      { ok: false, error: "WikiOS unreachable" },
    ]);
    const result = await fetchUntilSettled(fetchOnce, { settleMs: 5, settleTries: 3, wait: async () => undefined });
    expect(result).toEqual({ ok: false, error: "WikiOS unreachable" });
    expect(fetchOnce).toHaveBeenCalledTimes(2);
  });
});

describe("normalizing rendered text", () => {
  const mediawiki =
    '<table class="infobox">\n<tbody><tr>\n<th>Builder</th>\n<td>J. Samuel White</td></tr>\n<tr>\n<th>Launched</th>\n' +
    '<td>1933</td></tr></tbody></table>\n<div>Elfin</div>\n<p>A <b>steam</b> yacht.</p>\n<ul>\n<li>One</li>\n<li>Two</li>\n</ul>';
  const slimmed =
    '<table class="infobox"><tbody><tr><th>Builder</th><td>J. Samuel White</td></tr><tr><th>Launched</th>' +
    "<td>1933</td></tr></tbody></table><div>Elfin</div><p>A <b>steam</b> yacht.</p><ul><li>One</li><li>Two</li></ul>";

  it("cells, rows, blocks and list items are separate words with or without whitespace between them", () => {
    expect(normalizeHtml(slimmed).text).toBe("Builder J. Samuel White Launched 1933 Elfin A steam yacht. One Two");
    expect(normalizeHtml(slimmed).text).toBe(normalizeHtml(mediawiki).text);
    expect(similarity(normalizeHtml(mediawiki), normalizeHtml(slimmed)).overall).toBe(100);
  });

  it("a space lost between inline neighbours still counts against the text", () => {
    const spaced = normalizeHtml("<p>A <b>steam</b> <i>yacht</i></p>");
    const lost = normalizeHtml("<p>A <b>steam</b><i>yacht</i></p>");
    expect(lost.text).toBe("A steamyacht");
    expect(similarity(spaced, lost).text).toBeLessThan(100);
  });

  it("a line break separates the words on either side, and headings keep their own text", () => {
    const doc = normalizeHtml("<h2>History</h2><p>Laid down<br>June 1933</p>");
    expect(doc.text).toBe("History Laid down June 1933");
    expect(doc.headings).toEqual(["History"]);
  });
});

describe("parity by revision", () => {
  it("parses the revision WikiOS holds when it is known, else the current page with redirects followed", () => {
    expect(mediaWikiParseQuery("Kagazi", 114395)).toMatchObject({ action: "parse", oldid: "114395" });
    expect(mediaWikiParseQuery("Kagazi", 114395)).not.toHaveProperty("page");
    expect(mediaWikiParseQuery("Kagazi", 114395)).not.toHaveProperty("redirects");
    expect(mediaWikiParseQuery("Kagazi", undefined)).toMatchObject({ page: "Kagazi", redirects: "1" });
    expect(mediaWikiParseQuery("Kagazi", undefined)).not.toHaveProperty("oldid");
    expect(mediaWikiParseQuery("Kagazi", 1).prop).toBe("text|categories|templates|images|displaytitle");
  });

  it("a revision MediaWiki refuses is drift (nosuchrevid); other errors, and a page asked by title, keep their codes", () => {
    for (const code of ["nosuchrevid", "missingtitle", "permissiondenied"]) {
      expect(mediaWikiParseError(code, "gone", 42)).toBe(
        `MediaWiki: nosuchrevid: revision 42 is gone or hidden (${code}: gone)`
      );
    }
    expect(mediaWikiParseError("internal_api_error_Error", "boom", 42)).toBe(
      "MediaWiki: internal_api_error_Error: boom"
    );
    expect(mediaWikiParseError("missingtitle", "gone", undefined)).toBe("MediaWiki: missingtitle: gone");
  });

  it("reads the revisions file, and refuses one that is not titles to rev ids", () => {
    expect(parseRevisionMap('{"A": 7, "B C": 9}')).toEqual(new Map([["A", 7], ["B C", 9]]));
    expect(() => parseRevisionMap('{"A": "7"}')).toThrow();
    expect(() => parseRevisionMap('{"A": 0}')).toThrow();
  });

  it("reads each revision's content model from the main slot, and leaves out a revision the answer omits", () => {
    const answer = JSON.stringify({
      query: {
        pages: [
          {
            title: "Infobox/styles.css",
            revisions: [{ revid: 92495, slots: { main: { contentmodel: "sanitized-css" } } }],
          },
          { title: "Kagazi", revisions: [{ revid: 114395, slots: { main: { contentmodel: "wikitext" } } }] },
          { title: "Old", revisions: [{ revid: 5, contentmodel: "wikitext" }] },
          { title: "Hidden", missing: true },
        ],
      },
    });
    expect(revisionContentModels(answer)).toEqual(
      new Map([
        [92495, "sanitized-css"],
        [114395, "wikitext"],
        [5, "wikitext"],
      ])
    );
    expect(revisionContentModels(JSON.stringify({ batchcomplete: true }))).toEqual(new Map());
  });

  it("slices rev ids for the API's 50 a request", () => {
    expect(chunked([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunked([], 50)).toEqual([]);
  });
});
