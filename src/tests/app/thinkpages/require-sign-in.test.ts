/** @jest-environment node */
jest.mock("next/navigation", () => ({
  redirect: jest.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  }),
  unstable_rethrow: jest.fn(),
}));
jest.mock("~/app/thinkpages/_lib/session-user-id", () => ({ sessionUserId: jest.fn() }));
jest.mock("~/lib/utils", () => ({
  createUrl: (path: string) => `https://example.test/projects/ixstats${path}`,
}));

import { redirect } from "next/navigation";
import { sessionUserId } from "~/app/thinkpages/_lib/session-user-id";
import { requireSignIn } from "~/app/thinkpages/_lib/require-sign-in";

describe("requireSignIn", () => {
  beforeEach(() => jest.mocked(redirect).mockClear());

  it("sends a signed-out visitor to sign-in and back to the page", async () => {
    jest.mocked(sessionUserId).mockResolvedValue(null);
    await expect(requireSignIn("/thinkpages/new")).rejects.toThrow(
      `NEXT_REDIRECT /sign-in?redirect_url=${encodeURIComponent("https://example.test/projects/ixstats/thinkpages/new")}`
    );
  });

  it("lets a signed-in member through", async () => {
    jest.mocked(sessionUserId).mockResolvedValue("clerk_1");
    await expect(requireSignIn("/thinkpages/new")).resolves.toBeUndefined();
    expect(redirect).not.toHaveBeenCalled();
  });
});
