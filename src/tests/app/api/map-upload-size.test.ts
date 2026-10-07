/** @jest-environment node */
/**
 * The map upload routes refuse an oversize body by its Content-Length, before `formData()` buffers it.
 */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/server/shared/route-auth", () => ({
  requireAdminSession: jest.fn().mockResolvedValue({ userId: "admin_1" }),
}));
jest.mock("@clerk/nextjs/server", () => ({
  auth: jest.fn().mockResolvedValue({ userId: "owner_1", sessionClaims: {} }),
}));

import type { NextRequest } from "next/server";
import { POST as uploadSvg } from "~/app/api/admin/upload-svg/route";
import { POST as uploadProvince } from "~/app/api/upload-province/route";
import { oversizedUploadResponse } from "~/server/shared/request-size";

const MB = 1024 * 1024;

/** A request whose body is never meant to be read: `formData` records whether the route tried. */
function uploadRequest(contentLength?: number) {
  const headers = new Headers();
  if (contentLength !== undefined) headers.set("content-length", String(contentLength));
  const formData = jest.fn().mockResolvedValue(new FormData());
  return { request: { headers, formData } as unknown as NextRequest, formData };
}

describe("map upload routes — body size", () => {
  it.each([
    ["/api/admin/upload-svg", uploadSvg, 51 * MB, "50MB"],
    ["/api/upload-province", uploadProvince, 21 * MB, "20MB"],
  ] as const)("%s answers 413 without reading an oversize body", async (_path, post, size, max) => {
    const { request, formData } = uploadRequest(size);
    const response = await post(request);
    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: `File too large (max ${max})` });
    expect(formData).not.toHaveBeenCalled();
  });

  it.each([
    ["/api/admin/upload-svg", uploadSvg],
    ["/api/upload-province", uploadProvince],
  ] as const)("%s reads a body within the limit", async (_path, post) => {
    const { request, formData } = uploadRequest(2 * MB);
    const response = await post(request);
    expect(formData).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(400); // the empty form has no file
  });
});

describe("oversizedUploadResponse", () => {
  const withLength = (value: string | null) =>
    ({ headers: new Headers(value === null ? {} : { "content-length": value }) }) as Request;

  it("leaves room for the multipart envelope around a file at the limit", () => {
    expect(oversizedUploadResponse(withLength(String(10 * MB + 1024)), 10 * MB)).toBeNull();
    expect(oversizedUploadResponse(withLength(String(11 * MB)), 10 * MB)?.status).toBe(413);
  });

  it("defers to the file check when Content-Length is missing or unreadable", () => {
    expect(oversizedUploadResponse(withLength(null), 10 * MB)).toBeNull();
    expect(oversizedUploadResponse(withLength("lots"), 10 * MB)).toBeNull();
  });
});
