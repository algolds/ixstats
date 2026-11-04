/** @jest-environment node */
/**
 * The proxy's /admin gate (src/proxy.ts) reads the one admin rule from the database, through isAdminClerkUser, and
 * no longer trusts a Clerk `publicMetadata.role`. A refusal still goes to /?error=access_denied.
 */
import { beforeAll, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";

type Middleware = (typeof import("~/proxy"))["default"];
type Session = {
  userId: string | null;
  sessionClaims: { publicMetadata?: { role?: string } } | null;
};
type Handler = (auth: () => Promise<Session>, req: NextRequest) => Promise<Response>;

let session: Session = { userId: null, sessionClaims: null };
const isAdminClerkUser = jest.fn<(clerkUserId: string) => Promise<boolean>>();

jest.mock("@clerk/nextjs/server", () => {
  const actual = jest.requireActual<typeof import("@clerk/nextjs/server")>("@clerk/nextjs/server");
  return {
    createRouteMatcher: actual.createRouteMatcher,
    clerkMiddleware: (handler: Handler) => (req: NextRequest) => handler(async () => session, req),
  };
});
jest.mock("~/server/shared/admin-access", () => ({
  isAdminClerkUser: (id: string) => isAdminClerkUser(id),
}));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

let middleware: Middleware;

beforeAll(async () => {
  process.env.CLERK_SECRET_KEY = "sk_test_proxy_admin";
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_proxy_admin";
  delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  jest.spyOn(console, "log").mockImplementation(() => undefined);
  middleware = (await import("~/proxy")).default;
});

beforeEach(() => {
  isAdminClerkUser.mockReset();
});

const run = async (path: string) => {
  const res = await middleware(new NextRequest(`http://localhost${path}`), {} as NextFetchEvent);
  if (!(res instanceof Response)) throw new Error(`The proxy gave no response for ${path}`);
  return res;
};
const deniedTo = (res: Response) => {
  const location = res.headers.get("location");
  return location ? new URL(location).searchParams.get("error") : null;
};

describe("the proxy's /admin gate", () => {
  it("lets in a user the database rule admits, with no Clerk role", async () => {
    session = { userId: "user_db_admin", sessionClaims: {} };
    isAdminClerkUser.mockResolvedValue(true);
    const res = await run("/admin/users");
    expect(isAdminClerkUser).toHaveBeenCalledWith("user_db_admin");
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends away a Clerk-only admin the database rule refuses", async () => {
    session = { userId: "user_clerk_admin", sessionClaims: { publicMetadata: { role: "admin" } } };
    isAdminClerkUser.mockResolvedValue(false);
    const res = await run("/admin");
    expect(deniedTo(res)).toBe("access_denied");
  });

  it("does not ask the database outside /admin", async () => {
    session = { userId: "user_any", sessionClaims: {} };
    await run("/settings");
    expect(isAdminClerkUser).not.toHaveBeenCalled();
  });

  it.each([
    ["/builder", "/builder"],
    ["/builder?import=1", "/builder?import=1"],
    ["/mycountry", "/mycountry"],
    ["/dashboard", "/dashboard"],
    ["/dashboard/accounts", "/dashboard/accounts"],
    ["/dashboard/saved", "/dashboard/saved"],
    ["/vault", "/vault"],
    ["/messages", "/messages"],
    ["/stashes", "/stashes"],
    ["/setup", "/setup"],
    ["/thinktanks", "/thinktanks"],
    ["/util/lorewards", "/util/lorewards"],
    ["/blurbs/submit", "/blurbs/submit"],
    ["/blurbs/mine", "/blurbs/mine"],
  ])("redirects signed-out visitor from %s to /sign-in with redirect_url", async (path, target) => {
    session = { userId: null, sessionClaims: null };
    const res = await run(path);
    const location = res.headers.get("location");
    expect(location).not.toBeNull();
    const url = new URL(location!);
    expect(url.pathname).toBe("/sign-in");
    expect(url.searchParams.get("redirect_url")).toBe(target);
  });

  it.each(["/", "/dashboard/post/123", "/dashboard/profile/abc", "/countries/caphiria", "/maps"])(
    "lets signed-out visitor open public route %s without redirect",
    async (path) => {
      session = { userId: null, sessionClaims: null };
      const res = await run(path);
      expect(res.headers.get("location")).toBeNull();
    }
  );
});
