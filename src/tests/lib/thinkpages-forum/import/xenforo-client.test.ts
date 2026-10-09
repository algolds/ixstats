/** @jest-environment node */
import {
  XenForoExportError,
  createXenForoClient,
  type XenForoClientOptions,
} from "~/lib/thinkpages-forum/import/xenforo-client";
import type { XfThread } from "~/lib/thinkpages-forum/import/xenforo-types";
import {
  FAKE_API_KEY,
  FAKE_API_URL,
  createFakeApi,
  createFakeClock,
  fixture,
  fixtureText,
  json,
  status,
  type FakeApi,
  type FakeClock,
} from "../../../helpers/xenforo-fake-api";

const THREADS_P1 = "/forums/12/threads?page=1&order=post_date&direction=asc";
const THREADS_P2 = "/forums/12/threads?page=2&order=post_date&direction=asc";
const POSTS_P1 = "/threads/100/posts?page=1&order=natural";
const POSTS_P2 = "/threads/100/posts?page=2&order=natural";

let api: FakeApi;
let clock: FakeClock;
let logged: string[];

function client(overrides: Partial<XenForoClientOptions> = {}) {
  return createXenForoClient({
    apiUrl: FAKE_API_URL,
    apiKey: FAKE_API_KEY,
    fetch: api.fetch,
    sleep: clock.sleep,
    now: clock.now,
    log: (line) => logged.push(line),
    bypassPermissions: false,
    ...overrides,
  });
}

async function collect<T>(gen: AsyncGenerator<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const item of gen) out.push(item);
  return out;
}

async function thrown<T>(promise: Promise<T>): Promise<XenForoExportError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof XenForoExportError) return error;
    throw error;
  }
  throw new Error("expected a XenForoExportError");
}

beforeEach(() => {
  api = createFakeApi();
  clock = createFakeClock();
  logged = [];
});

describe("createXenForoClient", () => {
  it("sends the key and Accept on every request and never impersonates a user", async () => {
    api.on("/index", fixture("index"));
    const result = await client().index();

    expect(result).toEqual({
      scopes: ["node:read", "thread:read", "user:read", "attachment:read"],
      superUser: true,
      keyType: "super",
    });
    const headers = api.calls[0]?.headers;
    expect(headers?.get("XF-Api-Key")).toBe(FAKE_API_KEY);
    expect(headers?.get("Accept")).toBe("application/json");
    expect(headers?.get("User-Agent")).toBe("IxStats-ForumExport/1.0");
    expect(headers?.has("XF-Api-User")).toBe(false);
  });

  it("sends the User-Agent it is given", async () => {
    api.on("/index", fixture("index"));
    await client({ userAgent: "Custom/2" }).index();
    expect(api.calls[0]?.headers.get("User-Agent")).toBe("Custom/2");
  });

  it("with a super key adds api_bypass_permissions=1 to every read after /index, never XF-Api-User", async () => {
    api.on("/index", fixture("index"));
    api.on("/nodes/?api_bypass_permissions=1", fixture("nodes"));
    api.on(`${THREADS_P1}&api_bypass_permissions=1`, fixture("forum-12-threads-p1"));
    api.on(`${THREADS_P2}&api_bypass_permissions=1`, fixture("forum-12-threads-p2"));
    const c = client({ bypassPermissions: "auto" });

    await c.index();
    expect(c.context()).toEqual({ keyType: "super", bypassPermissions: true });
    expect(await c.nodes()).toHaveLength(4);
    expect(await collect(c.threadsOf(12))).toHaveLength(3);
    expect(api.calls.map((call) => call.route)).toEqual([
      "/index",
      "/nodes/?api_bypass_permissions=1",
      `${THREADS_P1}&api_bypass_permissions=1`,
      `${THREADS_P2}&api_bypass_permissions=1`,
    ]);
    expect(api.calls.every((call) => !call.headers.has("XF-Api-User"))).toBe(true);
  });

  it("leaves bypass off for a key /index reports as a user key, and when told to", async () => {
    api.on("/index", () =>
      json(JSON.stringify({ key: { type: "user", scopes: ["thread:read"] } }))
    );
    api.on("/nodes/", fixture("nodes"));
    const auto = client({ bypassPermissions: "auto" });
    await auto.index();
    expect(auto.context()).toEqual({ keyType: "user", bypassPermissions: false });
    await auto.nodes();
    expect(api.calls.at(-1)?.route).toBe("/nodes/");

    const off = client({ bypassPermissions: false });
    await off.nodes();
    expect(api.calls.at(-1)?.route).toBe("/nodes/");
  });

  it("reports every scope for a key that allows all of them", async () => {
    api.on("/index", () =>
      json(JSON.stringify({ key: { type: "user", allow_all_scopes: true, scopes: [] } }))
    );
    expect(await client().index()).toEqual({ scopes: ["*"], superUser: false, keyType: "user" });
  });

  it("lists nodes with only the fields the snapshot keeps", async () => {
    api.on("/nodes/", fixture("nodes"));
    const nodes = await client().nodes();

    expect(nodes.map((n) => n.node_id)).toEqual([1, 12, 13, 14]);
    expect(nodes[1]).toEqual({
      node_id: 12,
      title: "General Discussion",
      description: "Talk about anything.",
      node_type_id: "Forum",
      parent_node_id: 1,
      display_order: 10,
      type_data: { discussion_count: 3, message_count: 5 },
    });
    expect(nodes[0]?.type_data).toBeUndefined();
  });

  it("follows pagination to last_page, folds in the sticky list once and keeps only snapshot fields", async () => {
    api.on(THREADS_P1, fixture("forum-12-threads-p1"));
    api.on(THREADS_P2, fixture("forum-12-threads-p2"));
    const threads: XfThread[] = await collect(client().threadsOf(12));

    expect(threads.map((t) => t.thread_id)).toEqual([100, 101, 102]);
    expect(api.calls.map((c) => c.route)).toEqual([THREADS_P1, THREADS_P2]);
    expect(threads[0]).not.toHaveProperty("User");
    expect(threads[0]).not.toHaveProperty("Forum");
    expect(threads[2]).toMatchObject({ user_id: 0, discussion_open: false, prefix_id: 3 });
    expect(threads[2]).not.toHaveProperty("discussion_type");
  });

  it("follows post pagination and keeps attachments inline", async () => {
    api.on(POSTS_P1, fixture("thread-100-posts-p1"));
    api.on(POSTS_P2, fixture("thread-100-posts-p2"));
    const posts = await collect(client().postsOf(100));

    expect(posts.map((p) => p.post_id)).toEqual([1000, 1001, 1002]);
    expect(posts[0]?.Attachments).toEqual([
      {
        attachment_id: 55,
        filename: "map.png",
        file_size: 4,
        content_type: "image/png",
        width: 1,
        height: 1,
      },
    ]);
    expect(posts[0]).not.toHaveProperty("User");
    expect(posts[0]?.last_edit_date).toBe(1700000500);
    expect(posts[1]).not.toHaveProperty("Attachments");
  });

  it("throws when the server repeats a page", async () => {
    api.on(THREADS_P1, fixture("forum-12-threads-p1"));
    api.on(THREADS_P2, () => {
      const page = JSON.parse(fixtureText("forum-12-threads-p1")) as {
        pagination: { current_page: number };
      };
      page.pagination.current_page = 2;
      return json(JSON.stringify(page));
    });

    const error = await thrown(collect(client().threadsOf(12)));
    expect(error.message).toMatch(/repeated/);
    expect(error.endpoint).toBe(THREADS_P2);
  });

  it("waits between requests so 10 requests at 4 rps take at least 2.25 s", async () => {
    api.on("/index", fixture("index"));
    const c = client({ requestsPerSecond: 4 });
    for (let i = 0; i < 10; i += 1) await c.index();

    expect(clock.now()).toBeGreaterThanOrEqual(2250);
    expect(c.stats()).toMatchObject({ requests: 10, retries: 0 });
    expect(c.stats().waitedMs).toBeGreaterThanOrEqual(2250);
  });

  it("retries a 503 with backoff and then succeeds", async () => {
    api.on("/index", status(503), fixture("index"));
    const c = client();

    expect((await c.index()).superUser).toBe(true);
    expect(api.calls).toHaveLength(2);
    expect(clock.sleeps).toContain(1000);
    expect(c.stats().retries).toBe(1);
  });

  it("retries 429 and network errors too", async () => {
    api.on(
      "/index",
      status(429),
      () => {
        throw new TypeError("fetch failed");
      },
      fixture("index")
    );
    const c = client();

    await c.index();
    expect(api.calls).toHaveLength(3);
    expect(clock.sleeps.filter((ms) => ms >= 1000)).toEqual([1000, 2000]);
  });

  it("honours Retry-After on a 429, capped at two minutes", async () => {
    const tooMany = (seconds: string) => () =>
      new Response("{}", { status: 429, headers: { "retry-after": seconds } });
    api.on("/index", tooMany("7"), tooMany("3600"), fixture("index"));

    await client().index();
    expect(clock.sleeps.filter((ms) => ms >= 1000)).toEqual([7000, 120_000]);
  });

  it("gives up after maxRetries retries: five 503s throw with status 503", async () => {
    api.on("/index", status(503));
    const error = await thrown(client({ maxRetries: 4 }).index());

    expect(error.status).toBe(503);
    expect(error.endpoint).toBe("/index");
    expect(api.calls).toHaveLength(5);
    expect(clock.sleeps.filter((ms) => ms >= 1000)).toEqual([1000, 2000, 4000, 8000]);
  });

  it("throws on 403 at once, without retrying, and never shows the key", async () => {
    api.on("/index", status(403));
    const error = await thrown(client().index());

    expect(error.status).toBe(403);
    expect(api.calls).toHaveLength(1);
    expect(error.message).not.toContain(FAKE_API_KEY);
    expect(String(error.stack)).not.toContain(FAKE_API_KEY);
    expect(logged.join("\n")).not.toContain(FAKE_API_KEY);
  });

  it("keeps the key out of a network error that happens to quote it", async () => {
    api.on("/index", () => {
      throw new TypeError(`connect failed with key ${FAKE_API_KEY}`);
    });
    const error = await thrown(client({ maxRetries: 1 }).index());

    expect(error.status).toBeUndefined();
    expect(error.message).not.toContain(FAKE_API_KEY);
    expect(error.message).toContain("[redacted]");
    expect(logged.join("\n")).not.toContain(FAKE_API_KEY);
  });

  it("returns null for a user the key may not read (403), without retrying", async () => {
    api.on("/users/7/", status(403));
    expect(await client().user(7)).toBeNull();
    expect(api.calls).toHaveLength(1);
  });

  it("throws a 403 on attachment data so the export can record it as forbidden", async () => {
    api.on("/attachments/55/data", status(403));
    const error = await thrown(client().attachmentData(55));
    expect(error.status).toBe(403);
    expect(api.calls).toHaveLength(1);
  });

  it("returns a lite user and null for a missing one", async () => {
    api.on("/users/7/", fixture("user-7"));
    const c = client();

    expect(await c.user(7)).toEqual({
      user_id: 7,
      username: "Admin",
      register_date: 1600000000,
      is_staff: true,
      message_count: 120,
    });
    expect(await c.user(999)).toBeNull();
    expect(api.calls.map((call) => call.route)).toEqual(["/users/7/", "/users/999/"]);
  });

  it("returns attachment bytes with their content type, and null for a missing attachment", async () => {
    const meta = JSON.parse(fixtureText("attachment-55")) as {
      attachment: { content_type: string };
    };
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    api.on(
      "/attachments/55/data",
      () =>
        new Response(bytes, {
          status: 200,
          headers: { "content-type": meta.attachment.content_type },
        })
    );
    const c = client();

    expect(await c.attachmentData(55)).toEqual({ bytes, contentType: "image/png" });
    expect(await c.attachmentData(56)).toBeNull();
  });

  it("throws on a 404 for a listing endpoint", async () => {
    const error = await thrown(client().nodes());
    expect(error.status).toBe(404);
  });
});
