/** @jest-environment node */
import { NextRequest } from "next/server";
import { writeFile, access, rename } from "fs/promises";

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1" }),
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
  rename: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  // Default: the file is not there yet.
  access: jest.fn().mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
}));
jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: jest.fn() },
}));
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

import { rateLimiter } from "~/lib/cache";
import { POST } from "~/app/api/download/external-image/route";

const TRUSTED_URL = "https://ixwiki.com/images/a/ab/Flag.png";

/** A body with a valid PNG signature followed by `fill`-valued padding. */
const pngBytes = (size: number, fill = 0): Uint8Array => {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};

const imageResponse = (body: Uint8Array, contentType = "image/png") =>
  new Response(new Blob([body]), { status: 200, headers: { "content-type": contentType } });

const postRequest = (imageUrl: string) =>
  new NextRequest("http://localhost:3000/api/download/external-image", {
    method: "POST",
    body: JSON.stringify({ imageUrl }),
    headers: { "Content-Type": "application/json" },
  });

describe("POST /api/download/external-image", () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: true, resetAt: new Date(Date.now() + 60_000) } as never);
    jest.mocked(access).mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    fetchMock = jest.spyOn(global, "fetch");
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it("rejects SVG responses without writing a file", async () => {
    fetchMock.mockResolvedValue(
      new Response("<svg onload='alert(1)'></svg>", {
        status: 200,
        headers: { "content-type": "image/svg+xml" },
      })
    );

    const res = await POST(postRequest(TRUSTED_URL));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("SVG images are not supported for download");
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("refuses a redirect to an untrusted host", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 302, headers: { location: "https://evil.example/x.png" } })
    );

    const res = await POST(postRequest(TRUSTED_URL));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Redirect to untrusted host");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ redirect: "manual" });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("stops reading a body larger than 5MB and cancels the stream", async () => {
    const chunk = new Uint8Array(1024 * 1024);
    let reads = 0;
    const reader = {
      read: jest.fn(async () => (reads++ < 6 ? { done: false, value: chunk } : { done: true })),
      cancel: jest.fn(async () => undefined),
    };
    // No content-length header: the cap must be enforced while streaming.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({ "content-type": "image/png" }),
      body: { getReader: () => reader },
    } as never);

    const res = await POST(postRequest(TRUSTED_URL));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Image exceeds 5MB limit");
    expect(reader.cancel).toHaveBeenCalled();
    expect(reader.read.mock.calls.length).toBeLessThanOrEqual(6);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("saves a small PNG and returns its public URL", async () => {
    fetchMock.mockResolvedValue(imageResponse(pngBytes(1024)));

    const res = await POST(postRequest(TRUSTED_URL));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toMatch(/\/images\/downloaded\/downloaded_[0-9a-f]{32}\.png$/);
    expect(json.fileSize).toBe(1024);
    expect(writeFile).toHaveBeenCalledTimes(1);
    // Written to a temp file first, then renamed into place.
    const tempPath = jest.mocked(writeFile).mock.calls[0]![0] as string;
    expect(tempPath).toMatch(/\.tmp$/);
    expect(rename).toHaveBeenCalledWith(tempPath, tempPath.replace(/\.[0-9a-f]{16}\.tmp$/, ""));
  });

  it("answers 429 with Retry-After when the rate limiter refuses, before fetching anything", async () => {
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: false, resetAt: new Date(Date.now() + 30_000) } as never);

    const res = await POST(postRequest(TRUSTED_URL));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(rateLimiter.check).toHaveBeenCalledWith("user_1", "external_image_download", {
      maxRequests: 20,
      windowMs: 60_000,
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("stores the same bytes fetched from two URLs as one file", async () => {
    fetchMock.mockImplementation(async () => imageResponse(pngBytes(512)));
    // After the first write lands the file exists.
    jest.mocked(rename).mockImplementationOnce(async () => {
      jest.mocked(access).mockResolvedValue(undefined);
    });

    const first = await (await POST(postRequest(TRUSTED_URL))).json();
    const second = await (await POST(postRequest(`${TRUSTED_URL}?v=2`))).json();

    expect(second.fileName).toBe(first.fileName);
    expect(second.url).toBe(first.url);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("stores different bytes served from the same URL as two files", async () => {
    fetchMock
      .mockResolvedValueOnce(imageResponse(pngBytes(512, 1)))
      .mockResolvedValueOnce(imageResponse(pngBytes(512, 2)));

    const first = await (await POST(postRequest(TRUSTED_URL))).json();
    const second = await (await POST(postRequest(TRUSTED_URL))).json();

    expect(second.fileName).not.toBe(first.fileName);
    expect(writeFile).toHaveBeenCalledTimes(2);
  });

  it("rejects a body whose signature does not match the declared type", async () => {
    // Valid PNG bytes declared as JPEG, and plain text declared as PNG.
    fetchMock
      .mockResolvedValueOnce(imageResponse(pngBytes(256), "image/jpeg"))
      .mockResolvedValueOnce(imageResponse(new TextEncoder().encode("<html>not an image</html>")));

    const mismatched = await POST(postRequest(TRUSTED_URL));
    const text = await POST(postRequest(TRUSTED_URL));

    expect(mismatched.status).toBe(400);
    expect(text.status).toBe(400);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("accepts JPEG, GIF and WEBP signatures for their own types", async () => {
    const webp = new Uint8Array(32);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    const gif = new Uint8Array(32);
    gif.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    const jpeg = new Uint8Array(32);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0]);
    fetchMock
      .mockResolvedValueOnce(imageResponse(jpeg, "image/jpeg"))
      .mockResolvedValueOnce(imageResponse(gif, "image/gif"))
      .mockResolvedValueOnce(imageResponse(webp, "image/webp"));

    const statuses = [
      (await POST(postRequest(TRUSTED_URL))).status,
      (await POST(postRequest(TRUSTED_URL))).status,
      (await POST(postRequest(TRUSTED_URL))).status,
    ];

    expect(statuses).toEqual([200, 200, 200]);
  });

  it("rejects a URL with an explicit port before fetching", async () => {
    const res = await POST(postRequest("https://ixwiki.com:8443/images/a/ab/Flag.png"));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
