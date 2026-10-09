/** @jest-environment node */
import { describe, it, expect, beforeEach } from "@jest/globals";

const mockRegister = jest.fn<Promise<unknown>, [unknown]>();

jest.mock("@clerk/nextjs/server", () => ({ auth: async () => ({ userId: "user_1" }) }));
jest.mock("~/lib/cache", () => ({
  rateLimiter: { check: async () => ({ success: true, resetAt: new Date() }) },
}));
jest.mock("fs/promises", () => ({
  writeFile: async () => undefined,
  mkdir: async () => undefined,
}));
jest.mock("~/server/shared/uploaded-assets", () => ({
  registerUploadedAsset: (input: unknown) => mockRegister(input),
}));

import type { NextRequest } from "next/server";
import { POST } from "~/app/api/upload/image/route";

function requestWith(file: File): NextRequest {
  const form = new FormData();
  form.set("file", file);
  return { formData: async () => form } as unknown as NextRequest;
}

describe("POST /api/upload/image", () => {
  beforeEach(() => {
    mockRegister.mockReset();
    mockRegister.mockResolvedValue(null);
  });

  it("records the upload with source upload and the Clerk user", async () => {
    const res = await POST(requestWith(new File([new Uint8Array([1, 2, 3])], "a.png", { type: "image/png" })));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; url: string };
    expect(body.success).toBe(true);
    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister.mock.calls[0]![0]).toMatchObject({
      source: "upload",
      uploaderClerkId: "user_1",
      mimeType: "image/png",
      url: body.url,
    });
  });

  it("rejects an SVG that cannot be sanitised without recording it", async () => {
    const res = await POST(
      requestWith(new File(["<script>alert(1)</script>"], "x.svg", { type: "image/svg+xml" }))
    );
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("SVG could not be sanitised");
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("stores a sanitised SVG and records it", async () => {
    const res = await POST(
      requestWith(new File(['<svg onload="x()"><rect/></svg>'], "ok.svg", { type: "image/svg+xml" }))
    );
    expect(res.status).toBe(200);
    expect(mockRegister.mock.calls[0]![0]).toMatchObject({ mimeType: "image/svg+xml", source: "upload" });
  });
});
