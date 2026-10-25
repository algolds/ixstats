/** @jest-environment node */
/**
 * Plan 407: what the mirror asks of MediaWiki. `revision` jobs: the revisions of a title imported through
 * `action=import` as one batch (each credited to its author, never to a real MediaWiki user it is not, never as an
 * anonymous edit), the newest text verified against MediaWiki's current revision, an edit as the fallback, every
 * revision stamped; the page operations (move, delete, undelete, protect), each done exactly once whatever a retry
 * finds; and the bot login they all run under (never an anonymous token, never through the public host from the
 * server). MediaWiki is a scripted fake: nothing here touches a real wiki.
 */
const mockRevisionFindMany = jest.fn();
const mockRevisionUpdateMany = jest.fn();
const mockArticleUpdateMany = jest.fn();
const mockClaimFindMany = jest.fn();
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => ({
  db: {
    wikiRevision: {
      findMany: (...a: unknown[]) => mockRevisionFindMany(...a),
      updateMany: (...a: unknown[]) => mockRevisionUpdateMany(...a),
    },
    wikiArticle: { updateMany: (...a: unknown[]) => mockArticleUpdateMany(...a) },
    wikiNameClaim: { findMany: (...a: unknown[]) => mockClaimFindMany(...a) },
  },
}));

import type { WikiMirrorJob } from "@prisma/client";
import { ConflictError } from "~/lib/app-error";
import {
  getBotSessionAndToken,
  invalidateCsrfToken,
  mirrorBotName,
} from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { MediaWikiApiError } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import {
  executeRevisionBatch,
  MAX_BATCH_BYTES,
  planRevisionBatch,
  type BatchCollision,
} from "~/lib/wiki-os/services/mirror-revision";
import { revisionPayloadSchema } from "~/lib/wiki-os/services/mirror-outbox";
import { mwSha1Base36, sha1HexToBase36 } from "~/lib/wiki-os/xml/sha1";
import { API_URL, createFakeMediaWiki, type RecordedRequest } from "~/tests/helpers/fake-mediawiki";
import { createHash } from "node:crypto";
import { runPageJob } from "~/lib/wiki-os/services/mirror-page-ops";

describe("revision jobs", () => {
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
    byteSize: Buffer.byteLength(String(over.wikitext ?? TEXT)),
    ...over,
  });

  /** The revisions the database holds (what the planner reads by id). */
  let stored: Array<ReturnType<typeof revisionRow>> = [];
  const revisionsAre = (...rows: Array<ReturnType<typeof revisionRow>>) => void (stored = rows);
  /** The approved IxWiki name claims of WikiOS users, oldest approval first: id -> names (`hidden:` a claim not shown). */
  const claimsAre = (accounts: Record<string, string[]>) =>
    mockClaimFindMany.mockImplementation(
      async ({
        where,
      }: {
        where: { userId: { in: string[] }; status: string; visible?: boolean };
      }) =>
        where.userId.in.flatMap((userId) =>
          (accounts[userId] ?? [])
            .map((entry, at) => ({
              id: `claim-${userId}-${at}`,
              userId,
              name: entry.replace(/^hidden:/, ""),
              visible: !entry.startsWith("hidden:"),
              rightsPass: false,
              decidedAt: new Date(Date.UTC(2026, 0, at + 1)),
              mwUserId: null,
            }))
            .filter(
              (claim) => where.status === "APPROVED" && (where.visible !== true || claim.visible)
            )
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

  /** MediaWiki's history of the page, oldest first: the newest is the current revision. */
  function historyIs(
    entries: Array<{ revid: number; text: string; timestamp: string; user?: string }>
  ) {
    wiki.on("query", ({ params }) => {
      const newestFirst = [...entries].reverse();
      const shown = params.rvlimit === "1" ? newestFirst.slice(0, 1) : newestFirst;
      return {
        query: {
          pages: [
            {
              title: "Foo bar",
              revisions: shown.map(({ revid, text, timestamp, user }) => ({
                revid,
                sha1: hexSha1(text),
                timestamp,
                ...(user ? { user } : {}),
              })),
            },
          ],
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
    mockRevisionFindMany.mockImplementation(
      async ({ where }: { where: { id: { in: string[] } } }) =>
        stored.filter((row) => where.id.in.includes(row.id))
    );
    mockRevisionUpdateMany.mockResolvedValue({ count: 1 });
    mockArticleUpdateMany.mockResolvedValue({ count: 1 });
    claimsAre({ "user-1": ["Alice"] });
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

    it("looks the author up by the shown name claims of the revision's user, else imports the label under the import prefix", async () => {
      await runRevisionJob(job());
      expect(mockClaimFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            source: "ixwiki",
            userId: { in: ["user-1"] },
            status: "APPROVED",
            visible: true,
          },
        })
      );

      claimsAre({});
      await runRevisionJob(job());
      expect(requestsTo("import")[1]?.file?.content).toContain(
        "<username>wikios&gt;Some Country</username>"
      );

      revisionsAre(revisionRow({ author: null, authorId: null }));
      await runRevisionJob(job());
      expect(requestsTo("import")[2]?.file?.content).toContain(
        "<username>wikios&gt;Community Contributor</username>"
      );
      expect(mockClaimFindMany).toHaveBeenCalledTimes(2); // none for a revision with no user
    });

    describe("attribution: only a shown claimed name is imported as a bare name", () => {
      const authors = async (...rows: Array<ReturnType<typeof revisionRow>>) => {
        revisionsAre(...rows);
        await runBatch(rows.map((row, at) => job({ id: `job-${at}`, revisionId: row.id })));
        const xml = requestsTo("import").at(-1)?.file?.content ?? "";
        return [...xml.matchAll(/<username>([^<]+)<\/username>/g)].map((match) => match[1]);
      };

      it("sends the author's first shown claimed name as itself, and every other author as wikios>handle", async () => {
        claimsAre({
          "user-1": ["hidden:Hidden first", "Old name", "Later name"],
          "user-2": ["hidden:Secret name"],
        });

        expect(
          await authors(
            revisionRow({ id: "rev-1", author: "alpha", authorId: "user-1" }),
            revisionRow({ id: "rev-2", author: "alpha", authorId: "user-2" }),
            revisionRow({ id: "rev-3", author: "alpha", authorId: "user-3" })
          )
        ).toEqual(["Old name", "wikios&gt;alpha", "wikios&gt;alpha"]);
      });

      it("never credits a label that is the name of a real MediaWiki user (no claim)", async () => {
        // user-1 claimed "Alice"; a save labelled "WikiOSAdmin" with no author id, and one labelled "Alice" by
        // somebody else, are not those accounts
        claimsAre({ "user-1": ["Alice"] });

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
      it("cuts a long label to the 248 bytes that fit MediaWiki's 255-byte actor name beside `wikios>`, never inside a character", async () => {
        const labels = {
          ascii: "x".repeat(300),
          twoBytes: "é".repeat(200), // 400 bytes
          threeBytes: "日".repeat(100), // 300 bytes: 248 falls inside the 83rd character
          fourBytes: "😀".repeat(100), // 400 bytes
          short: "Eurth".repeat(10),
        };
        const sent = await authors(
          ...Object.values(labels).map((author, at) =>
            revisionRow({ id: `rev-${at + 1}`, author, authorId: null })
          )
        );
        const decoded = sent.map((name) => (name ?? "").replace("wikios&gt;", "wikios>"));

        expect(decoded.map((name) => name.startsWith("wikios>"))).toEqual(Array(5).fill(true));
        const bytes = decoded.map((name) => Buffer.byteLength(name, "utf8"));
        expect(bytes).toEqual([255, 255, 253, 255, 57]);
        expect(decoded[0]).toBe(`wikios>${"x".repeat(248)}`);
        expect(decoded[1]).toBe(`wikios>${"é".repeat(124)}`);
        expect(decoded[2]).toBe(`wikios>${"日".repeat(82)}`);
        expect(decoded[3]).toBe(`wikios>${"😀".repeat(62)}`);
        expect(decoded[4]).toBe(`wikios>${labels.short}`);
        expect(decoded.join("")).not.toContain("\uFFFD");
      });
    });
    it("asks MediaWiki for the page's current revision and its hash once the import is done, to verify it", async () => {
      await runRevisionJob(job());

      const calls = wiki.calls();
      const reads = calls.filter((request) => request.params.prop === "revisions");
      expect(reads).toHaveLength(1);
      expect(reads[0]?.params).toMatchObject({
        action: "query",
        titles: "Foo bar",
        rvprop: "ids|sha1|timestamp|user",
        rvlimit: "1",
      });
      const importAt = calls.findIndex((r) => r.params.action === "import");
      expect(calls.indexOf(reads[0]!)).toBeGreaterThan(importAt);
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
    it("does not fail a job whose stamp the inbound sync recorded first (its echo row holds the MediaWiki id)", async () => {
      mockRevisionUpdateMany.mockRejectedValue(
        new ConflictError("Unique constraint violation on WikiRevision (source)")
      );

      await expect(runRevisionJob(job())).resolves.toBe(777);

      expect(mockArticleUpdateMany).toHaveBeenCalledTimes(1);
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

  describe("when the import is not MediaWiki's current text", () => {
    beforeEach(() => {
      importOk();
      wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 901 } }));
    });
    /** The revision's own import, dated when it was made. */
    const ownImport = { revid: 776, text: TEXT, timestamp: "2026-09-27T10:20:30Z", user: "Alice" };
    const OTHER = "Another text.\n";

    it("makes it current by one edit of the mirror account when every revision dated after it is the mirror's own", async () => {
      historyIs([
        ownImport,
        { revid: 777, text: OTHER, timestamp: "2026-09-27T10:25:00Z", user: "WikiOSMirror" },
        { revid: 778, text: OTHER, timestamp: "2026-09-27T10:30:00Z", user: "WikiOSMirror" },
      ]);

      const [outcome] = await runBatch([job()]);

      expect(outcome?.mwRevId).toBe(901);
      expect(outcome?.note).toContain("made current by one edit");
      const [edit] = requestsTo("edit");
      expect(edit?.params).toMatchObject({
        action: "edit",
        title: "Foo bar",
        text: TEXT,
        summary: "fix the lead (WikiOS)",
        bot: "1",
        baserevid: "778",
      });
      expect(edit?.params.minor).toBeUndefined();
      expect(edit?.order.at(-1)).toBe("token");
      expect(mockRevisionUpdateMany.mock.calls[0]?.[0].data).toEqual({ mwRevId: 901 });
      expect(mockArticleUpdateMany.mock.calls[0]?.[0].data).toMatchObject({ mwLatestRevId: 901 });
    });

    it("never pushes it over a classic editor's later revision: it stays history, stamped with its import, and the job says so", async () => {
      historyIs([
        ownImport,
        { revid: 900, text: OTHER, timestamp: "2026-09-27T10:25:00Z", user: "Bob" },
        { revid: 902, text: OTHER, timestamp: "2026-09-27T10:30:00Z", user: "WikiOSMirror" },
      ]);

      const [outcome] = await runBatch([job()]);

      expect(outcome).toMatchObject({
        mwRevId: 776,
        note: "MediaWiki has a later revision 900 by a classic editor; imported as history",
      });
      expect(requestsTo("edit")).toHaveLength(0);
      expect(mockRevisionUpdateMany.mock.calls.map(([args]) => args.data.mwRevId)).toEqual([776]);
      expect(mockArticleUpdateMany).not.toHaveBeenCalled();
    });

    it("counts a classic revision of the same second as later: a tie goes to classic", async () => {
      historyIs([
        ownImport,
        { revid: 900, text: OTHER, timestamp: "2026-09-27T10:20:30Z", user: "Bob" },
        { revid: 902, text: OTHER, timestamp: "2026-09-27T10:30:00Z", user: "WikiOSMirror" },
      ]);

      await expect(runRevisionJob(job())).resolves.toBe(776);

      expect(requestsTo("edit")).toHaveLength(0);
    });

    it("counts a revision whose author MediaWiki hides as a classic editor's, never the mirror's", async () => {
      historyIs([
        ownImport,
        { revid: 900, text: OTHER, timestamp: "2026-09-27T10:25:00Z" },
        { revid: 902, text: OTHER, timestamp: "2026-09-27T10:30:00Z", user: "WikiOSMirror" },
      ]);

      await runRevisionJob(job());

      expect(requestsTo("edit")).toHaveLength(0);
    });

    it("fails the job when the edit is refused, and stamps nothing", async () => {
      historyIs([
        ownImport,
        { revid: 777, text: OTHER, timestamp: "2026-09-27T10:25:00Z", user: "WikiOSMirror" },
      ]);
      wiki.on("edit", () => ({ error: { code: "editconflict", info: "Edit conflict." } }));

      await expect(runRevisionJob(job())).rejects.toThrow(/editconflict/);

      expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
      expect(mockArticleUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("a batch the conflict rule judged lost", () => {
    const lost: BatchCollision = {
      verdict: {
        winner: {
          side: "classic",
          action: "edit",
          ref: "900",
          at: new Date("2026-09-27T10:25:00Z"),
          author: { userId: null, classicName: "Bob", ip: null, label: null },
        },
        overwritten: [],
        incomingWins: false,
        key: "ixwiki:art-1:900",
      },
      conflictId: "c1",
      wikiosWon: false,
    };

    it("is imported as history only: no edit, no check of the current text, the revision stamped with its import, the job naming the winner", async () => {
      importOk();
      wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 901 } }));
      historyIs([
        { revid: 776, text: TEXT, timestamp: "2026-09-27T10:20:30Z", user: "Alice" },
        { revid: 900, text: "Bob's text.\n", timestamp: "2026-09-27T10:25:00Z", user: "Bob" },
        {
          revid: 902,
          text: "Bob's text.\n",
          timestamp: "2026-09-27T10:30:00Z",
          user: "WikiOSMirror",
        },
      ]);

      const outcomes = await executeRevisionBatch(await planRevisionBatch([job()]), lost);

      expect(outcomes).toEqual([
        {
          job: expect.objectContaining({ id: "job-1" }),
          mwRevId: 776,
          note: "Lost to MediaWiki revision 900 (saved later); imported as history",
        },
      ]);
      expect(requestsTo("import")).toHaveLength(1);
      expect(requestsTo("edit")).toHaveLength(0);
      expect(wiki.calls().filter((request) => request.params.rvlimit === "1")).toHaveLength(0);
      expect(mockRevisionUpdateMany.mock.calls.map(([args]) => args.data.mwRevId)).toEqual([776]);
      expect(mockArticleUpdateMany).not.toHaveBeenCalled();
    });
  });

  describe("an overwritten (parked) revision", () => {
    it("is never sent: a job whose revision is parked completes with a note, and nothing reaches MediaWiki", async () => {
      revisionsAre(revisionRow({ parked: true, parkReason: "overwritten:mwlog:7" }));

      const outcomes = await runBatch([job()]);

      expect(outcomes).toEqual([
        {
          job: expect.objectContaining({ id: "job-1" }),
          mwRevId: null,
          note: "Overwritten before it was sent (overwritten:mwlog:7): kept in WikiOS's history only",
        },
      ]);
      expect(wiki.fetch).not.toHaveBeenCalled();
      expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
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
        // a refused import is never verified
        expect(requestsTo("query")).toHaveLength(0);
        expect(wiki.calls().at(-1)?.params.action).toBe("import");
        expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
      }
    );
    it("says what an oversized upload was answered with: the status and the start of the body, not a parse error", async () => {
      const page = `<html><head><title>413 Request Entity Too Large</title></head>${"<p>x</p>".repeat(100)}</html>`;
      currentRevisionIs(777);
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
      expect(message.length).toBeLessThanOrEqual(
        "MediaWiki import failed (HTTP 413): ".length + 200
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
  });

  describe("a batch of revisions of one title", () => {
    const T1 = "First text.\n";
    const T2 = "Second text.\n";
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
    describe("when the newer revision is the mirror's own null revision", () => {
      beforeEach(() => {
        // an earlier import's null revision (the bot's, with another text) is dated after these revisions
        historyIs([
          { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
          { revid: 11, text: T2, timestamp: "2026-09-27T10:00:05Z" },
          {
            revid: 12,
            text: "An earlier import's text.\n",
            timestamp: "2026-09-27T10:05:00Z",
            user: "WikiOSMirror",
          },
        ]);
        wiki.on("edit", () => ({ edit: { result: "Success", newrevid: 20 } }));
      });
      it("knows the mirror account by its normalised name, whatever the bot-password's app name", async () => {
        process.env.WIKIOS_MEDIAWIKI_BOT_USER = "wikiOSMirror@other-app";
        historyIs([
          { revid: 10, text: T1, timestamp: "2026-09-27T10:00:00Z" },
          { revid: 11, text: T2, timestamp: "2026-09-27T10:00:05Z" },
          { revid: 12, text: "x\n", timestamp: "2026-09-27T10:05:00Z", user: "WikiOSMirror" },
        ]);

        const outcomes = await runBatch([jobFor(1), jobFor(2)]);

        expect(outcomes[1]?.note).toContain("the mirror's own");
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
    });

    it("no job payload accepts restore any more: a leftover park re-push goes out as its revision was saved, with the jobs after it", async () => {
      const leftover = jobFor(1, { payload: { restore: true, summary: "Restoring" } });

      const plan = await planRevisionBatch([leftover, jobFor(2)]);

      expect(revisionPayloadSchema.parse({ restore: true, summary: "Restoring" })).toEqual({});
      expect(plan.members.map((member) => member.job.id)).toEqual(["job-1", "job-2"]);
      expect(plan.importSummary).toBe("edit 2");
      expect(
        [...(plan.xml ?? "").matchAll(/<timestamp>([^<]+)<\/timestamp>/g)].map((m) => m[1])
      ).toEqual(["2026-09-27T10:00:00Z", "2026-09-27T10:00:05Z"]);
      expect(plan.xml).not.toContain("WikiOSMirror");
    });

    it("leaves a parked revision out and sends the others", async () => {
      revisionsAre(
        row(1, T1, AT1, { parked: true, parkReason: "overwritten:mwlog:7" }),
        row(2, T2, AT2)
      );

      const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

      expect(plan.members.map((member) => member.send)).toEqual([false, true]);
      expect(plan.xml?.match(/<revision>/g)).toHaveLength(1);
      expect(plan.xml).not.toContain(T1);
    });

    it("sends a winner's trail in its revision's summary, and the import's summary without it (the null revision repeats that)", async () => {
      const trail = "Overwrote revision 900 by Bob, saved from the same version (conflict c1)";
      revisionsAre(row(1, T1, AT1), row(2, T2, AT2, { summary: `edit 2; ${trail}` }));

      const plan = await planRevisionBatch([jobFor(1), jobFor(2)]);

      expect(plan.xml).toContain(`<comment>edit 2; ${trail}</comment>`);
      expect(plan.importSummary).toBe("edit 2");
    });

    it("fails the batch, for every job to retry, when the import is refused", async () => {
      wiki.on("import", () => ({ error: { code: "cantimport", info: "You may not import." } }));

      await expect(runBatch([jobFor(1), jobFor(2)])).rejects.toBeInstanceOf(MediaWikiApiError);

      expect(mockRevisionUpdateMany).not.toHaveBeenCalled();
      expect(requestsTo("edit")).toHaveLength(0);
    });
  });
});

describe("page jobs", () => {
  const realFetch = globalThis.fetch;
  let wiki: ReturnType<typeof createFakeMediaWiki>;

  const job = (kind: string, title: string, payload: object): WikiMirrorJob => ({
    id: "job-1",
    source: "ixwiki",
    kind,
    title,
    articleId: "art-1",
    revisionId: null,
    logId: "log-1",
    payload,
    state: "running",
    attempts: 1,
    nextAttemptAt: new Date(),
    lastError: null,
    mwRevId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const moveJob = (over: object = {}) =>
    job("move", "Old name", { to: "New name", reason: "tidy up", leaveRedirect: true, ...over });

  const callsTo = (action: string): RecordedRequest[] =>
    wiki.calls().filter((request) => request.params.action === action);

  /**
   * `action=query&prop=info` answers per title: which pages exist, and which titles are redirects (title -> target;
   * the call follows them only when it asks for `redirects`).
   */
  function pagesExist(existing: string[], redirects: Record<string, string> = {}) {
    wiki.on("query", ({ params }) => {
      const title = params.titles ?? "";
      const target = redirects[title];
      if (target && params.redirects) {
        return {
          query: {
            redirects: [{ from: title, to: target }],
            pages: [{ title: target, pageid: 2 }],
          },
        };
      }
      return {
        query: {
          pages: [existing.includes(title) ? { title, pageid: 1 } : { title, missing: true }],
        },
      };
    });
  }

  const ok = () => ({ ok: true });
  const refuse = (code: string) => () => ({ error: { code, info: `MediaWiki says ${code}` } });

  beforeEach(() => {
    invalidateCsrfToken();
    process.env.WIKIOS_MEDIAWIKI_API = API_URL;
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
    process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
    wiki = createFakeMediaWiki();
    globalThis.fetch = wiki.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  describe("move", () => {
    it("moves the page as the bot, leaving a redirect and leaving the talk page to its own job", async () => {
      wiki.on("move", ok);

      await runPageJob(moveJob());

      const [call] = callsTo("move");
      expect(call?.method).toBe("POST");
      expect(call?.params).toMatchObject({
        action: "move",
        from: "Old name",
        to: "New name",
        reason: "tidy up",
        format: "json",
      });
      // MediaWiki reads a flag as set when its parameter is present, even as "0": neither is sent
      expect(call?.params.movetalk).toBeUndefined();
      expect(call?.params.noredirect).toBeUndefined();
      expect(call?.params.token).toBe("csrf-token+\\x");
      expect(call?.order.at(-1)).toBe("token");
    });
    it("is done when the source is gone and the target is there: the move already went through", async () => {
      wiki.on("move", refuse("missingtitle"));
      pagesExist(["New name"]);

      await expect(runPageJob(moveJob())).resolves.toBeUndefined();
    });
    it("fails when the old title is a redirect to some other page", async () => {
      wiki.on("move", refuse("articleexists"));
      pagesExist(["Old name", "New name", "Elsewhere"], { "Old name": "Elsewhere" });

      await expect(runPageJob(moveJob())).rejects.toThrow(/articleexists/);
    });
    it("fails when the target is taken by another page: both titles exist", async () => {
      wiki.on("move", refuse("articleexists"));
      wiki.on("query", ({ params }) => ({
        query: { pages: [{ title: params.titles, pageid: 1 }] },
      }));

      await expect(runPageJob(moveJob())).rejects.toThrow(/articleexists/);
    });
    it("fails on a refusal that is not about the work being done (permissions)", async () => {
      wiki.on("move", refuse("cantmove"));

      const failure = await runPageJob(moveJob()).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(MediaWikiApiError);
      expect((failure as MediaWikiApiError).code).toBe("cantmove");
      expect(callsTo("query")).toHaveLength(0);
    });
  });

  describe("delete", () => {
    it("deletes the page with the reason", async () => {
      wiki.on("delete", ok);

      await runPageJob(job("delete", "Old name", { reason: "spam" }));

      expect(callsTo("delete")[0]?.params).toMatchObject({
        action: "delete",
        title: "Old name",
        reason: "spam",
      });
    });

    it("is done when the page is already gone", async () => {
      wiki.on("delete", refuse("missingtitle"));

      await expect(
        runPageJob(job("delete", "Old name", { reason: "spam" }))
      ).resolves.toBeUndefined();
    });
  });

  describe("undelete", () => {
    it("undeletes the page with the reason", async () => {
      wiki.on("undelete", ok);

      await runPageJob(job("undelete", "Old name", { reason: "oops" }));

      expect(callsTo("undelete")[0]?.params).toMatchObject({
        action: "undelete",
        title: "Old name",
        reason: "oops",
      });
    });

    it("is done when there was nothing to undelete because the page is there", async () => {
      wiki.on("undelete", refuse("cantundelete"));
      pagesExist(["Old name"]);

      await expect(
        runPageJob(job("undelete", "Old name", { reason: "" }))
      ).resolves.toBeUndefined();
    });
  });

  describe("protect", () => {
    it("sends every restriction with its expiry; a lifted one is `all`, one that never expires `infinite`", async () => {
      wiki.on("protect", ok);

      await runPageJob(
        job("protect", "Old name", {
          reason: "edit war",
          restrictions: [
            { action: "edit", level: "sysop", expiresAt: "2026-10-30T00:00:00.000Z" },
            { action: "move", level: "autoconfirmed", expiresAt: null },
            { action: "upload", level: null, expiresAt: null },
          ],
        })
      );

      expect(callsTo("protect")[0]?.params).toMatchObject({
        action: "protect",
        title: "Old name",
        reason: "edit war",
        protections: "edit=sysop|move=autoconfirmed|upload=all",
        expiry: "2026-10-30T00:00:00.000Z|infinite|infinite",
      });
      expect(callsTo("protect")[0]?.params.cascade).toBeUndefined();
    });
  });

  describe("runPageJob", () => {
    it("makes no call when the bot cannot log in", async () => {
      wiki.state.loginResult = "Failed";
      wiki.on("delete", ok);

      await expect(runPageJob(job("delete", "Old name", { reason: "" }))).rejects.toThrow(
        /bot login failed/
      );
      expect(wiki.calls()).toEqual([]);
    });
  });
});

describe("the bot login", () => {
  const realFetch = globalThis.fetch;
  let wiki: ReturnType<typeof createFakeMediaWiki>;

  beforeEach(() => {
    invalidateCsrfToken();
    process.env.WIKIOS_MEDIAWIKI_API = API_URL;
    process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
    process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
    wiki = createFakeMediaWiki();
    globalThis.fetch = wiki.fetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL;
  });

  describe("the api.php the mirror logs in to (plan 415: wikiosConfig.mediawiki.writeApiUrl)", () => {
    const urlsRequested = () => wiki.fetch.mock.calls.map(([input]) => String(input).split("?")[0]);
    it("is the internal URL when only that is set: a server-side call never goes out through the public host", async () => {
      delete process.env.WIKIOS_MEDIAWIKI_API;
      process.env.WIKIOS_MEDIAWIKI_INTERNAL_URL = "http://127.0.0.1:8081/api.php";

      await getBotSessionAndToken();

      expect(new Set(urlsRequested())).toEqual(new Set(["http://127.0.0.1:8081/api.php"]));
    });
  });

  describe("getBotSessionAndToken", () => {
    it("logs in as the bot password, forwards the session and returns the CSRF token", async () => {
      const session = await getBotSessionAndToken();

      expect(session.csrfToken).toBe("csrf-token+\\x");
      expect(session.cookies).toContain("wikiSession=abc");
      const login = wiki.requests.find((request) => request.params.action === "login");
      expect(login?.method).toBe("POST");
      expect(login?.params).toMatchObject({
        lgname: "WikiOSMirror@wikios",
        lgpassword: "bot-password",
        lgtoken: "login-token+\\",
      });
      // the CSRF token is fetched with the logged-in session
      const csrf = wiki.requests.find((request) => request.params.type === "csrf");
      expect(csrf?.cookie).toContain("wikiSession=abc");
    });

    it("caches the session, until the token is invalidated", async () => {
      await getBotSessionAndToken();
      const requests = wiki.requests.length;

      await getBotSessionAndToken();
      expect(wiki.requests).toHaveLength(requests);

      invalidateCsrfToken();
      await getBotSessionAndToken();
      expect(wiki.requests.length).toBeGreaterThan(requests);
    });

    it("throws, and sends nothing, when the bot credentials are not set", async () => {
      delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;

      await expect(getBotSessionAndToken()).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_USER/);
      expect(wiki.fetch).not.toHaveBeenCalled();

      process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
      delete process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN;
      await expect(getBotSessionAndToken()).rejects.toThrow(/WIKIOS_MEDIAWIKI_BOT_TOKEN/);
      expect(wiki.fetch).not.toHaveBeenCalled();
    });

    it("throws, and never asks for a CSRF token, when MediaWiki refuses the login", async () => {
      wiki.state.loginResult = "Failed";

      await expect(getBotSessionAndToken()).rejects.toThrow(/bot login failed: Failed/);
      expect(wiki.requests.some((request) => request.params.type === "csrf")).toBe(false);
    });

    it("throws when the token MediaWiki hands out is the anonymous one", async () => {
      wiki.state.csrfToken = "+\\";

      await expect(getBotSessionAndToken()).rejects.toThrow(/not logged in/);
    });
    it("does not cache a session whose login failed", async () => {
      wiki.state.loginResult = "Failed";
      await expect(getBotSessionAndToken()).rejects.toThrow();

      wiki.state.loginResult = "Success";
      await expect(getBotSessionAndToken()).resolves.toMatchObject({ csrfToken: "csrf-token+\\x" });
    });
  });

  describe("mirrorBotName", () => {
    it("is the account of the bot-password login, normalised; null when there is none", () => {
      process.env.WIKIOS_MEDIAWIKI_BOT_USER = "  wikiOSMirror@wikios";
      expect(mirrorBotName()).toBe("WikiOSMirror");

      process.env.WIKIOS_MEDIAWIKI_BOT_USER = "  @wikios";
      expect(mirrorBotName()).toBeNull();

      delete process.env.WIKIOS_MEDIAWIKI_BOT_USER;
      expect(mirrorBotName()).toBeNull();
    });
  });
});
