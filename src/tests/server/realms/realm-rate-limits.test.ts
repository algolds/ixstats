/** @jest-environment node */
/**
 * F-5.4: claim, wiki-verification and Play-as mutations run behind the light mutation rate limit — a caller over
 * the limit is refused before the procedure touches the database or a wiki.
 */
jest.mock("~/server/db", () => ({ db: {} }));

import { rateLimiter } from "~/lib/cache";
import { realmsRouter } from "~/server/api/routers/realms";
import { ixnayidLinkingRouter } from "~/server/api/routers/ixnayid/linking";
import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { createMockRouterContext } from "~/tests/helpers/router-context";

const player = { id: "u1", clerkUserId: "clerk_u1", countryId: null, role: null };

function context() {
  const touched = jest.fn(() => {
    throw new Error("the database must not be reached");
  });
  const db = new Proxy({}, { get: touched });
  return { ctx: createMockRouterContext({ auth: { userId: "clerk_u1" }, user: player, db }), touched };
}

describe("rate-limited realm and wiki-link mutations (F-5.4)", () => {
  let check: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(rateLimiter, "isEnabled").mockReturnValue(true);
    check = jest
      .spyOn(rateLimiter, "check")
      .mockResolvedValue({ success: false, remaining: 0, resetAt: new Date("2026-09-29T12:00:00Z") });
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  const calls: Array<[string, (ctx: ReturnType<typeof context>["ctx"]) => Promise<object>]> = [
    ["realms.claimCountry", (ctx) => realmsRouter.createCaller(ctx as never).claimCountry({ countryId: "c1" })],
    [
      "realms.claimNationPage",
      (ctx) => realmsRouter.createCaller(ctx as never).claimNationPage({ realmSlug: "eurth", title: "Aurelia" }),
    ],
    [
      "ixnayid.startWikiVerification",
      (ctx) =>
        ixnayidLinkingRouter.createCaller(ctx as never).startWikiVerification({ source: "iiwiki", username: "Kir" }),
    ],
    [
      "ixnayid.confirmWikiVerification",
      (ctx) => ixnayidLinkingRouter.createCaller(ctx as never).confirmWikiVerification({ source: "iiwiki" }),
    ],
    [
      "users.setActiveNation",
      (ctx) => usersCountryLinkingRouter.createCaller(ctx as never).setActiveNation({ countryId: "e1" }),
    ],
  ];

  it.each(calls)("%s is refused over the light mutation limit", async (_name, call) => {
    const { ctx, touched } = context();
    await expect(call(ctx)).rejects.toThrow(/Too many requests/);
    expect(check).toHaveBeenCalledWith(ctx.rateLimitIdentifier, "light_mutations", {
      maxRequests: 100,
      windowMs: 60000,
    });
    expect(touched).not.toHaveBeenCalled();
  });
});
