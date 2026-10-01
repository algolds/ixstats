/** @jest-environment node */
/**
 * Plan 407: `revision` mirror jobs. The revisions of a title are imported through `action=import` as one batch
 * (one page, every revision oldest first, each credited to its author and dated as it was made), the newest
 * text is verified against MediaWiki's current revision, an edit is the fallback when the import is not the
 * current one, and every revision is stamped with its MediaWiki revision. MediaWiki is a scripted fake: nothing
 * here touches a real wiki.
 */
import type { WikiMirrorJob } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { MediaWikiApiError } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import {
  executeRevisionBatch,
  MAX_BATCH_BYTES,
  planRevisionBatch,
} from "~/lib/wiki-os/services/mirror-revision";
import { mwSha1Base36, sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import { API_URL, createFakeMediaWiki, type RecordedRequest } from "~/tests/helpers/fake-mediawiki";
import { createHash } from "node:crypto";

const mockRevisionFindMany = jest.fn();
const mockRevisionUpdateMany = jest.fn();
const mockArticleUpdateMany = jest.fn();
const mockLinkFindMany = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiRevision: {
      findMany: (...a: unknown[]) => mockRevisionFindMany(...a),
      updateMany: (...a: unknown[]) => mockRevisionUpdateMany(...a),
    },
    wikiArticle: { updateMany: (...a: unknown[]) => mockArticleUpdateMany(...a) },
    wikiAccountLink: { findMany: (...a: unknown[]) => mockLinkFindMany(...a) },
  },
}));

const realFetch = globalThis.fetch;
let wiki: ReturnType<typeof createFakeMediaWiki>;

const TEXT = "'''Foo''' is a [[country]] <ref>in Eurth</ref> & more.\n";
const MADE_AT = new Date("2026-09-27T10:20:30.456Z");

const revisionRow = (over: Record<string, unknown> = {}) => ({
  id: "rev-1",
  wikitext: TEXT,
  author: "Some Country",
  authorId: "user-1",
  summary: "fix the lead",
  minor: false,
  createdAt: MADE_AT,
  mwRevId: null,
  sha1: mwSha1Base36(TEXT),
  ...over,
});

/** The revisions the database holds (what the planner reads by id). */
let stored: Array<ReturnType<typeof revisionRow>> = [];
const revisionsAre = (...rows: Array<ReturnType<typeof revisionRow>>) => void (stored = rows);
/** The verified wiki accounts of WikiOS users: id -> username. */
const linksAre = (accounts: Record<string, string>) =>
  mockLinkFindMany.mockImplementation(async ({ where }: { where: { userId: { in: string[] } } }) =>
    where.userId.in.flatMap((userId) =>
      accounts[userId] ? [{ userId, username: accounts[userId] }] : []
    )
  );

/** Plan and send a batch of jobs, as the worker does. */
const runBatch = async (jobs: WikiMirrorJob[]) =>
  executeRevisionBatch(await planRevisionBatch(jobs));
/** The MediaWiki revision the one job's text ended up in. */
const runRevisionJob = async (single: WikiMirrorJob) =>
  (await runBatch([single]))[0]?.mwRevId ?? null;

const job = (over: Partial<WikiMirrorJob> = {}): WikiMirrorJob => ({
  id: "job-1",
  source: "ixwiki",
  kind: "revision",
  title: "Foo bar",
  articleId: "art-1",
  revisionId: "rev-1",
  logId: null,
  payload: null,
  state: "running",
  attempts: 1,
  nextAttemptAt: new Date(),
  lastError: null,
  mwRevId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

/** MediaWiki's hex SHA-1 of `text`, as the API reports it. */
const hexSha1 = (text: string) => createHash("sha1").update(text, "utf8").digest("hex");

/** `prop=revisions` answers with `revid` holding `text` (or nothing when the page is missing). */
function currentRevisionIs(revid: number | null, text = TEXT) {
  wiki.on("query", () =>
    revid === null
      ? { query: { pages: [{ title: "Foo bar", missing: true }] } }
      : { query: { pages: [{ title: "Foo bar", revisions: [{ revid, sha1: hexSha1(text) }] }] } }
  );
}

/** `prop=revisions` answers with each head in turn (the last one for every query after): the page as MediaWiki has it. */
function currentRevisionsAre(heads: Array<{ revid: number; text: string }>) {
  const queue = [...heads];
  wiki.on("query", () => {
    const head = queue.length > 1 ? queue.shift()! : queue[0]!;
    return {
      query: {
        pages: [{ title: "Foo bar", revisions: [{ revid: head.revid, sha1: hexSha1(head.text) }] }],
      },
    };
  });
}

const importOk = () =>
  wiki.on("import", () => ({ import: [{ ns: 0, title: "Foo bar", revisions: 1 }] }));
const requestsTo = (action: string): RecordedRequest[] =>
  wiki.calls().filter((request) => request.params.action === action);
/** The `<timestamp>` of the one revision in an import's XML. */
const xmlTimestamp = (xml: string) => /<timestamp>([^<]+)<\/timestamp>/.exec(xml)?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  wiki = createFakeMediaWiki();
  globalThis.fetch = wiki.fetch as unknown as typeof fetch;

  revisionsAre(revisionRow());
  mockRevisionFindMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    stored.filter((row) => where.id.in.includes(row.id))
  );
  mockRevisionUpdateMany.mockResolvedValue({ count: 1 });
  mockArticleUpdateMany.mockResolvedValue({ count: 1 });
  linksAre({ "user-1": "Alice" });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("importing a revision", () => {
  beforeEach(() => {
    importOk();
    currentRevisionIs(777);
  });

  it("sends one page with one revision as an uploaded XML file, with the known users assigned", async () => {
    await runRevisionJob(job());

    const [call] = requestsTo("import");
    expect(call?.method).toBe("POST");
    expect(call?.params).toMatchObject({
      action: "import",
      interwikiprefix: "wikios",
      assignknownusers: "1",
      summary: "fix the lead",
      format: "json",
    });
    expect(call?.params.token).toBe("csrf-token+\\x");
    // MediaWiki wants the token after everything else, the file included
    expect(call?.order.at(-1)).toBe("token");
    expect(call?.file).toMatchObject({
      field: "xml",
      filename: "wikios.xml",
      type: "application/xml",
    });
    expect(call?.cookie).toContain("wikiSession=abc");
  });

  it("credits the revision to its author, dated when it was made, with its summary, text and hash", async () => {
    await runRevisionJob(job());

    const xml = requestsTo("import")[0]?.file?.content ?? "";
    expect(xml).toContain("<title>Foo bar</title>");
    expect(xml).toContain("<ns>0</ns>");
    expect(xmlTimestamp(xml)).toBe("2026-09-27T10:20:30Z");
    expect(xml).toContain("<username>Alice</username>");
    expect(xml).toContain("<comment>fix the lead</comment>");
    expect(xml).toContain("<model>wikitext</model>");
    expect(xml).toContain(`<sha1>${mwSha1Base36(TEXT)}</sha1>`);
    expect(xml).toContain("&lt;ref&gt;in Eurth&lt;/ref&gt; &amp; more.\n</text>");
    expect(xml).not.toContain("<minor />");
    expect(xml.match(/<revision>/g)).toHaveLength(1);
    expect(xml.match(/<page>/g)).toHaveLength(1);
  });

  it("looks the author up by the verified wiki account of the revision's user, else imports the label under the import prefix", async () => {
    await runRevisionJob(job());
    expect(mockLinkFindMany).toHaveBeenCalledWith({
      where: { userId: { in: ["user-1"] }, source: "ixwiki", verifiedAt: { not: null } },
      select: { userId: true, username: true },
    });

    linksAre({});
    await runRevisionJob(job());
    expect(requestsTo("import")[1]?.file?.content).toContain(
      "<username>wikios&gt;Some Country</username>"
    );

    revisionsAre(revisionRow({ author: null, authorId: null }));
    await runRevisionJob(job());
    expect(requestsTo("import")[2]?.file?.content).toContain(
      "<username>wikios&gt;Community Contributor</username>"
    );
    expect(mockLinkFindMany).toHaveBeenCalledTimes(2); // none for a revision with no user
  });

  describe("attribution: only a verified wiki account is imported as a bare name", () => {
    const authors = async (...rows: Array<ReturnType<typeof revisionRow>>) => {
      revisionsAre(...rows);
      await runBatch(rows.map((row, at) => job({ id: `job-${at}`, revisionId: row.id })));
      const xml = requestsTo("import").at(-1)?.file?.content ?? "";
      return [...xml.matchAll(/<username>([^<]+)<\/username>/g)].map((match) => match[1]);
    };

    it("never credits a label that is the name of a real MediaWiki user (no verified link)", async () => {
      // user-1 verified "Alice"; a save labelled "WikiOSAdmin" with no author id, and one labelled "Alice" by
      // somebody else, are not those accounts
      linksAre({ "user-1": "Alice" });

      expect(
        await authors(
          revisionRow({ id: "rev-1", author: "WikiOSAdmin", authorId: null }),
          revisionRow({ id: "rev-2", author: "Alice", authorId: "user-2" })
        )
      ).toEqual(["wikios&gt;WikiOSAdmin", "wikios&gt;Alice"]);
    });

    it("never credits a label that looks like an IP address as an anonymous edit", async () => {
      expect(
        await authors(
          revisionRow({ id: "rev-1", author: "127.0.0.1", authorId: null }),
          revisionRow({ id: "rev-2", author: "2001:db8::1", authorId: null })
        )
      ).toEqual(["wikios&gt;127.0.0.1", "wikios&gt;2001:db8::1"]);
    });

    it("keeps the verified account bare, whatever the label says", async () => {
      expect(
        await authors(revisionRow({ id: "rev-1", author: "Some Country", authorId: "user-1" }))
      ).toEqual(["Alice"]);
    });

    it("imports a blank label under the default name, prefixed", async () => {
      expect(await authors(revisionRow({ id: "rev-1", author: "   ", authorId: null }))).toEqual([
        "wikios&gt;Community Contributor",
      ]);
    });
  });

  it("marks a minor edit minor", async () => {
    revisionsAre(revisionRow({ minor: true }));

    await runRevisionJob(job());

    expect(requestsTo("import")[0]?.file?.content).toContain("<minor />");
  });

  it("imports under the title the job was written with, the namespace and content model of that title", async () => {
    await runRevisionJob(job({ title: "Module:Box" }));
    await runRevisionJob(job({ title: "Template:Box" }));

    const [module, template] = requestsTo("import").map((call) => call.file?.content ?? "");
    expect(module).toContain("<title>Module:Box</title>");
    expect(module).toContain("<ns>828</ns>");
    expect(module).toContain("<model>Scribunto</model>");
    expect(template).toContain("<ns>10</ns>");
    expect(template).toContain("<model>wikitext</model>");
  });

  it("asks MediaWiki for the page's current revision and its hash, after the import", async () => {
    await runRevisionJob(job());

    const calls = wiki.calls();
    const verify = calls.find((request) => request.params.prop === "revisions");
    expect(verify?.params).toMatchObject({
      action: "query",
      titles: "Foo bar",
      rvprop: "ids|sha1|timestamp",
      rvlimit: "1",
    });
    expect(calls.indexOf(verify!)).toBeGreaterThan(
      calls.findIndex((r) => r.params.action === "import")
    );
  });

  it("stamps the WikiOS revision and the article with the MediaWiki revision that holds the text", async () => {
    await expect(runRevisionJob(job())).resolves.toBe(777);

    expect(mockRevisionUpdateMany).toHaveBeenCalledWith({
      where: { id: "rev-1", mwRevId: null },
      data: { mwRevId: 777 },
    });
    expect(mockArticleUpdateMany).toHaveBeenCalledWith({
      where: { id: "art-1" },
      data: { mwLatestRevId: 777, lastMwSyncAt: expect.any(Date) },
    });
    expect(requestsTo("edit")).toHaveLength(0);
  });

  it("stamps the hash too on a revision that predates the column", async () => {
    revisionsAre(revisionRow({ sha1: null }));

    await runRevisionJob(job());

    expect(mockRevisionUpdateMany.mock.calls[0]?.[0].data).toEqual({
      mwRevId: 777,
      sha1: mwSha1Base36(TEXT),
    });
  });

  it("compares the text exactly: a trailing newline is part of the hash", async () => {
    currentRevisionIs(778, TEXT.trimEnd());
    wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 779 } }));

    await expect(runRevisionJob(job())).resolves.toBe(779);
    expect(requestsTo("edit")).toHaveLength(1);
  });

  it("accepts MediaWiki's hash in base 16 as the same hash as ours in base 36", () => {
    expect(sha1HexToBase36(hexSha1(TEXT))).toBe(mwSha1Base36(TEXT));
  });

  it("is already done for a revision the inbound sync stamped: MediaWiki has that text", async () => {
    revisionsAre(revisionRow({ mwRevId: 42 }));

    await expect(runRevisionJob(job())).resolves.toBe(42);

    expect(wiki.fetch).not.toHaveBeenCalled();
    expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
  });

  it("has nothing to mirror when the revision is gone with its page", async () => {
    revisionsAre();

    await expect(runRevisionJob(job())).resolves.toBeNull();
    await expect(runRevisionJob(job({ revisionId: null }))).resolves.toBeNull();

    expect(wiki.fetch).not.toHaveBeenCalled();
  });

  it("does not fail a job whose stamp the inbound sync recorded first (its echo row holds the MediaWiki id)", async () => {
    mockRevisionUpdateMany.mockRejectedValue(
      new ConflictError("Unique constraint violation on WikiRevision (source)")
    );

    await expect(runRevisionJob(job())).resolves.toBe(777);

    expect(mockArticleUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("fails on any other error while stamping, for the retry", async () => {
    mockRevisionUpdateMany.mockRejectedValue(new Error("db down"));

    await expect(runRevisionJob(job())).rejects.toThrow("db down");
  });

  it("renews an expired CSRF token once and makes the call again", async () => {
    let imports = 0;
    wiki.on("import", () => {
      imports += 1;
      return imports === 1
        ? { error: { code: "badtoken", info: "Invalid CSRF token." } }
        : { import: [{ ns: 0, title: "Foo bar", revisions: 1 }] };
    });

    await expect(runRevisionJob(job())).resolves.toBe(777);

    expect(requestsTo("import")).toHaveLength(2);
    expect(wiki.requests.filter((request) => request.params.type === "csrf")).toHaveLength(2);
  });
});

describe("when MediaWiki has a newer revision", () => {
  beforeEach(() => {
    importOk();
    wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 901 } }));
  });

  it("pushes the text as an edit by the bot on top of the current revision, then stamps that revision", async () => {
    currentRevisionIs(900, "Someone else's text.");

    await expect(runRevisionJob(job())).resolves.toBe(901);

    const [edit] = requestsTo("edit");
    expect(edit?.params).toMatchObject({
      action: "edit",
      title: "Foo bar",
      text: TEXT,
      summary: "fix the lead (WikiOS)",
      bot: "1",
      baserevid: "900",
    });
    expect(edit?.params.minor).toBeUndefined();
    expect(edit?.order.at(-1)).toBe("token");
    expect(mockRevisionUpdateMany.mock.calls[0]?.[0].data).toEqual({ mwRevId: 901 });
    expect(mockArticleUpdateMany.mock.calls[0]?.[0].data).toMatchObject({ mwLatestRevId: 901 });
  });

  it("keeps a minor edit minor", async () => {
    currentRevisionIs(900, "Someone else's text.");
    revisionsAre(revisionRow({ minor: true }));

    await runRevisionJob(job());

    expect(requestsTo("edit")[0]?.params.minor).toBe("1");
  });

  it("gives an edit with no summary a default one, and cuts a long one so the suffix still fits", async () => {
    currentRevisionIs(900, "Someone else's text.");
    revisionsAre(revisionRow({ summary: null }));
    await runRevisionJob(job());
    revisionsAre(revisionRow({ summary: "s".repeat(600) }));
    await runRevisionJob(job());

    const [plain, long] = requestsTo("edit").map((call) => call.params.summary ?? "");
    expect(plain).toBe("WikiOS native edit (WikiOS)");
    expect(long).toHaveLength(480 + " (WikiOS)".length);
    expect(long.endsWith(" (WikiOS)")).toBe(true);
  });

  it("creates the page with an edit when it is missing after the import", async () => {
    currentRevisionIs(null);

    await runRevisionJob(job());

    expect(requestsTo("edit")[0]?.params.baserevid).toBeUndefined();
  });

  it("falls back to an edit when MediaWiki hides the hash", async () => {
    wiki.on("query", () => ({
      query: { pages: [{ title: "Foo bar", revisions: [{ revid: 900, sha1hidden: true }] }] },
    }));

    await runRevisionJob(job());

    expect(requestsTo("edit")).toHaveLength(1);
  });

  it("fails the job when the edit is refused, and stamps nothing", async () => {
    currentRevisionIs(900, "Someone else's text.");
    wiki.on("edit", () => ({ error: { code: "editconflict", info: "Edit conflict." } }));

    await expect(runRevisionJob(job())).rejects.toThrow(/editconflict/);

    expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
    expect(mockArticleUpdateMany).not.toHaveBeenCalled();
  });

  it("takes the revision that already holds the text when the edit changes nothing", async () => {
    currentRevisionIs(900, "Someone else's text.");
    wiki.on("edit", () => ({ edit: { result: "Success", nochange: true, oldrevid: 900 } }));

    await expect(runRevisionJob(job())).resolves.toBe(900);
  });
});

describe("when the import is refused", () => {
  it.each(["cantimport", "badinterwiki", "permissiondenied"])(
    "fails the job on %s, with MediaWiki's error, and never falls back to an edit",
    async (code) => {
      wiki.on("import", () => ({ error: { code, info: "You may not import." } }));
      currentRevisionIs(777);
      wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 901 } }));

      const failure = await runRevisionJob(job()).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(MediaWikiApiError);
      expect((failure as MediaWikiApiError).code).toBe(code);
      expect((failure as MediaWikiApiError).message).toContain("You may not import.");
      expect(requestsTo("edit")).toHaveLength(0);
      expect(requestsTo("query")).toHaveLength(0);
      expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
    }
  );

  it("fails the job on an HTTP error", async () => {
    globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.body instanceof FormData) return new Response("bad gateway", { status: 502 });
      return wiki.fetch(input, init);
    }) as unknown as typeof fetch;

    await expect(runRevisionJob(job())).rejects.toThrow(/HTTP 502/);
  });

  it("says what an oversized upload was answered with: the status and the start of the body, not a parse error", async () => {
    const page = `<html><head><title>413 Request Entity Too Large</title></head>${"<p>x</p>".repeat(100)}</html>`;
    globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.body instanceof FormData) return new Response(page, { status: 413 });
      return wiki.fetch(input, init);
    }) as unknown as typeof fetch;

    const failure = await runRevisionJob(job()).catch((error: Error) => error);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;
    expect(message).toMatch(
      /^MediaWiki import failed \(HTTP 413\): <html><head><title>413 Request Entity Too Large/
    );
    // the first 200 characters of the body, no more
    expect(message.length).toBeLessThanOrEqual("MediaWiki import failed (HTTP 413): ".length + 200);
  });

  it("says so, with the status and the start of the body, when a successful answer is not JSON", async () => {
    globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (init?.body instanceof FormData) {
        return new Response("<br />\n<b>Fatal error</b>: Allowed memory size exhausted", {
          status: 200,
        });
      }
      return wiki.fetch(input, init);
    }) as unknown as typeof fetch;

    await expect(runRevisionJob(job())).rejects.toThrow(
      "MediaWiki import answered with something that is not JSON (HTTP 200): <br /> <b>Fatal error</b>: Allowed memory size exhausted"
    );
  });
});

describe("when the bot cannot log in", () => {
  it("fails the job and writes nothing: no import, no edit, never as an anonymous session", async () => {
    wiki.state.loginResult = "Failed";
    importOk();
    wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 901 } }));

    await expect(runRevisionJob(job())).rejects.toThrow(/bot login failed/);

    expect(wiki.calls()).toEqual([]);
    expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
  });

  it("fails the job when the bot credentials are not set", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;

    await expect(runRevisionJob(job())).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_USER/);

    expect(wiki.fetch).not.toHaveBeenCalled();
  });
});

describe("a restore job (a park's re-push of WikiOS's head)", () => {
  const restore = (over: Partial<WikiMirrorJob> = {}) =>
    job({ payload: { restore: true, summary: "Restoring WikiOS revision 90" }, ...over });

  beforeEach(() => {
    importOk();
    // before the restore MediaWiki has the conflicting edit; after it, the restored head
    currentRevisionsAre([
      { revid: 700, text: "Someone else's text." },
      { revid: 777, text: TEXT },
    ]);
  });

  it("is dated now and credited to the mirror account, with the restore summary", async () => {
    const before = Date.now();
    await runRevisionJob(restore());

    const xml = requestsTo("import")[0]?.file?.content ?? "";
    const stamped = Date.parse(xmlTimestamp(xml) ?? "");
    expect(stamped).toBeGreaterThanOrEqual(Math.floor(before / 1000) * 1000);
    expect(stamped).toBeLessThanOrEqual(Date.now());
    expect(xml).toContain("<username>WikiOSMirror</username>");
    expect(xml).toContain("<comment>Restoring WikiOS revision 90</comment>");
    expect(requestsTo("import")[0]?.params.summary).toBe("Restoring WikiOS revision 90");
    expect(mockLinkFindMany).not.toHaveBeenCalled();
  });

  it("is not minor, whatever the head revision was", async () => {
    revisionsAre(revisionRow({ minor: true }));

    await runRevisionJob(restore());

    expect(requestsTo("import")[0]?.file?.content).not.toContain("<minor />");
  });

  it("is imported even though the head already has a MediaWiki id: that revision is the one MediaWiki lost", async () => {
    revisionsAre(revisionRow({ mwRevId: 42 }));

    await expect(runRevisionJob(restore())).resolves.toBe(777);

    expect(requestsTo("import")).toHaveLength(1);
    // the head keeps its own id: only a revision with none is stamped
    expect(mockRevisionUpdateMany.mock.calls[0]?.[0].where).toEqual({ id: "rev-1", mwRevId: null });
  });

  it("uses a default summary when none was recorded", async () => {
    await runRevisionJob(job({ payload: { restore: true } }));

    expect(requestsTo("import")[0]?.params.summary).toBe("Restoring the current WikiOS revision");
  });

  it("fails when no mirror account is configured", async () => {
    delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;

    await expect(runRevisionJob(restore())).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_USER/);
  });

  it("imports nothing when MediaWiki already holds the head's text: the conflicting edit was superseded", async () => {
    currentRevisionIs(850);

    await expect(runRevisionJob(restore())).resolves.toBe(850);

    expect(requestsTo("import")).toHaveLength(0);
    expect(requestsTo("edit")).toHaveLength(0);
    expect(mockRevisionUpdateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "rev-1", mwRevId: null },
      data: { mwRevId: 850 },
    });
    expect(mockArticleUpdateMany.mock.calls[0]?.[0].data).toMatchObject({ mwLatestRevId: 850 });
  });

  it("counts the head's text without its trailing whitespace as the same text: that is how an edit saves it", async () => {
    currentRevisionIs(851, TEXT.trimEnd());

    await expect(runRevisionJob(restore())).resolves.toBe(851);

    expect(requestsTo("import")).toHaveLength(0);
  });

  it("looks first, then imports, when MediaWiki holds the other text", async () => {
    await expect(runRevisionJob(restore())).resolves.toBe(777);

    const [first, second] = wiki.calls().filter((call) => call.params.prop === "revisions");
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(requestsTo("import")).toHaveLength(1);
    expect(requestsTo("edit")).toHaveLength(0);
  });
});

describe("a batch of revisions of one title", () => {
  const T1 = "First text.\n";
  const T2 = "Second text.\n";
  const T3 = "Third text.\n";
  const AT1 = new Date("2026-09-27T10:00:00.250Z");
  const AT2 = new Date("2026-09-27T10:00:05.500Z");
  const AT3 = new Date("2026-09-27T10:00:09.100Z");
  const row = (n: number, text: string, createdAt: Date, over: Record<string, unknown> = {}) =>
    revisionRow({
      id: `rev-${n}`,
      wikitext: text,
      sha1: mwSha1Base36(text),
      createdAt,
      summary: `edit ${n}`,
      ...over,
    });
  const jobFor = (n: number, over: Partial<WikiMirrorJob> = {}) =>
    job({ id: `job-${n}`, revisionId: `rev-${n}`, ...over });
  /** MediaWiki's history of the page, oldest first: the newest is the current revision. */
  function historyIs(entries: Array<{ revid: number; text: string; timestamp: string }>) {
    wiki.on("query", ({ params }) => {
      const newestFirst = [...entries].reverse();
      const shown = params.rvlimit === "1" ? newestFirst.slice(0, 1) : newestFirst;
      return {
        query: {
          pages: [
            {
              title: "Foo bar",
              revisions: shown.map(({ revid, text, timestamp }) => ({
                revid,
                sha1: hexSha1(text),
                timestamp,
              })),
            },
          ],
        },
      };
    });
  }
  /** What an import of rev-1 and rev-2 leaves behind: both, then the null revision (a copy of the newest). */
  const afterImportOfTwo = () =>
    historyIs([
      { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
      { revid: 11, text: T2, timestamp: "2026-09-27T10:00:05Z" },
      { revid: 12, text: T2, timestamp: "2026-09-27T10:05:00Z" },
    ]);
  const imports = () => requestsTo("import");

  beforeEach(() => {
    importOk();
    revisionsAre(row(1, T1, AT1), row(2, T2, AT2));
    afterImportOfTwo();
  });

  it("imports every revision in ONE request, oldest first, each credited to its own author at its own time", async () => {
    revisionsAre(row(1, T1, AT1), row(2, T2, AT2, { authorId: null, author: "Nobody Known" }));

    await runBatch([jobFor(1), jobFor(2)]);

    expect(imports()).toHaveLength(1);
    const xml = imports()[0]?.file?.content ?? "";
    expect(xml.match(/<page>/g)).toHaveLength(1);
    expect(xml.match(/<revision>/g)).toHaveLength(2);
    expect([...xml.matchAll(/<timestamp>([^<]+)<\/timestamp>/g)].map((m) => m[1])).toEqual([
      "2026-09-27T10:00:00Z",
      "2026-09-27T10:00:05Z",
    ]);
    expect([...xml.matchAll(/<username>([^<]+)<\/username>/g)].map((m) => m[1])).toEqual([
      "Alice",
      "wikios&gt;Nobody Known",
    ]);
    expect([...xml.matchAll(/<comment>([^<]+)<\/comment>/g)].map((m) => m[1])).toEqual([
      "edit 1",
      "edit 2",
    ]);
    expect(xml.indexOf(T1)).toBeLessThan(xml.indexOf(T2));
  });

  it("names the newest revision's summary in the import log, and looks every author up in one query", async () => {
    await runBatch([jobFor(1), jobFor(2)]);

    expect(imports()[0]?.params.summary).toBe("edit 2");
    expect(mockLinkFindMany).toHaveBeenCalledTimes(1);
    expect(mockRevisionFindMany).toHaveBeenCalledTimes(1);
  });

  it("stamps the newest revision with the current revision (the null one) and each earlier one with its own import", async () => {
    const outcomes = await runBatch([jobFor(1), jobFor(2)]);

    expect(outcomes.map(({ job: done, mwRevId, note }) => [done.id, mwRevId, note])).toEqual([
      ["job-1", 10, undefined],
      ["job-2", 12, undefined],
    ]);
    expect(
      mockRevisionUpdateMany.mock.calls.map(([args]) => [args.where.id, args.data.mwRevId])
    ).toEqual([
      ["rev-1", 10],
      ["rev-2", 12],
    ]);
    expect(requestsTo("edit")).toHaveLength(0);
  });

  it("stamps the article once, with the current revision", async () => {
    await runBatch([jobFor(1), jobFor(2)]);

    expect(mockArticleUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockArticleUpdateMany.mock.calls[0]?.[0]).toEqual({
      where: { id: "art-1" },
      data: { mwLatestRevId: 12, lastMwSyncAt: expect.any(Date) },
    });
  });

  it("reads the page's current revision once, and its history to find the earlier revisions", async () => {
    await runBatch([jobFor(1), jobFor(2)]);

    const reads = wiki.calls().filter((call) => call.params.prop === "revisions");
    expect(reads.map((call) => call.params.rvlimit)).toEqual(["1", "max"]);
  });

  it("gives the import more time than any other call: MediaWiki updates the page for every revision it imports", async () => {
    const timeout = jest.spyOn(AbortSignal, "timeout");
    wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 20 } }));
    historyIs([
      { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
      { revid: 11, text: "A human's text.\n", timestamp: "2026-09-27T10:05:00Z" },
    ]);

    await runBatch([jobFor(1), jobFor(2)]);

    const importCall = timeout.mock.calls.findIndex(([ms]) => ms === 120_000);
    expect(importCall).toBeGreaterThanOrEqual(0);
    expect(timeout.mock.calls.filter(([ms]) => ms === 120_000)).toHaveLength(1);
    expect(timeout.mock.calls.some(([ms]) => ms === 30_000)).toBe(true);
    timeout.mockRestore();
  });

  it("reads nothing from MediaWiki while it plans, and claims nothing", async () => {
    const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

    expect(wiki.fetch).not.toHaveBeenCalled();
    expect(plan.members.map((member) => member.job.id)).toEqual(["job-1", "job-2"]);
    expect(plan.restore).toBe(false);
    expect(plan.importSummary).toBe("edit 2");
  });

  it("finds an earlier revision of one second that shares its text with another, in import order", async () => {
    revisionsAre(row(1, T1, AT1), row(2, T1, AT1), row(3, T3, AT3));
    historyIs([
      { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
      { revid: 11, text: T1, timestamp: "2026-09-27T10:00:00Z" },
      { revid: 12, text: T3, timestamp: "2026-09-27T10:00:09Z" },
      { revid: 13, text: T3, timestamp: "2026-09-27T10:05:00Z" },
    ]);

    const outcomes = await runBatch([jobFor(1), jobFor(2), jobFor(3)]);

    expect(outcomes.map((outcome) => outcome.mwRevId)).toEqual([10, 11, 13]);
  });

  it("never mistakes the null revision for an earlier revision that shares its text and second", async () => {
    revisionsAre(row(1, T1, AT1), row(2, T1, new Date("2026-09-27T10:05:00.100Z")));
    historyIs([
      { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
      { revid: 11, text: T1, timestamp: "2026-09-27T10:05:00Z" },
      { revid: 12, text: T1, timestamp: "2026-09-27T10:05:00Z" },
    ]);

    const outcomes = await runBatch([jobFor(1), jobFor(2)]);

    // 12 is the current revision (the newest's stamp); the earlier one is 10, not the look-alike 11/12
    expect(outcomes.map((outcome) => outcome.mwRevId)).toEqual([10, 12]);
  });

  it("stamps what it can find and says so for an earlier revision MediaWiki's history does not show", async () => {
    historyIs([{ revid: 12, text: T2, timestamp: "2026-09-27T10:05:00Z" }]);

    const outcomes = await runBatch([jobFor(1), jobFor(2)]);

    expect(outcomes[0]).toMatchObject({
      mwRevId: null,
      note: expect.stringContaining("not found"),
    });
    expect(outcomes[1]).toMatchObject({ mwRevId: 12 });
    expect(mockRevisionUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("follows the history over its pages to find an earlier revision", async () => {
    const pages: Array<{ revisions: object[]; next?: string }> = [
      {
        revisions: [
          { revid: 12, sha1: hexSha1(T2), timestamp: "2026-09-27T10:05:00Z" },
          { revid: 11, sha1: hexSha1(T2), timestamp: "2026-09-27T10:00:05Z" },
        ],
        next: "10|abc",
      },
      { revisions: [{ revid: 10, sha1: hexSha1(T1), timestamp: "2026-09-27T10:00:00Z" }] },
    ];
    wiki.on("query", ({ params }) => {
      if (params.rvlimit === "1") {
        return {
          query: {
            pages: [{ title: "Foo bar", revisions: [{ revid: 12, sha1: hexSha1(T2) }] }],
          },
        };
      }
      const page = pages[params.rvcontinue ? 1 : 0]!;
      return {
        query: { pages: [{ title: "Foo bar", revisions: page.revisions }] },
        ...(page.next ? { continue: { rvcontinue: page.next, continue: "||" } } : {}),
      };
    });

    const outcomes = await runBatch([jobFor(1), jobFor(2)]);

    expect(outcomes.map((outcome) => outcome.mwRevId)).toEqual([10, 12]);
  });

  describe("when MediaWiki has a newer revision", () => {
    beforeEach(() => {
      // someone edited since: the current revision holds neither text
      historyIs([
        { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
        { revid: 11, text: T2, timestamp: "2026-09-27T10:00:05Z" },
        { revid: 12, text: "A human's text.\n", timestamp: "2026-09-27T10:05:00Z" },
      ]);
      wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 20 } }));
    });

    it("pushes the newest text, and only that, as one edit on top of the current revision", async () => {
      await runBatch([jobFor(1), jobFor(2)]);

      expect(requestsTo("edit")).toHaveLength(1);
      expect(requestsTo("edit")[0]?.params).toMatchObject({
        title: "Foo bar",
        text: T2,
        summary: "edit 2 (WikiOS)",
        bot: "1",
        baserevid: "12",
      });
    });

    it("stamps the edit on the newest revision and the article, the imports on the earlier ones, with notes", async () => {
      const outcomes = await runBatch([jobFor(1), jobFor(2)]);

      expect(outcomes.map(({ mwRevId }) => mwRevId)).toEqual([10, 20]);
      expect(outcomes[0]?.note).toContain("only the batch's newest text was pushed");
      expect(outcomes[1]?.note).toContain("pushed as an edit instead");
      expect(mockArticleUpdateMany.mock.calls[0]?.[0].data).toMatchObject({ mwLatestRevId: 20 });
    });
  });

  describe("revisions with nothing to send", () => {
    it("leaves out a revision the inbound sync already stamped, and settles its job with that id", async () => {
      revisionsAre(row(1, T1, AT1, { mwRevId: 5 }), row(2, T2, AT2));
      afterImportOfTwo();

      const outcomes = await runBatch([jobFor(1), jobFor(2)]);

      expect(imports()[0]?.file?.content.match(/<revision>/g)).toHaveLength(1);
      expect(outcomes.map(({ mwRevId }) => mwRevId)).toEqual([5, 12]);
    });

    it("settles a revision that went with its page without sending it", async () => {
      revisionsAre(row(2, T2, AT2));
      afterImportOfTwo();

      const outcomes = await runBatch([jobFor(1), jobFor(2)]);

      expect(imports()[0]?.file?.content.match(/<revision>/g)).toHaveLength(1);
      expect(outcomes.map(({ mwRevId }) => mwRevId)).toEqual([null, 12]);
    });

    it("makes no request at all when every revision is settled", async () => {
      revisionsAre(row(1, T1, AT1, { mwRevId: 5 }), row(2, T2, AT2, { mwRevId: 6 }));

      const outcomes = await runBatch([jobFor(1), jobFor(2)]);

      expect(wiki.fetch).not.toHaveBeenCalled();
      expect(outcomes.map(({ mwRevId }) => mwRevId)).toEqual([5, 6]);
    });

    it("imports the earlier revisions without checking or rewriting the page when the newest is already in MediaWiki", async () => {
      revisionsAre(row(1, T1, AT1), row(2, T2, AT2, { mwRevId: 6 }));
      historyIs(
        [
          { revid: 6, text: T2, timestamp: "2026-09-27T10:00:05Z" },
          { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
        ].sort((a, b) => a.revid - b.revid)
      );

      const outcomes = await runBatch([jobFor(1), jobFor(2)]);

      expect(imports()).toHaveLength(1);
      expect(requestsTo("edit")).toHaveLength(0);
      expect(wiki.calls().some((call) => call.params.rvlimit === "1")).toBe(false);
      expect(outcomes.map(({ mwRevId }) => mwRevId)).toEqual([10, 6]);
      expect(mockArticleUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("the size of a batch", () => {
    const big = (n: number, createdAt: Date) =>
      row(n, `${String(n).repeat(1)}x`.repeat(1_600_000), createdAt);

    it("takes no revision that would grow the XML past 6 MB, and hands the rest back", async () => {
      expect(MAX_BATCH_BYTES).toBe(6 * 1024 * 1024);
      revisionsAre(big(1, AT1), big(2, AT2), big(3, AT3));

      const plan = await planRevisionBatch([jobFor(1), jobFor(2), jobFor(3)]);

      // 3.2 MB for the first, 6.4 MB with the second: it would pass the cap, so the first goes alone
      expect(plan.members.map((member) => member.job.id)).toEqual(["job-1"]);
      expect(plan.xml?.match(/<revision>/g)).toHaveLength(1);
    });

    it("fills the batch up to the cap, never past it", async () => {
      const medium = (n: number, createdAt: Date) => row(n, "m".repeat(2_500_000), createdAt);
      revisionsAre(medium(1, AT1), medium(2, AT2), medium(3, AT3));

      const plan = await planRevisionBatch([jobFor(1), jobFor(2), jobFor(3)]);

      // 2.5 MB, 5.0 MB; a third would make 7.5 MB
      expect(plan.members.map((member) => member.job.id)).toEqual(["job-1", "job-2"]);
      expect(Buffer.byteLength(plan.xml ?? "")).toBeLessThanOrEqual(MAX_BATCH_BYTES);
    });

    it("counts the text as escaped: an & takes five bytes of XML", async () => {
      const ampersands = (n: number, createdAt: Date) => row(n, "&".repeat(700_000), createdAt);
      revisionsAre(ampersands(1, AT1), ampersands(2, AT2));

      const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

      // 700 000 characters, but 3.5 MB of XML each: the second would make 7 MB
      expect(plan.members).toHaveLength(1);
      expect(Buffer.byteLength(plan.xml ?? "")).toBeLessThanOrEqual(MAX_BATCH_BYTES);
    });

    it("always takes the first revision, however big, and nothing after it", async () => {
      revisionsAre(row(1, "y".repeat(7 * 1024 * 1024), AT1), row(2, T2, AT2));

      const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

      expect(plan.members.map((member) => member.job.id)).toEqual(["job-1"]);
      expect(Buffer.byteLength(plan.xml ?? "")).toBeGreaterThan(MAX_BATCH_BYTES);
    });

    it("takes every revision of a small batch", async () => {
      const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

      expect(plan.members).toHaveLength(2);
    });
  });

  it("sends a restore alone, even when revision jobs follow it", async () => {
    const restore = jobFor(1, { payload: { restore: true, summary: "Restoring" } });

    const plan = await planRevisionBatch([restore, jobFor(2)]);

    expect(plan.restore).toBe(true);
    expect(plan.members.map((member) => member.job.id)).toEqual(["job-1"]);
    expect(plan.importSummary).toBe("Restoring");
  });

  it("fails the batch, for every job to retry, when the import is refused", async () => {
    wiki.on("import", () => ({ error: { code: "cantimport", info: "You may not import." } }));

    await expect(runBatch([jobFor(1), jobFor(2)])).rejects.toBeInstanceOf(MediaWikiApiError);

    expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
    expect(requestsTo("edit")).toHaveLength(0);
  });

  it("refuses an empty batch", async () => {
    await expect(planRevisionBatch([])).rejects.toThrow("needs a job");
  });
});
