/** @jest-environment node */
// `jest` is deliberately NOT imported from "@jest/globals": the hoisted jest.mock() factories rely on the ambient global.
//
// Plan 411: POST /api/wiki/upload. The file is the raw request body, counted as it streams (the limit holds whatever
// Content-Length says), a form type is refused (no cross-site form can post a file), and the upload service's refusals
// become the HTTP statuses and MediaWiki-style codes the upload form shows.
const mockContext = jest.fn();
jest.mock("~/server/api/trpc/context", () => ({
  createTRPCContext: (...args: unknown[]) => mockContext(...args),
}));
const mockRateCheck = jest.fn();
jest.mock("~/lib/cache/rate-limiter", () => ({
  rateLimiter: { check: (...args: unknown[]) => mockRateCheck(...args) },
}));
const mockUpload = jest.fn();
jest.mock("~/lib/wiki-os/services/upload-service", () => ({
  uploadFile: (...args: unknown[]) => mockUpload(...args),
}));
const mockPermissions = jest.fn();
jest.mock("~/lib/wiki-os/rights", () => ({
  getWikiPermissions: (...args: unknown[]) => mockPermissions(...args),
}));

import { NextRequest } from "next/server";
import { TRPCError } from "@trpc/server";
import { GET, POST } from "~/app/api/wiki/upload/route";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";
import { UploadError } from "~/lib/wiki-os/services/upload-error";

const SIGNED_IN = { auth: { userId: "u1" }, user: { id: "db1" }, rateLimitIdentifier: "user:u1" };
const FILE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 255, 128]);

const post = (
  query: string,
  body: BodyInit | null = FILE,
  headers: Record<string, string> = { "Content-Type": "image/png" }
) =>
  POST(
    new NextRequest(`http://localhost:3000/api/wiki/upload?${query}`, {
      method: "POST",
      body,
      headers,
      ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
    } as RequestInit)
  );

/** A body that streams `total` bytes in 1 MB chunks, with no Content-Length. */
const streamOf = (total: number) => {
  let sent = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      const size = Math.min(1_000_000, total - sent);
      if (size <= 0) return controller.close();
      sent += size;
      controller.enqueue(new Uint8Array(size));
    },
  });
};

const success = { result: "Success", filename: "Flag.png", title: "File:Flag.png" };

beforeEach(() => {
  jest.clearAllMocks();
  mockContext.mockResolvedValue(SIGNED_IN);
  mockRateCheck.mockResolvedValue({ success: true, remaining: 19, resetAt: new Date() });
  mockUpload.mockResolvedValue(success);
});

describe("POST /api/wiki/upload", () => {
  it("hands the bytes and the fields to the upload service, and answers with its result", async () => {
    const response = await post(
      "filename=Flag.png&description=A%20flag&license=%7B%7BPD%7D%7D&comment=First&category=Flags&category=Eurth&ignorewarnings=1"
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(success);
    expect(mockUpload).toHaveBeenCalledTimes(1);
    const request = mockUpload.mock.calls[0]?.[0];
    expect(request).toMatchObject({
      ctx: SIGNED_IN,
      filename: "Flag.png",
      description: "A flag",
      license: "{{PD}}",
      comment: "First",
      categories: ["Flags", "Eurth"],
      ignoreWarnings: true,
    });
    expect(Buffer.from(request.bytes)).toEqual(Buffer.from(FILE));
  });

  it("does not ignore warnings unless the uploader says so, and passes a warning answer on as a 200", async () => {
    const warning = {
      result: "Warning",
      filename: "Flag.png",
      title: "File:Flag.png",
      warnings: { exists: "Flag.png" },
    };
    mockUpload.mockResolvedValue(warning);

    const response = await post("filename=Flag.png");

    expect(await response.json()).toEqual(warning);
    expect(mockUpload.mock.calls[0]?.[0]).toMatchObject({ ignoreWarnings: false, categories: [] });
  });

  it("refuses a signed-out caller before reading anything", async () => {
    mockContext.mockResolvedValue({ auth: null, user: null, rateLimitIdentifier: "ip:1.2.3.4" });

    const response = await post("filename=Flag.png");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "mustbeloggedin" });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["a form post", "application/x-www-form-urlencoded"],
    ["a multipart form", "multipart/form-data; boundary=x"],
    ["plain text", "text/plain"],
  ])("refuses %s: no cross-site form may upload", async (_name, type) => {
    const response = await post("filename=Flag.png", FILE, { "Content-Type": type });

    expect(response.status).toBe(415);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a body with no type", async () => {
    expect((await post("filename=Flag.png", FILE, {})).status).toBe(415);
  });

  it("is rate limited", async () => {
    mockRateCheck.mockResolvedValue({ success: false, remaining: 0, resetAt: new Date() });

    const response = await post("filename=Flag.png");

    expect(response.status).toBe(429);
    expect(mockRateCheck).toHaveBeenCalledWith("user:u1", "wiki_upload", {
      maxRequests: 20,
      windowMs: 60_000,
    });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it.each([
    ["no file name", ""],
    ["a description over the limit", `filename=a.png&description=${"d".repeat(1001)}`],
    ["too many categories", `filename=a.png${"&category=c".repeat(11)}`],
    ["a category over the limit", `filename=a.png&category=${"c".repeat(61)}`],
  ])("refuses %s", async (_name, query) => {
    const response = await post(query);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: "badparams" });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a file that says it is too large, without reading it", async () => {
    const response = await post("filename=Flag.png", FILE, {
      "Content-Type": "image/png",
      "Content-Length": String(MAX_UPLOAD_BYTES + 1),
    });

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({ code: "file-too-large" });
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("refuses a file that streams past the limit, whatever its Content-Length said (it has none)", async () => {
    const response = await post("filename=Flag.png", streamOf(MAX_UPLOAD_BYTES + 1));

    expect(response.status).toBe(413);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("takes a file of exactly the limit", async () => {
    const response = await post("filename=Flag.png", streamOf(MAX_UPLOAD_BYTES));

    expect(response.status).toBe(200);
    expect(mockUpload.mock.calls[0]?.[0].bytes.length).toBe(MAX_UPLOAD_BYTES);
  });

  it("gives the service an empty file when there is no body, which the service refuses", async () => {
    mockUpload.mockRejectedValue(
      new UploadError("empty-file", "The file you submitted was empty.")
    );

    const response = await post("filename=Flag.png", null);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "The file you submitted was empty.",
      code: "empty-file",
    });
    expect(mockUpload.mock.calls[0]?.[0].bytes.length).toBe(0);
  });
});

describe("the service's refusals", () => {
  it.each([
    [
      new UploadError("unsafe-svg", "This SVG was refused because it contains a <script> element."),
      400,
      "unsafe-svg",
    ],
    [new UploadError("filetype-mime-mismatch", "wrong extension"), 400, "filetype-mime-mismatch"],
    [new UploadError("file-too-large", "too large"), 413, "file-too-large"],
    [
      new TRPCError({
        code: "FORBIDDEN",
        message: "protectedpage: This page is protected from upload (sysop).",
      }),
      403,
      "protectedpage",
    ],
    [
      new TRPCError({ code: "FORBIDDEN", message: "blocked: You are blocked from editing." }),
      403,
      "blocked",
    ],
    [
      new TRPCError({ code: "BAD_REQUEST", message: "That page title is not valid." }),
      400,
      undefined,
    ],
    [
      new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "This page was deleted; ask an administrator to restore it",
      }),
      409,
      undefined,
    ],
  ])("%s is a %i", async (error, status, code) => {
    mockUpload.mockRejectedValue(error);

    const response = await post("filename=Flag.png");

    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error).toBe((error as Error).message);
    expect(body.code).toBe(code);
  });

  it("answers a failure it does not know with a 500 and no detail", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockUpload.mockRejectedValue(new Error("connect ECONNREFUSED db:5432"));

    const response = await post("filename=Flag.png");

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("ECONNREFUSED");
  });
});

describe("GET /api/wiki/upload", () => {
  const get = () => GET(new NextRequest("http://localhost:3000/api/wiki/upload"));

  it("says whether the caller may upload, with the limits", async () => {
    mockPermissions.mockResolvedValue({ rights: new Set(["upload"]) });

    expect(await (await get()).json()).toMatchObject({
      signedIn: true,
      canUpload: true,
      maxBytes: MAX_UPLOAD_BYTES,
      extensions: expect.arrayContaining(["png", "svg", "pdf"]),
    });
  });

  it("says no to a newcomer and to a signed-out caller", async () => {
    mockPermissions.mockResolvedValue({ rights: new Set(["edit"]) });
    expect(await (await get()).json()).toMatchObject({ signedIn: true, canUpload: false });

    mockContext.mockResolvedValue({ auth: null, user: null });
    expect(await (await get()).json()).toMatchObject({ signedIn: false, canUpload: false });
  });
});
