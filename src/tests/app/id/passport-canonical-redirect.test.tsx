/** @jest-environment node */
/**
 * The passport route 308s a legacy URL segment to `/@{handle}` (keeping `?tab=`) once the holder has
 * a stored handle; the handle itself, `/@me` and unknown names render the page.
 */
import { isValidElement } from "react";

class RouteSignal extends Error {}
const mockPermanentRedirect = jest.fn((url: string) => {
  throw new RouteSignal(`permanent:${url}`);
});
jest.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => mockPermanentRedirect(url),
}));

const mockResolveCanonicalHandle = jest.fn();
jest.mock("~/server/modules/identity/identity.resolve", () => ({
  resolveCanonicalHandle: (segment: string) => mockResolveCanonicalHandle(segment),
}));

jest.mock("~/app/id/[username]/PassportPageClient", () => ({
  PassportPageClient: () => null,
}));

import { beforeEach, describe, expect, it } from "@jest/globals";
import PassportPage from "~/app/id/[username]/page";

function render(username: string, search: Record<string, string> = {}) {
  return PassportPage({
    params: Promise.resolve({ username }),
    searchParams: Promise.resolve(search),
  });
}

beforeEach(() => {
  mockPermanentRedirect.mockClear();
  mockResolveCanonicalHandle.mockReset().mockResolvedValue({ handle: "kir" });
});

describe("passport canonical redirect", () => {
  it("308s a forum-name URL to the stored handle, keeping the tab", async () => {
    await expect(render("Kir%20Forum", { tab: "work" })).rejects.toThrow("permanent:/@kir?tab=work");
    expect(mockResolveCanonicalHandle).toHaveBeenCalledWith("Kir Forum");
  });

  it("308s without a query when there is no tab", async () => {
    await expect(render("clerk_abc")).rejects.toThrow("permanent:/@kir");
  });

  it("renders the handle URL without redirecting", async () => {
    const page = await render("kir");
    expect(isValidElement(page)).toBe(true);
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("never redirects /@me", async () => {
    await render("me");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });

  it("renders when the segment names no user with a handle, or the lookup fails", async () => {
    mockResolveCanonicalHandle.mockResolvedValueOnce(null);
    await render("Someone");
    mockResolveCanonicalHandle.mockRejectedValueOnce(new Error("db down"));
    await render("Someone");
    expect(mockPermanentRedirect).not.toHaveBeenCalled();
  });
});
