/** @jest-environment node */
/** AT-5: a rejected claimant gets one notification, sent through the preference-aware notification API. */
jest.mock("~/lib/notifications/api", () => ({
  notificationAPI: { create: jest.fn().mockResolvedValue("n1") },
}));

import { notificationAPI } from "~/lib/notifications/api";
import { notifyClaimRejected } from "~/server/modules/realms/realms.notices";

const create = notificationAPI.create as jest.Mock;

describe("notifyClaimRejected", () => {
  beforeEach(() => create.mockClear());

  it("addresses the claimant with the nation, the reason and a link to the realm's nations", async () => {
    await notifyClaimRejected({
      clerkUserId: "clerk_u1",
      nationName: "Aurelia",
      realmSlug: "eurth",
      reason: "Not your page",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "clerk_u1",
        title: "Claim rejected",
        message: "Your claim for Aurelia was rejected: Not your page",
        category: "system",
        href: "/r/eurth/nations",
        source: "realms",
      })
    );
  });

  it("links to the directory when the realm is unknown", async () => {
    await notifyClaimRejected({
      clerkUserId: "clerk_u1",
      nationName: "Aurelia",
      realmSlug: null,
      reason: "Duplicate",
    });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ href: "/realms" }));
  });
});
