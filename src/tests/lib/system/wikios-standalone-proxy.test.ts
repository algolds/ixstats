/** @jest-environment node */
/** The standalone guard in src/proxy.ts (plan 417): redirects, and the 500 of a build without an IxStates URL. */
import { afterEach, beforeAll, describe, expect, it, jest } from "@jest/globals";
import { NextRequest, type NextFetchEvent } from "next/server";

type Middleware = (req: NextRequest, event: NextFetchEvent) => Promise<Response>;
let middleware: Middleware;

beforeAll(async () => {
  // No Clerk keys: the simple middleware path, which is enough to reach the guard.
  delete process.env.CLERK_SECRET_KEY;
  delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  middleware = (await import("~/proxy")).default as unknown as Middleware;
});

const saved = {
  standalone: process.env.NEXT_PUBLIC_WIKIOS_STANDALONE,
  ixstates: process.env.NEXT_PUBLIC_IXSTATES_URL,
};

afterEach(() => {
  jest.restoreAllMocks();
  if (saved.standalone === undefined) delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
  else process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = saved.standalone;
  if (saved.ixstates === undefined) delete process.env.NEXT_PUBLIC_IXSTATES_URL;
  else process.env.NEXT_PUBLIC_IXSTATES_URL = saved.ixstates;
});

const run = (path: string, headers: Record<string, string> = {}) =>
  middleware(new NextRequest(`http://localhost${path}`, { headers }), {} as NextFetchEvent);

describe("proxy in WikiOS standalone mode", () => {
  it("does nothing special when the flag is off", async () => {
    delete process.env.NEXT_PUBLIC_WIKIOS_STANDALONE;
    const res = await run("/countries/ixnay");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("sends / to the Main Page with a relative Location", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    const res = await run("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/wiki/Main_Page");
  });

  it("sends paths WikiOS does not own to the configured IxStates URL, query kept", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    process.env.NEXT_PUBLIC_IXSTATES_URL = "https://ixwiki.com/projects/ixstates";
    const res = await run("/countries/ixnay?tab=gdp");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://ixwiki.com/projects/ixstates/countries/ixnay?tab=gdp"
    );
  });

  it("serves paths WikiOS owns without needing the IxStates URL", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    const res = await run("/wiki/Main_Page");
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });

  it("answers 500 and logs why when a redirect is needed but NEXT_PUBLIC_IXSTATES_URL is unset", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    delete process.env.NEXT_PUBLIC_IXSTATES_URL;
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await run("/vault");
    expect(res.status).toBe(500);
    expect(res.headers.get("location")).toBeNull();
    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("NEXT_PUBLIC_IXSTATES_URL is not set")
    );
  });

  it("still rejects a spoofed x-middleware-subrequest header first", async () => {
    process.env.NEXT_PUBLIC_WIKIOS_STANDALONE = "true";
    const res = await run("/", { "x-middleware-subrequest": "middleware" });
    expect(res.status).toBe(403);
  });
});
