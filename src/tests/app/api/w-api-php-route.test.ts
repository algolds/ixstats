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
import { fakeServices, fakeWiki, makeDeps, HEKU } from "../../lib/wiki-os/api-compat/harness";
import { MAX_UPLOAD_BYTES } from "~/lib/wiki-os/config";

const mockAuth = jest.mocked(auth) as unknown as jest.Mock;
const mockCreateDeps = jest.mocked(createApiDeps);

type Route = typeof import("~/app/w/api.php/route");
let route: Route;
let deps: Awaited<ReturnType<typeof makeDeps>>;
let uploads: ReturnType<typeof fakeServices>;

beforeAll(async () => {
  const wiki = { pages: [{ pageId: 1, title: "Alpha" }], files: [] };
  uploads = fakeServices(wiki);
  deps = await makeDeps({ store: fakeWiki(wiki), services: uploads.services });
  mockCreateDeps.mockReturnValue(deps);
  route = await import("~/app/w/api.php/route");
});

beforeEach(() => mockAuth.mockResolvedValue({ userId: null }));

const url = (query = "") => `http://localhost:3000/w/api.php${query ? `?${query}` : ""}`;
const json = async (response: Response) => (await response.json()) as Record<string, any>;

/** Log in over HTTP, the way a bot does, and return the cookie to send back. */
async function login(): Promise<{ cookie: string; setCookie: string }> {
  const tokenResponse = await route.GET(
    new NextRequest(url("action=query&meta=tokens&type=login&format=json"))
  );
  const nonceHeader = tokenResponse.headers.get("set-cookie");
  expect(nonceHeader).toContain("wikios_api_login=");
  const nonceCookie = nonceHeader!.split(";")[0]!;
  const loginToken = (await json(tokenResponse)).query.tokens.logintoken;

  const response = await route.POST(
    new NextRequest(url(), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: nonceCookie },
      body: new URLSearchParams({
        action: "login",
        lgname: "Heku@Bot",
        lgpassword: "bot-secret",
        lgtoken: loginToken,
        format: "json",
      }).toString(),
    })
  );
  const setCookie = response.headers.get("set-cookie")!;
  expect((await json(response)).login.result).toBe("Success");
  return { cookie: setCookie.split(";")[0]!, setCookie };
}

describe("GET", () => {
  it("answers JSON with HTTP 200 and no caching", async () => {
    const response = await route.GET(
      new NextRequest(url("action=query&meta=siteinfo&siprop=general&format=json"))
    );
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
      new NextRequest(url("action=query&meta=userinfo"), {
        headers: { "cf-connecting-ip": "203.0.113.5" },
      })
    );
    expect((await json(response)).query.userinfo).toMatchObject({
      id: 0,
      name: "203.0.113.5",
      anon: "",
    });
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
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "content-length": String(5 * 1024 * 1024),
        },
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
        const chunk =
          sent === 0 && prefix
            ? encoder.encode(prefix + "x".repeat(MB - prefix.length))
            : encoder.encode("x".repeat(MB));
        sent += MB;
        state.pulled++;
        controller.enqueue(chunk);
      },
    });
    return { stream, state };
  }

  const post = (body: BodyInit, headers: Record<string, string>) =>
    route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers,
        body,
        duplex: "half",
      } as ConstructorParameters<typeof NextRequest>[1])
    );

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
    const { stream, state } = chunkedBody(
      30 * MB,
      `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n`
    );
    const response = await post(stream, {
      "content-type": `multipart/form-data; boundary=${boundary}`,
    });
    expect(response.status).toBe(413);
    expect((await json(response)).error.code).toBe("toobig");
    expect(state.pulled).toBeLessThan(12);
  });

  it("does not trust a Content-Length that undersells the body", async () => {
    const { stream } = chunkedBody(30 * MB, "action=edit&text=");
    const response = await post(stream, {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": "20",
    });
    expect(response.status).toBe(413);
    expect((await json(response)).error.code).toBe("toobig");
  });

  it("refuses an honest oversized Content-Length with 413 before reading anything", async () => {
    const response = await post("action=query", {
      "content-type": "application/x-www-form-urlencoded",
      "content-length": String(5 * MB),
    });
    expect(response.status).toBe(413);
  });

  it("still reads a body just under the limit", async () => {
    const response = await post(`action=query&meta=tokens&format=json&pad=${"x".repeat(3 * MB)}`, {
      "content-type": "application/x-www-form-urlencoded",
    });
    expect(response.status).toBe(200);
    expect((await json(response)).query.tokens.csrftoken).toBe("+\\");
  });

  it("answers a multipart body the parser cannot read with 400 badrequest, never a 500", async () => {
    const response = await post("not multipart at all", {
      "content-type": "multipart/form-data; boundary=xx",
    });
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe("badrequest");
  });
});

describe("an upload: a multipart body with a file part (plan 411)", () => {
  const MB = 1024 * 1024;

  async function csrfToken(cookie: string): Promise<string> {
    const tokens = await json(
      await route.GET(new NextRequest(url("action=query&meta=tokens"), { headers: { cookie } }))
    );
    return tokens.query.tokens.csrftoken;
  }

  const uploadForm = (
    bytes: Uint8Array<ArrayBuffer>,
    token: string,
    fields: Record<string, string> = {}
  ) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({
      action: "upload",
      format: "json",
      formatversion: "2",
      filename: "Flag.png",
      comment: "A flag",
      token,
      ...fields,
    })) {
      form.set(key, value);
    }
    form.set("file", new Blob([bytes], { type: "image/png" }), "local-name.png");
    return form;
  };

  beforeEach(() => {
    uploads.calls.length = 0;
  });

  it("hands the file part to the module, byte for byte, together with the fields", async () => {
    const { cookie } = await login();
    const bytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 255, 128, 7]);

    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { cookie },
        body: uploadForm(bytes, await csrfToken(cookie)),
      })
    );

    const body = await json(response);
    expect(body.upload.result).toBe("Success");
    const [request] = uploads.calls.find((call) => call.name === "uploadFile")!.args as [
      Record<string, any>,
    ];
    expect(request).toMatchObject({ filename: "Flag.png", comment: "A flag" });
    expect(Buffer.from(request.bytes)).toEqual(Buffer.from(bytes));
  });

  it("lets a request with a session send a file of the upload limit, which a plain request may not (4 MB)", async () => {
    const { cookie } = await login();
    const token = await csrfToken(cookie);
    const big = new Uint8Array(MAX_UPLOAD_BYTES - 1000);

    const accepted = await route.POST(
      new NextRequest(url(), { method: "POST", headers: { cookie }, body: uploadForm(big, token) })
    );
    expect((await json(accepted)).upload.result).toBe("Success");

    const anonymous = await route.POST(
      new NextRequest(url(), { method: "POST", body: uploadForm(new Uint8Array(5 * MB), token) })
    );
    expect(anonymous.status).toBe(413);
    expect((await json(anonymous)).error.code).toBe("toobig");
  });

  it("lets only a session this server signed send a file that large: a made-up cookie keeps the 4 MB limit (review M4)", async () => {
    const { cookie } = await login();
    const token = await csrfToken(cookie);
    const big = new Uint8Array(5 * MB);

    for (const forged of [
      "wikios_api_session=forged",
      "wikios_api_session=abc.def",
      "wikios_api_session=",
    ]) {
      const response = await route.POST(
        new NextRequest(url(), {
          method: "POST",
          headers: { cookie: forged },
          body: uploadForm(big, token),
        })
      );
      expect(response.status).toBe(413);
      expect((await json(response)).error.code).toBe("toobig");
    }
  });

  it("counts a multipart body's parts before it parses them, and refuses too many (review M4)", async () => {
    const { cookie } = await login();
    const token = await csrfToken(cookie);
    const many = (parts: number) => {
      const form = uploadForm(new Uint8Array([1, 2, 3]), token);
      for (let i = 0; i < parts; i++) form.set(`pad${i}`, "x");
      return form;
    };

    const accepted = await route.POST(
      new NextRequest(url(), { method: "POST", headers: { cookie }, body: many(40) })
    );
    expect((await json(accepted)).upload.result).toBe("Success");

    const started = Date.now();
    const refused = await route.POST(
      new NextRequest(url(), { method: "POST", headers: { cookie }, body: many(5000) })
    );
    expect(refused.status).toBe(400);
    expect((await json(refused)).error).toMatchObject({
      code: "badrequest",
      info: expect.stringContaining("64 parts"),
    });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("reads the boundary the way the parser does, and refuses a missing or over-long one before reading the body (review M4b)", async () => {
    const { cookie } = await login();
    const token = await csrfToken(cookie);
    const form = uploadForm(new Uint8Array([1, 2, 3]), token);
    const probe = new Response(form);
    const real = /boundary=([^;]+)/.exec(probe.headers.get("content-type")!)![1]!;
    const bytes = new Uint8Array(await probe.arrayBuffer());
    const send = (type: string, body: BodyInit = bytes) =>
      route.POST(
        new NextRequest(url(), { method: "POST", headers: { cookie, "content-type": type }, body })
      );

    // a normal multipart request still works
    const normal = await send(`multipart/form-data; boundary=${real}`);
    expect((await json(normal)).upload.result).toBe("Success");

    // a boundary a parameter's quoted text only mentions is not the boundary: the real one counts, so the part cap still holds
    const many = new FormData();
    many.set("action", "upload");
    for (let i = 0; i < 200; i++) many.set(`pad${i}`, "x");
    const manyProbe = new Response(many);
    const manyBoundary = /boundary=([^;]+)/.exec(manyProbe.headers.get("content-type")!)![1]!;
    const manyBytes = new Uint8Array(await manyProbe.arrayBuffer());
    const bypass = await send(
      `multipart/form-data; x="a;boundary=zzz"; boundary=${manyBoundary}`,
      manyBytes
    );
    expect(bypass.status).toBe(400);
    expect((await json(bypass)).error.info).toContain("64 parts");

    // no boundary, an empty one, or one over 70 characters: 400 at once, whatever the body
    for (const type of [
      "multipart/form-data",
      "multipart/form-data; boundary=",
      `multipart/form-data; boundary=${"b".repeat(71)}`,
      "multipart/form-data; boundary=" + "b".repeat(8000),
    ]) {
      const refused = await send(type);
      expect(refused.status).toBe(400);
      expect((await json(refused)).error).toMatchObject({
        code: "badrequest",
        info: expect.stringContaining("70 characters"),
      });
    }
    // 70 characters is allowed
    const edge = await send(`multipart/form-data; boundary=${"b".repeat(70)}`);
    expect((await json(edge)).error.info).not.toContain("70 characters");
  });

  it("answers a long boundary over a 4 MiB body in milliseconds, not seconds, with no session (review M4b)", async () => {
    // the vector: an 8 KB boundary and a body of near-matches made the part count cost 3.4 s of event loop for 4 MiB
    const nearMatches = Buffer.from(`--${"a".repeat(7998)}b`.repeat(525)).subarray(
      0,
      4 * 1024 * 1024 - 100
    );
    const started = Date.now();
    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": `multipart/form-data; boundary=${"a".repeat(8000)}` },
        body: nearMatches,
      })
    );
    expect(response.status).toBe(400);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("refuses a body past the upload limit even with a session, and stops reading it", async () => {
    const { cookie } = await login();
    const token = await csrfToken(cookie);

    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { cookie },
        body: uploadForm(new Uint8Array(MAX_UPLOAD_BYTES + 200_000), token),
      })
    );

    expect(response.status).toBe(413);
    expect((await json(response)).error.code).toBe("toobig");
    expect(uploads.calls.filter((call) => call.name === "uploadFile")).toHaveLength(0);
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
      await route.GET(
        new NextRequest(url("action=query&meta=userinfo&formatversion=2"), { headers: { cookie } })
      )
    );
    expect(info.query.userinfo).toMatchObject({ id: 7, name: "Heku" });
    expect(info.query.userinfo.anon).toBeUndefined();
  });

  it("is cleared by logout", async () => {
    const { cookie } = await login();
    const tokens = await json(
      await route.GET(new NextRequest(url("action=query&meta=tokens"), { headers: { cookie } }))
    );
    const response = await route.POST(
      new NextRequest(url(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: new URLSearchParams({
          action: "logout",
          token: tokens.query.tokens.csrftoken,
        }).toString(),
      })
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("a signed-in browser user", () => {
  it("may read through api.php but never write", async () => {
    deps.auth.findWebUser = jest.fn().mockResolvedValue(HEKU);
    mockAuth.mockResolvedValue({ userId: "user_clerk_heku" });

    const read = await json(
      await route.GET(new NextRequest(url("action=query&meta=userinfo&formatversion=2")))
    );
    expect(read.query.userinfo).toMatchObject({ name: "Heku" });
    expect(deps.auth.findWebUser).toHaveBeenCalledWith("user_clerk_heku");

    const write = await json(
      await route.POST(
        new NextRequest(url(), {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            action: "edit",
            title: "Alpha",
            text: "x",
            token: "+\\",
          }).toString(),
        })
      )
    );
    expect(write.error.code).toBe("writeapidenied");
  });
});
