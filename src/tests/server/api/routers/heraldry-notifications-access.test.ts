/** Phase 5 audit findings: heraldry import SSRF/XSS, draft visibility, notification ownership. */
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("~/server/shared/layer-cache", () => ({ clearLayerCache: jest.fn() }));

import { heraldryMutationsRouter, isCommonsFileUrl } from "~/server/api/routers/heraldry/mutations";
import { heraldryQueriesRouter } from "~/server/api/routers/heraldry/queries";
import { notificationsUserRouter } from "~/server/api/routers/notifications/user";
import { sanitizeSvgMarkup } from "~/lib/utils/sanitize-html";
import { CALLER_CLERK_ID, createIdorContext } from "~/tests/helpers/country-idor-context";

const DESIGN_ID = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";

describe("heraldry charge import", () => {
  it("only fetches from upload.wikimedia.org over https", async () => {
    expect(isCommonsFileUrl("https://upload.wikimedia.org/wikipedia/commons/a/a0/Lion.svg")).toBe(
      true
    );
    expect(isCommonsFileUrl("http://upload.wikimedia.org/x.svg")).toBe(false);
    expect(isCommonsFileUrl("https://169.254.169.254/latest/meta-data")).toBe(false);

    const fetchSpy = jest.spyOn(global, "fetch");
    const caller = heraldryMutationsRouter.createCaller(createIdorContext({}));
    await expect(
      caller.importCommonsCharge({
        name: "Lion",
        category: "ANIMALS",
        url: "http://localhost:5432/",
        license: "CC0",
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("strips scripts and handlers from SVG markup", () => {
    const clean = sanitizeSvgMarkup(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><path d="M0 0" onload="alert(2)"/></svg>'
    );
    expect(clean).not.toMatch(/script|onload|alert/i);
    expect(clean).toMatch(/<path/);
  });
});

describe("heraldry draft visibility", () => {
  function queriesAs(clerkId: string | null, design: { ownerId: string; isPublished: boolean }) {
    const ctx = createIdorContext({
      heraldryAchievement: {
        findUnique: jest.fn().mockResolvedValue({ id: DESIGN_ID, ...design }),
      },
      heraldryRevision: { findMany: jest.fn().mockResolvedValue([{ id: "r1" }]) },
    });
    ctx.auth = clerkId ? { userId: clerkId } : null;
    return heraldryQueriesRouter.createCaller(ctx);
  }

  it("hides another user's unpublished design", async () => {
    await expect(
      queriesAs("user_other", { ownerId: CALLER_CLERK_ID, isPublished: false }).getAchievement({
        id: DESIGN_ID,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("shows a published design to anyone and a draft to its owner", async () => {
    await expect(
      queriesAs(null, { ownerId: CALLER_CLERK_ID, isPublished: true }).getAchievement({
        id: DESIGN_ID,
      })
    ).resolves.toMatchObject({ id: DESIGN_ID });
    await expect(
      queriesAs(CALLER_CLERK_ID, { ownerId: CALLER_CLERK_ID, isPublished: false }).getAchievement({
        id: DESIGN_ID,
      })
    ).resolves.toMatchObject({ id: DESIGN_ID });
  });

  it("keeps revision history to the owner", async () => {
    await expect(
      queriesAs("user_other", { ownerId: CALLER_CLERK_ID, isPublished: true }).getRevisionHistory({
        achievementId: DESIGN_ID,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("notification tray mutations act on the caller only", () => {
  it("markAllAsRead ignores a userId sent by the client", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const ctx = createIdorContext({
      notification: { updateMany },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    });
    await notificationsUserRouter.createCaller(ctx).markAllAsRead({ userId: "user_victim" });
    expect(JSON.stringify(updateMany.mock.calls[0]![0].where)).not.toContain("user_victim");
    expect(JSON.stringify(updateMany.mock.calls[0]![0].where)).toContain(CALLER_CLERK_ID);
  });
});

describe("notification tray lists what the badge counts", () => {
  it("includes notifications addressed by the internal user id (sports results)", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const ctx = createIdorContext({
      notification: { findMany, count: jest.fn().mockResolvedValue(0) },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: "db_internal_1",
          clerkUserId: CALLER_CLERK_ID,
          countryId: null,
        }),
      },
    });
    await notificationsUserRouter.createCaller(ctx).getUserNotifications({});
    const where = JSON.stringify(findMany.mock.calls[0]![0].where);
    expect(where).toContain("db_internal_1");
    expect(where).toContain(CALLER_CLERK_ID);
  });
});
