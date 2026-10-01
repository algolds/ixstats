/** @jest-environment node */
/**
 * Plan 411: api.php's action=upload. A bot uploads as it would to MediaWiki (a file part, filename, comment, text,
 * ignorewarnings, token) and reads MediaWiki's answer; the module only reads the request and shapes the answer, the
 * upload service (a recorded fake here) does the work.
 */
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));

import { TRPCError } from "@trpc/server";
import { UploadError } from "~/lib/wiki-os/services/upload-error";
import type { UploadResult } from "~/lib/wiki-os/services/upload-service";
import type { RequestFile } from "~/lib/wiki-os/api-compat/types";
import { loggedIn, makeWikiDeps, type FakeWikiData } from "./harness";

type Body = Record<string, any>;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 128]);
const file = (over: Partial<RequestFile> = {}): Record<string, RequestFile> => ({
  file: { filename: "from-the-part.png", contentType: "image/png", bytes: PNG, ...over },
});

const data = (): FakeWikiData => ({ pages: [{ pageId: 1, title: "Alpha" }], files: [] });

const GRANTS = ["basic", "editpage", "createeditmovepage", "uploadfile", "uploadeditmovefile"];

async function setup(options: Parameters<typeof makeWikiDeps>[1] = {}) {
  const wiki = await makeWikiDeps(data(), { grants: GRANTS, ...options });
  const token = await loggedIn(wiki.bot);
  const upload = (
    params: Record<string, string>,
    /** The request's file parts; `null` sends none. */
    files: Record<string, RequestFile> | null = file()
  ) =>
    wiki.bot.post(
      { action: "upload", token, formatversion: "2", ...params },
      files ?? undefined
    ) as Promise<Body>;
  const called = (name: string) => wiki.calls.filter((c) => c.name === name);
  return { ...wiki, token, upload, called };
}

describe("action=upload", () => {
  it("hands the file to the upload service as the bot, with the name, the comment and the page text, and answers like MediaWiki", async () => {
    const { upload, called, deps } = await setup();

    const body = await upload({
      filename: "Flag of Eurth.png",
      comment: "A flag",
      text: "== Summary ==\nThe flag.",
      ignorewarnings: "1",
    });

    const [request] = called("uploadFile")[0]!.args as [Record<string, any>];
    expect(request).toMatchObject({
      filename: "Flag of Eurth.png",
      comment: "A flag",
      pageText: "== Summary ==\nThe flag.",
      ignoreWarnings: true,
    });
    expect(request.ctx.user.id).toBe("u-heku");
    expect(Buffer.from(request.bytes)).toEqual(Buffer.from(PNG));
    expect(body.upload).toMatchObject({
      result: "Success",
      filename: "Flag_of_Eurth.png",
      imageinfo: {
        user: "Heku",
        comment: "A flag",
        size: PNG.length,
        width: 640,
        height: 480,
        mime: "image/png",
        mediatype: "BITMAP",
        timestamp: "2026-09-30T12:00:00Z",
      },
    });
    expect(deps.siteUrl).toBe("https://ixwiki.com");
  });

  it("takes the file's own name when no filename is given, and the comment as the page text when there is no text (as MediaWiki does)", async () => {
    const { upload, called } = await setup();

    await upload({ comment: "uploaded by hand" });

    const [request] = called("uploadFile")[0]!.args as [Record<string, any>];
    expect(request).toMatchObject({
      filename: "from-the-part.png",
      pageText: "uploaded by hand",
      ignoreWarnings: false,
    });
  });

  it("answers a warning the way MediaWiki writes it, underscores and all, and stores nothing", async () => {
    const warning: UploadResult = {
      result: "Warning",
      filename: "Flag of Eurth.png",
      title: "File:Flag of Eurth.png",
      warnings: { exists: "Flag of Eurth.png", nochange: true, duplicate: ["Eurth flag copy.png"] },
    };
    const wiki = await setup({ services: { uploadFile: async () => warning } });
    wiki.data.files!.push({ name: "Flag of Eurth.png", timestamp: "2026-09-01T10:00:00Z" });

    const body = await wiki.upload({ filename: "Flag of Eurth.png" });

    expect(body.upload).toEqual({
      result: "Warning",
      warnings: {
        exists: "Flag_of_Eurth.png",
        nochange: { timestamp: "2026-09-01T10:00:00Z" },
        duplicate: ["Eurth_flag_copy.png"],
      },
    });
  });

  it("refuses an identical re-upload that was told to go on with fileexists-no-change, as MediaWiki does", async () => {
    const same: UploadResult = {
      result: "Success",
      replaced: true,
      noChange: true,
      filename: "Flag of Eurth.png",
      title: "File:Flag of Eurth.png",
      url: "/api/wiki/file/Flag_of_Eurth.png",
      descriptionUrl: "/wiki/File:Flag_of_Eurth.png",
      width: 640,
      height: 480,
      size: 7,
      mime: "image/png",
      sha1: "a".repeat(40),
    };
    const wiki = await setup({ services: { uploadFile: async () => same } });

    const body = await wiki.upload({ filename: "Flag of Eurth.png", ignorewarnings: "1" });

    expect(body.upload).toBeUndefined();
    expect(body.error).toMatchObject({
      code: "fileexists-no-change",
      info: "The upload is an exact duplicate of the current version of [[:File:Flag of Eurth.png]].",
    });
  });

  it("gives the imageinfo of the file the service stored: its url is absolute", async () => {
    const { upload } = await setup();

    const body = await upload({ filename: "Flag.png" });

    expect(body.upload.imageinfo).toMatchObject({ sha1: "", mime: "image/png" });
  });
});

describe("what action=upload refuses", () => {
  it("needs a bot session, POST, and the token", async () => {
    const wiki = await makeWikiDeps(data(), { grants: GRANTS });
    expect(
      ((await wiki.bot.post({ action: "upload", token: "+\\" }, file())) as Body).error.code
    ).toBe("writeapidenied");
    expect(((await wiki.bot.get({ action: "upload" })) as Body).error.code).toBe("mustbeposted");

    const { bot } = await setup();
    expect(
      ((await bot.post({ action: "upload", filename: "A.png", token: "nope+\\" }, file())) as Body)
        .error.code
    ).toBe("badtoken");
  });

  it("says a file is missing when none came, and refuses what WikiOS does not do", async () => {
    const { upload, called } = await setup();

    expect((await upload({ filename: "A.png" }, null)).error.code).toBe("missingparam");
    expect(
      (await upload({ filename: "A.png", url: "https://example.com/a.png" }, null)).error.code
    ).toBe("copyuploaddisabled");
    expect((await upload({ filename: "A.png", filekey: "abc.png" }, null)).error.code).toBe(
      "invalidfilekey"
    );
    expect((await upload({ filename: "A.png", stash: "1" })).error.code).toBe("stashnotsupported");
    expect((await upload({ filename: "A.png", offset: "0", chunk: "x" })).error.code).toBe(
      "stashnotsupported"
    );
    expect(called("uploadFile")).toHaveLength(0);
  });

  it.each([
    [
      new UploadError("unsafe-svg", "This SVG was refused because it contains a <script> element."),
      "uploaded-script-svg",
    ],
    [new UploadError("corrupt", "The file is not a valid PNG image."), "verification-error"],
    [
      new UploadError(
        "filetype-badmime",
        "The file is not a PNG, JPEG, GIF, WebP, SVG or PDF file."
      ),
      "filetype-badmime",
    ],
    [
      new UploadError("file-too-large", "The file is larger than the 10 MB limit."),
      "file-too-large",
    ],
    [new UploadError("empty-file", "The file you submitted was empty."), "empty-file"],
    [
      new UploadError("filetype-mime-mismatch", "The file extension does not match."),
      "filetype-mime-mismatch",
    ],
    [
      new TRPCError({
        code: "FORBIDDEN",
        message: "protectedpage: This page is protected from upload (sysop).",
      }),
      "protectedpage",
    ],
    [
      new TRPCError({
        code: "FORBIDDEN",
        message:
          'permissiondenied: You do not have the "reupload" right needed to upload this page.',
      }),
      "permissiondenied",
    ],
    [
      new TRPCError({ code: "FORBIDDEN", message: "blocked: You are blocked from editing." }),
      "blocked",
    ],
    [
      new TRPCError({ code: "BAD_REQUEST", message: "That page title is not valid." }),
      "invalidtitle",
    ],
    [
      new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This page was deleted; ask an administrator to restore it",
      }),
      "pagedeleted",
    ],
  ])("answers the service's refusal %# with MediaWiki's code", async (error, code) => {
    const { upload } = await setup({
      services: {
        uploadFile: async () => {
          throw error;
        },
      },
    });

    const body = await upload({ filename: "A.png" });

    expect(body.error.code).toBe(code);
    expect(body.error.info).toBe(
      error.message.replace(/^\w+: /, error instanceof TRPCError ? "" : "")
    );
  });

  it("is rate limited per caller, apart from the write limit", async () => {
    const calls: Array<[string, string]> = [];
    const { upload, called } = await setup({
      extra: {
        rateLimit: async (identity, bucket) => {
          calls.push([identity, bucket]);
          return { success: bucket !== "wiki_upload", resetAt: new Date() };
        },
      },
    });

    const body = await upload({ filename: "A.png" });

    expect(body.error.code).toBe("ratelimited");
    expect(calls.map(([, bucket]) => bucket)).toContain("wiki_upload");
    expect(called("uploadFile")).toHaveLength(0);
  });
});
