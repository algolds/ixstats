/** @jest-environment node */
/**
 * A signed-in member fires bursts through the real procedure builders against the real in-memory RateLimiter (Redis
 * off): each builder lets exactly its own limit through per minute, on its own namespace, then answers "Too many
 * requests" without running the procedure. Another member keeps a full bucket; the same member with spoofed
 * x-ratelimit-identifier or x-forwarded-for headers does not; two anonymous visitors on different cf-connecting-ip
 * addresses get one bucket each; a minute later the bucket is full again. The claim, wiki-verification and
 * active-nation mutations sit on the light-mutation bucket and article reads on their own wiki_read bucket, each
 * refused before it reads anything.
 *
 * Folds rate-limit-middleware (each builder's namespace and limit), realm-rate-limits,
 * wikios-article-read-rate-limit and rate-limit-identity (which trusted header keys a visitor's bucket).
 */
jest.mock("~/env", () => ({
  env: { ...jest.requireActual("~/env").env, RATE_LIMIT_ENABLED: "true", REDIS_ENABLED: "false" },
}));
jest.mock("@clerk/nextjs/server", () => ({
  __esModule: true,
  getAuth: (req: { auth?: unknown } | undefined) => req?.auth ?? null,
  verifyToken: jest.fn(),
  clerkClient: jest.fn(),
}));
jest.mock("~/server/db", () => ({
  __esModule: true,
  db: {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { clerkUserId: string } }) => ({
        id: `db_${where.clerkUserId}`,
        clerkUserId: where.clerkUserId,
        countryId: null,
        role: null,
        lastSeenAt: new Date(),
      })),
    },
    auditLog: { create: jest.fn() },
  },
  isDatabaseReadOnly: true,
}));

import { rateLimiter } from "~/lib/cache";
import {
  adminProcedure,
  createCallerFactory,
  createTRPCContext,
  createTRPCRouter,
  lightMutationProcedure,
  rateLimitedMutationProcedure,
  rateLimitedPublicProcedure,
  readOnlyProcedure,
  standardMutationCountryOwnerProcedure,
} from "~/server/api/trpc";
import { realmsRouter } from "~/server/api/routers/realms";
import { ixnayidLinkingRouter } from "~/server/api/routers/ixnayid/linking";
import { usersCountryLinkingRouter } from "~/server/api/routers/users/country-linking";
import { wikiosPageContentRouter } from "~/server/api/routers/wikios/page-content";
import { createMockCallerContext, type MockCallerContext } from "~/tests/helpers/router-context";

const touched = jest.fn(() => "ok");
const burst = createCallerFactory(
  createTRPCRouter({
    publicRead: rateLimitedPublicProcedure.query(touched),
    costlyRead: readOnlyProcedure.query(touched),
    countryWrite: standardMutationCountryOwnerProcedure.mutation(touched),
    lightWrite: lightMutationProcedure.mutation(touched),
    write: rateLimitedMutationProcedure.mutation(touched),
    otherWrite: rateLimitedMutationProcedure.mutation(touched),
    adminWrite: adminProcedure.mutation(touched),
  })
);
type Burst = ReturnType<typeof burst>;

let run = 0;
/** A member (an admin, or a nation's owner) with a bucket no other test has used. */
function member(kind: "member" | "admin" | "owner" = "member"): MockCallerContext {
  const id = `user_${kind}_${++run}`;
  return createMockCallerContext({
    auth: { userId: id },
    user: {
      id: `db_${id}`,
      clerkUserId: id,
      countryId: kind === "owner" ? "country_1" : null,
      country: kind === "owner" ? { id: "country_1", name: "Testland", slug: "testland" } : null,
      role: kind === "admin" ? { name: "admin", level: 10 } : null,
    },
    db: {},
    rateLimitIdentifier: `user:${id}`,
  });
}

/** Calls `call` until it is refused; the number it let through. */
async function lettingThrough(call: () => Promise<unknown>, ceiling = 700): Promise<number> {
  for (let n = 0; n < ceiling; n++) {
    try {
      await call();
    } catch (error) {
      expect((error as Error).message).toMatch(
        /^Too many requests\. Maximum \d+ requests per 60 seconds/
      );
      expect((error as { cause?: { trpcCode?: string } }).cause?.trpcCode).toBe(
        "TOO_MANY_REQUESTS"
      );
      return n;
    }
  }
  throw new Error(`never refused after ${ceiling} calls`);
}

/** Uses up `n` requests of `identifier`'s bucket the way the middleware does. */
async function spend(identifier: string, namespace: string, n: number, maxRequests: number) {
  for (let i = 0; i < n; i++)
    await rateLimiter.check(identifier, namespace, { maxRequests, windowMs: 60_000 });
}

/** A request through the real context, as a signed-in Clerk user or a visitor. */
const request = (userId: string | null, headers: Record<string, string>) =>
  createTRPCContext({
    headers: new Headers(headers),
    req: { auth: userId ? { userId } : null, headers: new Headers() } as never,
  });

beforeAll(() => {
  expect(rateLimiter.isEnabled()).toBe(true);
  for (const level of ["info", "log", "warn"] as const)
    jest.spyOn(console, level).mockImplementation(() => {});
});
beforeEach(() => touched.mockClear());

describe("each builder lets its own limit through a minute, then refuses without running the procedure", () => {
  it.each([
    ["rateLimitedPublicProcedure", "public", 100, (c: Burst) => c.publicRead(), "member"],
    ["readOnlyProcedure", "queries", 120, (c: Burst) => c.costlyRead(), "member"],
    [
      "standardMutationCountryOwnerProcedure",
      "mutations",
      60,
      (c: Burst) => c.countryWrite(),
      "owner",
    ],
    ["lightMutationProcedure", "light_mutations", 100, (c: Burst) => c.lightWrite(), "member"],
    ["rateLimitedMutationProcedure", "mutation:write", 60, (c: Burst) => c.write(), "member"],
    ["adminProcedure", "default", 100, (c: Burst) => c.adminWrite(), "admin"],
  ] as const)("%s: %s, %i a minute", async (_builder, namespace, max, call, kind) => {
    const ctx = member(kind);
    const caller = burst(ctx);
    expect(await lettingThrough(() => call(caller))).toBe(max);
    expect(touched).toHaveBeenCalledTimes(max);
    const status = await rateLimiter.getStatus(ctx.rateLimitIdentifier, namespace, {
      maxRequests: max,
      windowMs: 60_000,
    });
    expect(status.remaining).toBe(0);
  });

  it("gives each rate-limited mutation its own bucket, and each member their own", async () => {
    const ctx = member();
    expect(await lettingThrough(() => burst(ctx).write())).toBe(60);
    await expect(burst(ctx).otherWrite()).resolves.toBe("ok");
    await expect(burst(member()).write()).resolves.toBe("ok");
  });
});

describe("the bucket follows the real caller, never a header", () => {
  it("a member spoofing x-ratelimit-identifier or x-forwarded-for still hits their full bucket", async () => {
    const ctx = await request("user_spoofer", {});
    expect(ctx.rateLimitIdentifier).toBe("user:user_spoofer");
    expect(await lettingThrough(() => burst(ctx).lightWrite())).toBe(100);

    const spoofed = await request("user_spoofer", {
      "x-ratelimit-identifier": "user:someone_fresh",
      "x-forwarded-for": "198.51.100.1",
    });
    expect(spoofed.rateLimitIdentifier).toBe("user:user_spoofer");
    await expect(burst(spoofed).lightWrite()).rejects.toThrow(/Too many requests/);
  });

  it("two visitors on different cf-connecting-ip addresses get a bucket each, whatever they claim", async () => {
    const first = await request(null, {
      "cf-connecting-ip": "203.0.113.20",
      "x-ratelimit-identifier": "ip:203.0.113.21",
    });
    expect(first.rateLimitIdentifier).toBe("ip:203.0.113.20");
    expect(await lettingThrough(() => burst(first).publicRead())).toBe(100);

    const second = await request(null, {
      "cf-connecting-ip": "203.0.113.21",
      "x-forwarded-for": "203.0.113.20",
    });
    expect(second.rateLimitIdentifier).toBe("ip:203.0.113.21");
    await expect(burst(second).publicRead()).resolves.toBe("ok");
  });

  it.each([
    [
      "cf-connecting-ip over x-real-ip",
      { "cf-connecting-ip": "2.2.2.2", "x-real-ip": "3.3.3.3" },
      "ip:2.2.2.2",
    ],
    ["x-real-ip without cf-connecting-ip", { "x-real-ip": "3.3.3.3" }, "ip:3.3.3.3"],
    [
      "no trusted header, only client-set ones",
      { "x-ratelimit-identifier": "evil", "x-forwarded-for": "1.1.1.1" },
      "anonymous",
    ],
  ])("keys a visitor's bucket off %s", async (_case, headers, identifier) => {
    expect((await request(null, headers)).rateLimitIdentifier).toBe(identifier);
  });

  it("refills the bucket a minute later", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      const ctx = member();
      expect(await lettingThrough(() => burst(ctx).lightWrite())).toBe(100);
      jest.advanceTimersByTime(60_001);
      await expect(burst(ctx).lightWrite()).resolves.toBe("ok");
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("the mutations behind the light-mutation bucket and the article reads behind wiki_read", () => {
  /** A database any use of which fails the test. */
  const untouchable = () => {
    const tripwire = jest.fn(() => {
      throw new Error("the database must not be reached");
    });
    return { db: new Proxy({}, { get: tripwire }), tripwire };
  };

  it.each([
    [
      "realms.claimCountry",
      (ctx: MockCallerContext) =>
        createCallerFactory(realmsRouter)(ctx).claimCountry({
          countryId: "c1",
          consent: { accepted: true },
        }),
    ],
    [
      "realms.claimNationPage",
      (ctx: MockCallerContext) =>
        createCallerFactory(realmsRouter)(ctx).claimNationPage({
          realmSlug: "eurth",
          title: "Aurelia",
          consent: { accepted: true },
        }),
    ],
    [
      "ixnayid.startWikiVerification",
      (ctx: MockCallerContext) =>
        createCallerFactory(ixnayidLinkingRouter)(ctx).startWikiVerification({
          source: "iiwiki",
          username: "Kir",
        }),
    ],
    [
      "ixnayid.confirmWikiVerification",
      (ctx: MockCallerContext) =>
        createCallerFactory(ixnayidLinkingRouter)(ctx).confirmWikiVerification({
          source: "iiwiki",
        }),
    ],
    [
      "users.setActiveNation",
      (ctx: MockCallerContext) =>
        createCallerFactory(usersCountryLinkingRouter)(ctx).setActiveNation({ countryId: "e1" }),
    ],
  ])(
    "%s is refused once the member's light mutations are spent, before it reads anything",
    async (_name, call) => {
      const { db, tripwire } = untouchable();
      const ctx = { ...member(), db } as MockCallerContext;
      await spend(ctx.rateLimitIdentifier, "light_mutations", 100, 100);
      await expect(call(ctx)).rejects.toThrow(/Too many requests/);
      expect(tripwire).not.toHaveBeenCalled();
    }
  );

  it("wikios.getArticleHtml counts each read against the visitor's own wiki_read bucket of 600, and refuses past it", async () => {
    const visitor = createMockCallerContext({
      auth: null,
      user: null,
      rateLimitIdentifier: "ip:203.0.113.40",
    });
    const reader = createCallerFactory(wikiosPageContentRouter)(visitor);
    // A title no page can have: past the limiter it answers NOT_FOUND without reading anything
    await expect(reader.getArticleHtml({ title: "[invalid]" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    const status = await rateLimiter.getStatus("ip:203.0.113.40", "wiki_read", {
      maxRequests: 600,
      windowMs: 60_000,
    });
    expect(status.remaining).toBe(599);

    await spend("ip:203.0.113.40", "wiki_read", 599, 600);
    await expect(reader.getArticleHtml({ title: "[invalid]" })).rejects.toThrow(
      /Too many requests/
    );
  });
});
