/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 411: who may upload, and under which name. These are the rights scenarios of the retired `wikios.uploadFile`
// (tRPC) tests, now over the upload service with the real rights engine and the real save of the File: page, on an in-memory
// fake of the WikiOS tables: only an autoconfirmed user uploads, never to a title protected from upload or from edit, the name is
// canonicalized before it is authorized, a block refuses it, and replacing a file needs the `reupload` right.
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: jest.requireActual("~/tests/helpers/fake-wiki-db").fakeWikiDb.db,
  isDatabaseReadOnly: true,
}));
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
  SYSTEM_OWNER_IDS: ["user_owner"],
  UserManagementService: jest.fn(),
}));
jest.mock("~/lib/auth/system-owner-constants", () => ({
  __esModule: true,
  isSystemOwner: (id: string) => id === "user_owner",
}));
jest.mock("~/lib/wiki-os/services/mirror-outbox", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/wiki-os/services/mirror-outbox"),
  scheduleMirrorKick: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/render-service", () => ({
  enqueueRender: jest.fn(),
  invalidateDependents: jest.fn(),
}));
jest.mock("~/lib/wiki-os/services/watchlist-notify", () => ({
  notifyWatchers: jest.fn().mockResolvedValue(0),
}));
jest.mock("~/lib/wiki-os/guardian/cloudflare-guardian", () => ({
  CloudflareGuardian: { purgeArticleEdgeCache: jest.fn() },
}));

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WikiAuthContext } from "~/lib/wiki-os/auth";
import { capWikiPermissions } from "~/lib/wiki-os/rights";
import { uploadFile } from "~/lib/wiki-os/services/upload-service";
import { fakeWikiDb } from "~/tests/helpers/fake-wiki-db";

const { tables } = fakeWikiDb;

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const png = (salt = 0) =>
  Uint8Array.from([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...be32(13),
    ...Buffer.from("IHDR"),
    ...be32(8),
    ...be32(8),
    8,
    6,
    0,
    0,
    0,
    salt,
  ]);

const ctxFor = (id: string, clerk: string, name: string, role = "user"): WikiAuthContext => ({
  auth: { userId: clerk },
  user: { id, clerkUserId: clerk, wikiUsername: name, role: { name: role, level: 100 } },
});

/** autoconfirmed through a verified wiki link (seeded in beforeEach). */
const member = () => ctxFor("dbmember", "user_member", "Member");
const plain = () => ctxFor("dbplain", "user_plain", "Newbie");
const sysop = () => ctxFor("dbsysop", "user_sysop", "Mod", "admin");
const anonymous: WikiAuthContext = { auth: null, user: null };

let directory: string;

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "wikios-upload-rights-test-"));
  process.env.WIKIOS_UPLOAD_DIR = directory;
});

afterAll(() => {
  rmSync(directory, { recursive: true, force: true });
  delete process.env.WIKIOS_UPLOAD_DIR;
});

beforeEach(() => {
  fakeWikiDb.reset();
  tables.user.seed(
    { id: "dbplain", wikiUsername: null },
    { id: "dbmember", wikiUsername: "Member" },
    { id: "dbsysop", wikiUsername: "Mod" }
  );
  tables.wikiAccountLink.seed({
    userId: "dbmember",
    source: "ixwiki",
    username: "Member",
    verifiedAt: new Date("2026-01-01"),
  });
});

const upload = (ctx: WikiAuthContext, filename: string, over: { ignoreWarnings?: boolean } = {}) =>
  uploadFile({ ctx, bytes: png(), filename, ...over });

const restrict = (title: string, action: string, level: string) =>
  tables.wikiRestriction.seed({ source: "ixwiki", title, action, level });

describe("who may upload", () => {
  it("an autoconfirmed user may; a signed-in newcomer and an anonymous caller may not, and nothing is stored", async () => {
    await expect(upload(anonymous, "Flag.png")).rejects.toMatchObject({
      message: expect.stringMatching(/^permissiondenied: /),
    });
    await expect(upload(plain(), "Flag.png")).rejects.toMatchObject({
      message: expect.stringMatching(/^permissiondenied: /),
    });
    expect(tables.wikiAsset.rows).toHaveLength(0);
    expect(tables.wikiMirrorJob.rows).toHaveLength(0);

    await expect(upload(member(), "Flag.png")).resolves.toMatchObject({ result: "Success" });
    expect(tables.wikiAsset.rows).toHaveLength(1);
  });

  it("a block refuses it", async () => {
    tables.wikiBlock.seed({ userId: "dbmember", reason: "vandalism" });

    await expect(upload(member(), "Flag.png")).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: expect.stringMatching(/^blocked: .*vandalism/),
    });
    expect(tables.wikiAsset.rows).toHaveLength(0);
  });

  it("never to a File: title protected from upload", async () => {
    restrict("File:Flag.png", "upload", "sysop");

    await expect(upload(member(), "Flag.png")).rejects.toMatchObject({
      message: expect.stringMatching(/^protectedpage: /),
    });
    expect(tables.wikiAsset.rows).toHaveLength(0);

    // an administrator may
    await expect(upload(sysop(), "Flag.png")).resolves.toMatchObject({ result: "Success" });
  });

  it("holds an upload to the edit protection of the File: page it would write", async () => {
    restrict("File:Flag.png", "edit", "sysop");

    await expect(upload(member(), "evil/Flag.png")).rejects.toMatchObject({
      message: expect.stringMatching(/^protectedpage: /),
    });
    expect(tables.wikiAsset.rows).toHaveLength(0);
  });
});

// The security review: rights are checked against the title MediaWiki will store the upload under.
describe("the upload name is canonicalized before it is authorized and stored", () => {
  it.each([
    ["Flag.png", "Flag.png"],
    ["some/dir/Flag.png", "Flag.png"],
    ["C:\\pics\\Flag.png", "Flag.png"],
    ["../../Flag.png", "Flag.png"],
    ["Template:Flag.png", "Template-Flag.png"],
    ["MediaWiki:Common.png", "MediaWiki-Common.png"],
    ["File:Flag.png", "File-Flag.png"],
    ["flag.png", "Flag.png"],
  ])("%s is stored, and authorized, as File:%s", async (filename, stored) => {
    // a protection on the canonical title applies whatever the raw name was
    restrict(`File:${stored}`, "upload", "sysop");

    await expect(upload(member(), filename)).rejects.toMatchObject({
      message: expect.stringMatching(/^protectedpage: /),
    });
    expect(tables.wikiAsset.rows).toHaveLength(0);

    await upload(sysop(), filename);
    expect(tables.wikiAsset.rows[0]).toMatchObject({ filename: stored.replace(/ /g, "_") });
    expect(tables.wikiLog.rows[0]).toMatchObject({ title: `File:${stored}` });
  });

  it("refuses a name with nothing usable in it", async () => {
    await expect(upload(member(), "dir/")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(tables.wikiAsset.rows).toHaveLength(0);
  });
});

describe("replacing a file needs the reupload right", () => {
  it("a bot password with only the upload grant may add a file, not replace one", async () => {
    const uploadOnly = async () => {
      const ctx = member();
      await capWikiPermissions(ctx, new Set(["read", "edit", "upload"]));
      return ctx;
    };
    await expect(
      uploadFile({ ctx: await uploadOnly(), bytes: png(1), filename: "Flag.png" })
    ).resolves.toMatchObject({ result: "Success", replaced: false });

    await expect(
      uploadFile({
        ctx: await uploadOnly(),
        bytes: png(2),
        filename: "Flag.png",
        ignoreWarnings: true,
      })
    ).rejects.toMatchObject({
      message: expect.stringMatching(/^permissiondenied: .*"reupload"/),
    });
    expect(tables.wikiAsset.rows[0]?.sha1).toBeTruthy();
    expect(tables.wikiLog.rows).toHaveLength(1);

    // the full set of an autoconfirmed user does it
    await expect(
      uploadFile({ ctx: member(), bytes: png(2), filename: "Flag.png", ignoreWarnings: true })
    ).resolves.toMatchObject({ result: "Success", replaced: true });
  });
});
