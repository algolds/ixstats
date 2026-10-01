/** @jest-environment node */
/**
 * Plan 410: the /w/api.php route handler: parameters from the query string and from urlencoded and
 * multipart bodies, the session cookie round trip with its flags, the error header, the body
 * limit, and a signed-in browser user reading (never writing).
 */
jest.mock("@clerk/nextjs/server", () => ({ auth: jest.fn() }));
jest.mock("~/server/db", () => ({ __esModule: true, db: {} }));
jest.mock("~/lib/wiki-os/api-compat/deps", () => ({ createApiDeps: jest.fn() }));

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createApiDeps } from "~/lib/wiki-os/api-compat/deps";
import { fakeWiki, makeDeps, HEKU } from "../../lib/wiki-os/api-compat/harness";

const mockAuth = jest.mocked(auth) as unknown as jest.Mock;
const mockCreateDeps = jest.mocked(createApiDeps);

type Route = typeof import("~/app/w/api.php/route");
let route: Route;
let deps: Awaited<ReturnType<typeof makeDeps>>;

beforeAll(async () => {
  deps = await makeDeps({ store: fakeWiki({ pages: [{ pageId: 1, title: "Alpha" }] }) });
  mockCreateDeps.mockReturnValue(deps);
  route = await import("~/app/w/api.php/route");
});

beforeEach(() => mockAuth.mockResolvedValue({ userId: null }));

const url = (query = "") => `http://localhost:3000/w/api.php${query ? `?${query}` : ""}`;
const json = async (response: Response) => (await response.json()) as Record<string, any>;

/** Log in over HTTP, the way a bot does, and return the cookie to send back. */
async function login(): Promise<{ cookie: string; setCookie: string }> {
  const tokenResponse = await route.GET(new NextRequest(url("action=query&meta=tokens&type=login&format=json")));
  const nonceHeader = tokenResponse.headers.get("set-cookie");
  expect(nonceHeader).toContain("wikios_api_login=");
  const nonceCookie = nonceHeader!.split(";")[0]!;
  const loginToken = (await json(tokenResponse)).query.tokens.logintoken;

  const response = await route.POST(
    new NextRequest(url(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: nonceCookie },
      body: new URLSearchParams({ action: "login", lgname: "Heku@Bot", lgpassword: "bot-secret", lgtoken: loginToken, format: "json" }).toString(),
    })
  );
  const setCookie = response.headers.get("set-cookie")!;
  expect((await json(response)).login.result).toBe("Success");
  return { cookie: setCookie.split(";")[0]!, setCookie };
}

describe("GET", () => {
  it("answers JSON with HTTP 200 and no caching", async () => {
    const response = await route.GET(new NextRequest(url("action=query&meta=siteinfo&siprop=general&format=json")));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await json(response)).query.general.sitename).toBe("IxWiki");
  });

  it("reports an error as HTTP 200 with the code in the MediaWiki-API-Error header", async () => {
    const response = await route.GET(new NextRequest(url("action=nonsense")));
    expect(response.status).toBe(200);
    expect(response.headers.get("mediawiki-api-error")).toBe("badvalue");
    expect((await json(response)).error.code).toBe("badvalue");
  });

  it("names an anonymous caller by the address the proxy reports", async () => {
    const response = await route.GET(
      new NextRequest(url("action=query&meta=userinfo"), { headers: { "cf-connecting-ip": "203.0.113.5" } })
    );
    expect((await json(response)).query.userinfo).toMatchObject({ id: 0, name: "203.0.113.5", anon: "" });
  });
});

describe("POST bodies", () => {
  it("reads urlencoded parameters, and lets the body override the query string", async () => {
    const response = await route.POST(
      new NextRequest(url("action=nonsense"), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "action=query&meta=tokens&format=json",
      })
    );
    expect((await json(response)).query.tokens.csrftoken).toBe("+\\");
  });

  it("reads multipart/form-data text fields", async () => {
    const form = new FormData();
    form.set("action", "query");
    form.set("meta", "tokens");
    form.set("format", "json");
    const response = await route.POST(new NextRequest(url(), { method: "POST", body: form }));
    expect((await json(response)).query.tokens.csrftoken).toBe("+\\");
  });

  it("refuses a body larger than the limit with toobig", async () => {
    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "content-length": String(5 * 1024 * 1024) },
        body: "action=query",
      })
    );
    expect(response.headers.get("mediawiki-api-error")).toBe("toobig");
    expect((await json(response)).error.code).toBe("toobig");
  });

  it("also refuses an oversized body that sent no Content-Length", async () => {
    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `action=edit&text=${"x".repeat(4 * 1024 * 1024 + 10)}`,
      })
    );
    expect((await json(response)).error.code).toBe("toobig");
  });
});

describe("the body limit is enforced while streaming", () => {
  const MB = 1024 * 1024;

  /** A body of `totalBytes` in 1 MB chunks that counts how many chunks were pulled and sends no Content-Length. */
  function chunkedBody(totalBytes: number, prefix = "") {
    const state = { pulled: 0 };
    let sent = 0;
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= totalBytes) return controller.close();
        const chunk = sent === 0 && prefix ? encoder.encode(prefix + "x".repeat(MB - prefix.length)) : encoder.encode("x".repeat(MB));
        sent += MB;
        state.pulled++;
        controller.enqueue(chunk);
      },
    });
    return { stream, state };
  }

  const post = (body: BodyInit, headers: Record<string, string>) =>
    route.POST(new NextRequest(url(), { method: "POST", headers, body, duplex: "half" } as ConstructorParameters<typeof NextRequest>[1]));

  it("answers 413 toobig to a chunked 30 MB urlencoded body, and stops reading it", async () => {
    const { stream, state } = chunkedBody(30 * MB, "action=edit&text=");
    const response = await post(stream, { "content-type": "application/x-www-form-urlencoded" });
    expect(response.status).toBe(413);
    expect(response.headers.get("mediawiki-api-error")).toBe("toobig");
    expect((await json(response)).error.code).toBe("toobig");
    expect(state.pulled).toBeLessThan(12);
  });

  it("answers 413 toobig to a chunked 30 MB multipart body", async () => {
    const boundary = "xBOUNDARYx";
    const { stream, state } = chunkedBody(30 * MB, `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n`);
    const response = await post(stream, { "content-type": `multipart/form-data; boundary=${boundary}` });
    expect(response.status).toBe(413);
    expect((await json(response)).error.code).toBe("toobig");
    expect(state.pulled).toBeLessThan(12);
  });

  it("does not trust a Content-Length that undersells the body", async () => {
    const { stream } = chunkedBody(30 * MB, "action=edit&text=");
    const response = await post(stream, { "content-type": "application/x-www-form-urlencoded", "content-length": "20" });
    expect(response.status).toBe(413);
    expect((await json(response)).error.code).toBe("toobig");
  });

  it("refuses an honest oversized Content-Length with 413 before reading anything", async () => {
    const response = await post("action=query", { "content-type": "application/x-www-form-urlencoded", "content-length": String(5 * MB) });
    expect(response.status).toBe(413);
  });

  it("still reads a body just under the limit", async () => {
    const response = await post(`action=query&meta=tokens&format=json&pad=${"x".repeat(3 * MB)}`, { "content-type": "application/x-www-form-urlencoded" });
    expect(response.status).toBe(200);
    expect((await json(response)).query.tokens.csrftoken).toBe("+\\");
  });

  it("answers a multipart body the parser cannot read with 400 badrequest, never a 500", async () => {
    const response = await post("not multipart at all", { "content-type": "multipart/form-data; boundary=xx" });
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("badrequest");
  });
});

describe("the session cookie", () => {
  it("is HttpOnly, SameSite=Lax and scoped to the script's directory, and logs the next request in", async () => {
    const { cookie, setCookie } = await login();
    expect(setCookie).toContain("wikios_api_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/w/");
    expect(setCookie).toContain("Max-Age=86400");
    const info = await json(
      await route.GET(new NextRequest(url("action=query&meta=userinfo&formatversion=2"), { headers: { cookie } }))
    );
    expect(info.query.userinfo).toMatchObject({ id: 7, name: "Heku" });
    expect(info.query.userinfo.anon).toBeUndefined();
  });

  it("is cleared by logout", async () => {
    const { cookie } = await login();
    const tokens = await json(await route.GET(new NextRequest(url("action=query&meta=tokens"), { headers: { cookie } })));
    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: new URLSearchParams({ action: "logout", token: tokens.query.tokens.csrftoken }).toString(),
      })
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("a signed-in browser user", () => {
  it("may read through api.php but never write", async () => {
    deps.auth.findWebUser = jest.fn().mockResolvedValue(HEKU);
    mockAuth.mockResolvedValue({ userId: "user_clerk_heku" });

    const read = await json(await route.GET(new NextRequest(url("action=query&meta=userinfo&formatversion=2"))));
    expect(read.query.userinfo).toMatchObject({ name: "Heku" });
    expect(deps.auth.findWebUser).toHaveBeenCalledWith("user_clerk_heku");

    const write = await json(
      await route.POST(
        new NextRequest(url(), {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ action: "edit", title: "Alpha", text: "x", token: "+\\" }).toString(),
        })
      )
    );
    expect(write.error.code).toBe("writeapidenied");
  });
});
