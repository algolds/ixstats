/** @jest-environment node */
/**
 * Plan 407: a `revision` mirror job. The revision is imported through `action=import` (one page, one revision,
 * credited to its author, dated as it was made), the result is verified against MediaWiki's current revision,
 * and an edit is the fallback when the import is not the current one. MediaWiki is a scripted fake: nothing
 * here touches a real wiki.
 */
import type { WikiMirrorJob } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { MediaWikiApiError } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import { runRevisionJob } from "~/lib/wiki-os/services/mirror-revision";
import { mwSha1Base36, sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import { API_URL, createFakeMediaWiki, type RecordedRequest } from "~/tests/helpers/fake-mediawiki";
import { createHash } from "node:crypto";

const mockRevisionFindUnique = jest.fn();
const mockRevisionUpdateMany = jest.fn();
const mockArticleUpdateMany = jest.fn();
const mockLinkFindFirst = jest.fn();

jest.mock("~/server/db", () => ({
  db: {
    wikiRevision: {
      findUnique: (...a: unknown[]) => mockRevisionFindUnique(...a),
      updateMany: (...a: unknown[]) => mockRevisionUpdateMany(...a),
    },
    wikiArticle: { updateMany: (...a: unknown[]) => mockArticleUpdateMany(...a) },
    wikiAccountLink: { findFirst: (...a: unknown[]) => mockLinkFindFirst(...a) },
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

  mockRevisionFindUnique.mockResolvedValue(revisionRow());
  mockRevisionUpdateMany.mockResolvedValue({ count: 1 });
  mockArticleUpdateMany.mockResolvedValue({ count: 1 });
  mockLinkFindFirst.mockResolvedValue({ username: "Alice" });
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

  it("looks the author up by the verified wiki account of the revision's user, else uses the name it carries", async () => {
    await runRevisionJob(job());
    expect(mockLinkFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", source: "ixwiki", verifiedAt: { not: null } },
      select: { username: true },
    });

    mockLinkFindFirst.mockResolvedValue(null);
    await runRevisionJob(job());
    expect(requestsTo("import")[1]?.file?.content).toContain("<username>Some Country</username>");

    mockRevisionFindUnique.mockResolvedValue(revisionRow({ author: null, authorId: null }));
    await runRevisionJob(job());
    expect(requestsTo("import")[2]?.file?.content).toContain(
      "<username>Community Contributor</username>"
    );
    expect(mockLinkFindFirst).toHaveBeenCalledTimes(2); // none for a revision with no user
  });

  it("marks a minor edit minor", async () => {
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ minor: true }));

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
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ sha1: null }));

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
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ mwRevId: 42 }));

    await expect(runRevisionJob(job())).resolves.toBe(42);

    expect(wiki.fetch).not.toHaveBeenCalled();
    expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
  });

  it("has nothing to mirror when the revision is gone with its page", async () => {
    mockRevisionFindUnique.mockResolvedValue(null);

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
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ minor: true }));

    await runRevisionJob(job());

    expect(requestsTo("edit")[0]?.params.minor).toBe("1");
  });

  it("gives an edit with no summary a default one, and cuts a long one so the suffix still fits", async () => {
    currentRevisionIs(900, "Someone else's text.");
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ summary: null }));
    await runRevisionJob(job());
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ summary: "s".repeat(600) }));
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
    expect(mockLinkFindFirst).not.toHaveBeenCalled();
  });

  it("is not minor, whatever the head revision was", async () => {
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ minor: true }));

    await runRevisionJob(restore());

    expect(requestsTo("import")[0]?.file?.content).not.toContain("<minor />");
  });

  it("is imported even though the head already has a MediaWiki id: that revision is the one MediaWiki lost", async () => {
    mockRevisionFindUnique.mockResolvedValue(revisionRow({ mwRevId: 42 }));

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
