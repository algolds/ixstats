/** @jest-environment node */
/**
 * Plan 407: the page-operation mirror jobs (move, delete, undelete, protect), and the "already done" answers
 * MediaWiki gives a retry that must not fail the job. MediaWiki is a scripted fake.
 */
import type { WikiMirrorJob } from "@prisma/client";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { MediaWikiApiError } from "~/lib/wiki-os/adapters/mediawiki/write-service";
import { runPageJob } from "~/lib/wiki-os/services/mirror-page-ops";
import { API_URL, createFakeMediaWiki, type RecordedRequest } from "~/tests/helpers/fake-mediawiki";

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
        query: { redirects: [{ from: title, to: target }], pages: [{ title: target, pageid: 2 }] },
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

  it("suppresses the redirect when WikiOS left none", async () => {
    wiki.on("move", ok);

    await runPageJob(moveJob({ leaveRedirect: false }));

    expect(callsTo("move")[0]?.params.noredirect).toBe("1");
  });

  it("is done when the source is gone and the target is there: the move already went through", async () => {
    wiki.on("move", refuse("missingtitle"));
    pagesExist(["New name"]);

    await expect(runPageJob(moveJob())).resolves.toBeUndefined();
  });

  it("is done when the old title is the redirect the move left, and the destination is there", async () => {
    wiki.on("move", refuse("articleexists"));
    pagesExist(["Old name", "New name"], { "Old name": "New name" });

    await expect(runPageJob(moveJob())).resolves.toBeUndefined();
  });

  it("fails when the old title is a redirect to some other page", async () => {
    wiki.on("move", refuse("articleexists"));
    pagesExist(["Old name", "New name", "Elsewhere"], { "Old name": "Elsewhere" });

    await expect(runPageJob(moveJob())).rejects.toThrow(/articleexists/);
  });

  it("is done when MediaWiki says the title is already its own destination", async () => {
    wiki.on("move", refuse("selfmove"));

    await expect(runPageJob(moveJob())).resolves.toBeUndefined();
    expect(callsTo("query")).toHaveLength(0);
  });

  it("fails when the target is taken by another page: both titles exist", async () => {
    wiki.on("move", refuse("articleexists"));
    wiki.on("query", ({ params }) => ({ query: { pages: [{ title: params.titles, pageid: 1 }] } }));

    await expect(runPageJob(moveJob())).rejects.toThrow(/articleexists/);
  });

  it("fails when the page is missing at both titles", async () => {
    wiki.on("move", refuse("missingtitle"));
    pagesExist([]);

    await expect(runPageJob(moveJob())).rejects.toThrow(/missingtitle/);
  });

  it("fails on a refusal that is not about the work being done (permissions)", async () => {
    wiki.on("move", refuse("cantmove"));

    const failure = await runPageJob(moveJob()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(MediaWikiApiError);
    expect((failure as MediaWikiApiError).code).toBe("cantmove");
    expect(callsTo("query")).toHaveLength(0);
  });

  it("fails on a payload it cannot read", async () => {
    await expect(runPageJob(job("move", "Old name", { reason: "no target" }))).rejects.toThrow();

    expect(wiki.calls()).toEqual([]);
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

  it("fails on any other refusal", async () => {
    wiki.on("delete", refuse("permissiondenied"));

    await expect(runPageJob(job("delete", "Old name", { reason: "spam" }))).rejects.toThrow(
      /permissiondenied/
    );
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

    await expect(runPageJob(job("undelete", "Old name", { reason: "" }))).resolves.toBeUndefined();
  });

  it("fails when there is nothing to undelete and no page either", async () => {
    wiki.on("undelete", refuse("cantundelete"));
    pagesExist([]);

    await expect(runPageJob(job("undelete", "Old name", { reason: "" }))).rejects.toThrow(
      /cantundelete/
    );
  });

  it("fails on any other refusal without looking for the page", async () => {
    wiki.on("undelete", refuse("permissiondenied"));

    await expect(runPageJob(job("undelete", "Old name", { reason: "" }))).rejects.toThrow(
      /permissiondenied/
    );
    expect(callsTo("query")).toHaveLength(0);
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

  it("fails when MediaWiki refuses", async () => {
    wiki.on("protect", refuse("permissiondenied"));

    await expect(
      runPageJob(
        job("protect", "Old name", {
          reason: "",
          restrictions: [{ action: "edit", level: "sysop", expiresAt: null }],
        })
      )
    ).rejects.toThrow(/permissiondenied/);
  });
});

describe("runPageJob", () => {
  it("refuses a kind it does not know", async () => {
    await expect(runPageJob(job("upload", "File:X.png", {}))).rejects.toThrow(
      'Unknown mirror job kind "upload"'
    );
  });

  it("makes no call when the bot cannot log in", async () => {
    wiki.state.loginResult = "Failed";
    wiki.on("delete", ok);

    await expect(runPageJob(job("delete", "Old name", { reason: "" }))).rejects.toThrow(
      /bot login failed/
    );
    expect(wiki.calls()).toEqual([]);
  });
});
