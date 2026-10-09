/** @jest-environment node */
import { NextRequest } from "next/server";
import { writeFile, access } from "fs/promises";

jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "user_1" }),
}));
jest.mock("fs/promises", () => ({
  writeFile: jest.fn().mockResolvedValue(undefined),
  mkdir: jest.fn().mockResolvedValue(undefined),
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
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(1024), {
        status: 200,
        headers: { "content-type": "image/png" },
      })
    );

    const res = await POST(postRequest(TRUSTED_URL));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toMatch(/\/images\/downloaded\/downloaded_[0-9a-f]{32}\.png$/);
    expect(json.fileSize).toBe(1024);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it("answers 429 with Retry-After when the rate limiter refuses, before fetching anything", async () => {
    jest
      .mocked(rateLimiter.check)
      .mockResolvedValue({ success: false, resetAt: new Date(Date.now() + 30_000) } as never);

    const res = await POST(postRequest(TRUSTED_URL));

    expect(res.status).toBe(429);
    expect(Number(res.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(rateLimiter.check).toHaveBeenCalledWith("user_1", "file_upload");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("downloads the same URL twice to the same file name and writes it once", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(new Uint8Array(512), {
          status: 200,
          headers: { "content-type": "image/png" },
        })
    );
    // After the first write the file exists.
    jest.mocked(writeFile).mockImplementationOnce(async () => {
      jest.mocked(access).mockResolvedValue(undefined);
    });

    const first = await (await POST(postRequest(TRUSTED_URL))).json();
    const second = await (await POST(postRequest(TRUSTED_URL))).json();

    expect(second.fileName).toBe(first.fileName);
    expect(second.url).toBe(first.url);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});
