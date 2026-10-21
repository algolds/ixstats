/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
/**
 * Scenario: an autoconfirmed member uploads Flag of Eurth.png from the editor's image dialog. The browser helper
 * (upload-api.ts) posts the bytes to POST /api/wiki/upload; the upload service stages them under their hash, records
 * the asset and its BlurHash, creates the File: page, logs the upload and queues the page's revision job before the
 * upload job. GET /api/wiki/file/Flag_of_Eurth.png streams the staged bytes; the mirror cycle then uploads them to
 * MediaWiki as the bot, the asset moves to MediaWiki's images path, the staged copy goes, the pages that use the file
 * go stale, and the file route sends readers to MediaWiki's copy. A second upload under the name is a warning.
 *
 * Real route, rights engine, upload service, staging (a temp directory), asset records, file route, mirror worker,
 * revision import and upload job, over the in-memory WikiOS tables (Prisma mode) and a MediaWiki that keeps state.
 *
 * Folds upload-api.test.ts: uploadQuery carries only the set fields, trimmed, one `category` each, `ignorewarnings=1`
 * only when asked (`{filename:"A.png"}` is exactly "filename=A.png"); postUpload posts the file as the body with its
 * own type, else application/octet-stream; a file over 10 MB is refused without a request; a refusal rejects with
 * UploadFailed carrying the code and the sentence; an answer that is not JSON rejects readably; describeWarnings says
 * a taken name will be replaced, that the same file already is the current version, and lists the duplicates.
 */
jest.mock("~/lib/wiki-os/config", () =>
  jest
    .requireActual("~/tests/helpers/live-wikios-config")
    .withLiveEnvironment(jest.requireActual("~/lib/wiki-os/config"))
);
jest.mock("~/server/db", () => {
  const fake = jest.requireActual("~/tests/helpers/fake-wiki-db").createFakeWikiDb({ prisma: true });
  return { __esModule: true, fake, db: fake.db, isDatabaseReadOnly: true };
});
const mockContext = jest.fn();
jest.mock("~/server/api/trpc/context", () => ({ createTRPCContext: (...args: unknown[]) => mockContext(...args) }));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: () => false,
  SYSTEM_OWNER_IDS: [],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({ __esModule: true, isSystemOwner: () => false }));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn(), createMany: jest.fn().mockResolvedValue([]) },
}));
jest.mock("~/lib/wiki-os/adapters/mediawiki/parsoid", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/adapters/mediawiki/parsoid"),
  renderArticleViaMediaWiki: jest.fn(async (wikitext: string) => ({ html: `<p>${wikitext}</p>`, metadata: null })),
}));
jest.mock("~/app/api/mediawiki/_rate-limit", () => ({ wikiMediaRateLimitResponse: jest.fn().mockResolvedValue(null) }));

import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { POST } from "~/app/api/wiki/upload/route";
import { GET as getFile } from "~/app/api/wiki/file/[...name]/route";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import { describeWarnings, postUpload, UploadFailed, uploadQuery, uploadSizeProblem } from "~/lib/wiki-os/upload-api";
import { isStaged } from "~/lib/wiki-os/services/upload-staging";
import { hashFile } from "~/lib/wiki-os/core/file-hash";
import { runMirrorCycle } from "~/lib/wiki-os/services/mirror-worker";
import { invalidateCsrfToken } from "~/lib/wiki-os/adapters/mediawiki/csrf-cache";
import { createFakeMediaWikiSite } from "~/tests/helpers/fake-mediawiki-site";
import { API_URL } from "~/tests/helpers/fake-mediawiki";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import type { createFakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { fake } = jest.requireMock("~/server/db") as { fake: ReturnType<typeof createFakeWikiDb> };
const { tables } = fake;

const as = (id: string | null, clerk = `clerk-${id}`, name = id ?? "") =>
  mockContext.mockResolvedValue(
    id === null
      ? createMockRouterContext({ auth: null, user: null })
      : createMockRouterContext({
          auth: { userId: clerk },
          user: { id, clerkUserId: clerk, wikiUsername: name, role: { name: "user", level: 100 } },
          rateLimitIdentifier: `user:${clerk}`,
        })
  );

const hex = (bytes: Uint8Array) => createHash("sha1").update(bytes).digest("hex");
const asset = () => tables.wikiAsset.rows.find((row) => row.title === "Flag of Eurth.png");
const jobs = () => tables.wikiMirrorJob.rows.map((job) => `${job.kind} ${job.title} ${job.state}`);
const fileRequest = (name: string, headers: Record<string, string> = {}) =>
  getFile(new NextRequest(`http://localhost:3000/api/wiki/file/${name}`, { headers }), {
    params: Promise.resolve({ name: [name] }),
  } as never);

let site: ReturnType<typeof createFakeMediaWikiSite>;
let directory: string;
/** What the browser helper sent: the route answers it in-process, MediaWiki's calls go to the fake site. */
let sent: Array<{ url: string; init: RequestInit }>;
let answerNext: Response | null;
const realFetch = global.fetch;

let flag: Uint8Array;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "wikios-upload-scenario-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
  flag = new Uint8Array(
    await sharp({ create: { width: 32, height: 16, channels: 3, background: { r: 200, g: 30, b: 40 } } }).png().toBuffer()
  );
});
afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
  global.fetch = realFetch;
});

beforeEach(() => {
  fake.reset();
  jest.clearAllMocks();
  invalidateCsrfToken();
  process.env.WIKIOS_MEDIAWIKI_API = API_URL;
  process.env.WIKIOS_MEDIAWIKI_BOT_USER = "WikiOSMirror@wikios";
  process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN = "bot-password";
  site = createFakeMediaWikiSite();
  sent = [];
  answerNext = null;
  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (!url.startsWith("/api/wiki/upload")) return site.fetch(input, init);
    sent.push({ url, init: init ?? {} });
    if (answerNext) {
      const answer = answerNext;
      answerNext = null;
      return answer;
    }
    return POST(new NextRequest(`http://localhost:3000${url}`, { ...init, duplex: "half" } as never));
  }) as never;

  tables.user.seed(
    { id: "member", clerkUserId: "clerk-member", wikiUsername: "Member" },
    { id: "newcomer", clerkUserId: "clerk-newcomer", wikiUsername: "Newcomer", createdAt: new Date() }
  );
  tables.wikiAccountLink.seed({ userId: "member", source: "ixwiki", username: "Member", verifiedAt: new Date("2026-01-01") });
  // a page that already shows the file: it goes stale when MediaWiki's copy takes over
  const eurth = tables.wikiArticle.insert({ title: "Eurth", slug: "eurth", wikitext: "[[File:Flag of Eurth.png]]", htmlSyncedAt: new Date() });
  tables.wikiImageLink.seed({ articleId: eurth.id, fileName: "Flag of Eurth.png" });
});

const flagFile = () => new File([flag], "Flag of Eurth.png", { type: "image/png" });

describe("a member uploads Flag of Eurth.png", () => {
  it("builds the query from the fields that are set", () => {
    const query = new URLSearchParams(
      uploadQuery({
        filename: "Flag of Eurth.png",
        description: "  A flag  ",
        license: "",
        categories: ["Flags", " ", "Eurth"],
        comment: "First",
        ignoreWarnings: true,
      })
    );
    expect([...query]).toEqual([
      ["filename", "Flag of Eurth.png"],
      ["description", "A flag"],
      ["comment", "First"],
      ["category", "Flags"],
      ["category", "Eurth"],
      ["ignorewarnings", "1"],
    ]);
    expect(uploadQuery({ filename: "A.png" })).toBe("filename=A.png");
  });

  it("is refused to a signed-out caller and a newcomer, a scripted SVG and an oversized file, and nothing is staged", async () => {
    as(null);
    await expect(postUpload(flagFile(), { filename: "Flag of Eurth.png" })).rejects.toBeInstanceOf(UploadFailed);
    as("newcomer");
    const refused = await postUpload(flagFile(), { filename: "Flag of Eurth.png" }).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(UploadFailed);
    expect((refused as UploadFailed).code).toBeTruthy();
    expect((refused as UploadFailed).message).toMatch(/\w/);

    as("member");
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'], "Evil.svg", {
      type: "image/svg+xml",
    });
    await expect(postUpload(svg, { filename: "Evil.svg" })).rejects.toBeInstanceOf(UploadFailed);

    const big = { size: MAX_UPLOAD_BYTES + 1, type: "image/png" } as Blob;
    expect(uploadSizeProblem(big)).toContain("10 MB");
    const before = sent.length;
    await expect(postUpload(big, { filename: "Big.png" })).rejects.toMatchObject({ code: "file-too-large" });
    expect(sent).toHaveLength(before); // no request at all

    // a proxy in front answers with an error page, not JSON
    answerNext = new Response("<html>Request Entity Too Large</html>", { status: 413 });
    await expect(postUpload(flagFile(), { filename: "Flag of Eurth.png" })).rejects.toMatchObject({
      code: "upload-failed",
      message: "The upload failed (413).",
    });

    expect(tables.wikiAsset.rows).toEqual([]);
    expect(tables.wikiMirrorJob.rows).toEqual([]);
    expect(await isStaged(hashFile(flag).base36)).toBe(false);
  });

  it("stages, serves, mirrors, and then sends readers to MediaWiki's copy", async () => {
    as("member");
    const uploaded = await postUpload(flagFile(), {
      filename: "Flag of Eurth.png",
      description: "The flag of Eurth.",
      license: "{{PD-self}}",
      categories: ["Flags"],
    });
    expect(uploaded).toMatchObject({ result: "Success" });
    // the browser sent the file as the body, with its own type
    expect(sent.at(-1)).toMatchObject({
      url: "/api/wiki/upload?filename=Flag+of+Eurth.png&description=The+flag+of+Eurth.&license=%7B%7BPD-self%7D%7D&category=Flags",
      init: { method: "POST", headers: { "Content-Type": "image/png" } },
    });

    // staged under its hash, recorded with a BlurHash, the File: page written, logged, two jobs in order
    const row = asset()!;
    expect(row).toMatchObject({ width: 32, height: 16, mimeType: "image/png" });
    expect(row.blurhash).toEqual(expect.any(String));
    expect(await isStaged(row.sha1 as string)).toBe(true);
    const page = tables.wikiArticle.rows.find((article) => article.title === "File:Flag of Eurth.png")!;
    expect(page.wikitext).toContain("The flag of Eurth.");
    expect(page.wikitext).toContain("[[Category:Flags]]");
    expect(tables.wikiLog.rows.map((log) => `${log.logType}/${log.action}`)).toEqual(["upload/upload"]);
    expect(jobs()).toEqual(["revision File:Flag of Eurth.png pending", "upload File:Flag of Eurth.png pending"]);

    // served from WikiOS: the very bytes, nosniff, an ETag that answers 304
    const served = await fileRequest("Flag_of_Eurth.png");
    expect(served.status).toBe(200);
    expect(Buffer.from(await served.arrayBuffer())).toEqual(Buffer.from(flag));
    expect(served.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const etag = served.headers.get("ETag")!;
    expect((await fileRequest("Flag_of_Eurth.png", { "If-None-Match": etag })).status).toBe(304);

    // the mirror: the page's revision first, then the bytes, as the bot
    expect(await runMirrorCycle()).toMatchObject({ done: 2, failed: 0 });
    expect(jobs()).toEqual(["revision File:Flag of Eurth.png done", "upload File:Flag of Eurth.png done"]);
    expect(site.pages.get("File:Flag of Eurth.png")?.fileSha1).toBe(hex(flag));
    expect(site.current("File:Flag of Eurth.png")?.text).toContain("The flag of Eurth.");
    // MediaWiki's copy takes over: the asset moves, the staged copy goes, the page that shows it is stale
    expect(String(asset()!.url)).toContain("/images/");
    expect(await isStaged(row.sha1 as string)).toBe(false);
    expect(tables.wikiArticle.rows.find((article) => article.title === "Eurth")?.htmlSyncedAt).toBeNull();
    const redirected = await fileRequest("Flag_of_Eurth.png");
    expect([301, 302, 307, 308]).toContain(redirected.status);
    expect(redirected.headers.get("Location")).toContain("/images/");

    // the same name again, with other bytes: a warning, and nothing stored
    const other = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: "#0000ff" } }).png().toBuffer());
    const warned = await postUpload(new File([other], "Flag of Eurth.png", { type: "image/png" }), { filename: "Flag of Eurth.png" });
    expect(warned).toMatchObject({ result: "Warning" });
    expect(describeWarnings((warned as { warnings: object }).warnings)).toEqual([
      'A file called "Flag of Eurth.png" already exists. Uploading will replace it with a new version.',
    ]);
    // the same bytes under the same name is already the current version; under another name, a duplicate
    const same = await postUpload(flagFile(), { filename: "Flag of Eurth.png" });
    expect(describeWarnings((same as { warnings: object }).warnings)).toEqual([
      '"Flag of Eurth.png" already has exactly this file as its current version.',
    ]);
    const copy = await postUpload(new File([flag], "Copy.png", { type: "image/png" }), { filename: "Copy.png" });
    expect(describeWarnings((copy as { warnings: object }).warnings)).toEqual([
      'The same file is already uploaded as "Flag of Eurth.png".',
    ]);
    expect(tables.wikiAsset.rows).toHaveLength(1);
    expect(jobs()).toHaveLength(2);
  });

  it("sends a file of no type as application/octet-stream", async () => {
    as("member");
    const untyped = new File([new Uint8Array([1])], "x.pdf", { type: "" });
    await postUpload(untyped, { filename: "x.pdf" }).catch(() => undefined);
    expect(sent.at(-1)).toMatchObject({
      url: "/api/wiki/upload?filename=x.pdf",
      init: { method: "POST", body: untyped, headers: { "Content-Type": "application/octet-stream" } },
    });
  });
});
