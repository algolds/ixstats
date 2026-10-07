/** @jest-environment node */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));
jest.mock("~/server/modules/realms/realms.prefill", () => ({
  fetchNationPagePrefill: jest.fn(),
  EMPTY_PREFILL: { country: {}, identity: {} },
}));

import { createHash } from "node:crypto";
import sharp from "sharp";
import { globalCache } from "~/lib/cache";
import { createDiscoveryClient } from "~/lib/realms/sources/wiki-discovery-client";
import { isExternalHostOffline } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { realmsRouter } from "~/server/api/routers/realms";
import { fetchChosenWikiMapOriginal, realmInfoboxHints } from "~/server/modules/realms/realms.wiki";
import { EURTH_WIKI, fakeIiwiki, IIWIKI_FIXTURES, json, type FakeWiki } from "~/tests/helpers/iiwiki-fixtures";
import { createMockRouterContext } from "~/tests/helpers/router-context";

type Viewer = { id: string; clerkUserId: string; role?: { name: string; level: number } | null } | null;
const player: Viewer = { id: "u_player", clerkUserId: "clerk_player", role: null };
const founder: Viewer = { id: "u_founder", clerkUserId: "clerk_founder", role: null };
const admin: Viewer = { id: "u_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };

function realmDb(settings: Record<string, unknown> = { maxNationsPerUser: 2 }) {
  const state = { settings };
  const db: any = {
    state,
    realm: {
      findUnique: jest.fn(async () => ({
        id: "eurth-id",
        slug: "eurth",
        name: "Eurth",
        ownerId: "clerk_founder",
        settings: state.settings,
      })),
      update: jest.fn(async ({ data }: { data: { settings: Record<string, unknown> } }) => {
        state.settings = data.settings;
        return {};
      }),
    },
  };
  return db;
}

function caller(db: any, viewer: Viewer) {
  const ctx = createMockRouterContext({
    db,
    auth: viewer ? { userId: viewer.clerkUserId } : null,
    user: viewer ? { ...viewer, lastSeenAt: new Date() } : null,
  });
  return realmsRouter.createCaller(ctx as never).wiki;
}

const realFetch = globalThis.fetch;
let wiki: FakeWiki;
let png: Buffer;
const pngSha1 = () => createHash("sha1").update(png).digest("hex");

/** The recorded wiki, plus image downloads from /images/ and an optional override. */
function installWiki(respond?: (url: URL, index: number) => Response | undefined) {
  wiki = fakeIiwiki((url, index) => {
    const answer = respond?.(url, index);
    if (answer) return answer;
    if (url.pathname.startsWith("/images/")) return new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } });
    return undefined;
  });
  globalThis.fetch = wiki.fetch;
}

/** imageinfo for the political map whose SHA-1 is that of `png`. */
function imageinfoFor(sha1: string) {
  const recorded = IIWIKI_FIXTURES.imageinfo as { query: { pages: Array<{ title: string; imageinfo?: Array<Record<string, unknown>> }> } };
  const page = recorded.query.pages.find((p) => p.title === "File:Eurth political map 2024.png")!;
  return { query: { pages: [{ ...page, imageinfo: [{ ...page.imageinfo![0], sha1, size: png.byteLength, width: 64, height: 32 }] }] } };
}

beforeAll(async () => {
  png = await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 0, g: 90, b: 200 } } }).png().toBuffer();
});
beforeEach(async () => {
  installWiki();
  await globalCache.delete("realm-wiki-hints:eurth-id");
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

describe("realms.wiki permissions: site admins and the realm's founder only", () => {
  it("refuses signed-out viewers", async () => {
    await expect(caller(realmDb(), null).get({ slug: "eurth" })).rejects.toThrow("Authentication required");
  });

  it("refuses a player for every read and write, asking the wiki nothing", async () => {
    const db = realmDb({ wiki: EURTH_WIKI });
    const w = caller(db, player);
    await expect(w.get({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.save({ slug: "eurth", wiki: null })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.discover({ slug: "eurth", step: { kind: "roster" } })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.chooseMap({ slug: "eurth", fileTitle: "File:X.png" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.recheckMap({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(w.infoboxHints({ slug: "eurth" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(db.realm.update).not.toHaveBeenCalled();
    expect(wiki.calls).toEqual([]);
  });

  it("lets the founder and a site admin read the settings, the wikis offered and the presets", async () => {
    for (const viewer of [founder, admin]) {
      const view = await caller(realmDb(), viewer).get({ slug: "eurth" });
      expect(view.wiki).toBeNull();
      expect(view.map).toBeNull();
      expect(view.sources.map((s) => s.id)).toContain("iiwiki");
      expect(view.presets).toEqual([expect.objectContaining({ id: "eurth-map", wiki: EURTH_WIKI })]);
    }
  });
});

describe("realms.wiki.save", () => {
  it("validates, normalizes and stores the settings, keeping the realm's other settings", async () => {
    const db = realmDb();
    await caller(db, founder).save({
      slug: "eurth",
      wiki: { ...EURTH_WIKI, rootCategory: "category:Eurth", rosterCategory: "Category:Countries_(Eurth)" },
    });
    expect(db.state.settings).toEqual({ maxNationsPerUser: 2, wiki: EURTH_WIKI });

    await caller(db, admin).save({ slug: "eurth", wiki: null });
    expect(db.state.settings).toEqual({ maxNationsPerUser: 2 });
  });

  it("refuses a retired roster, naming the field", async () => {
    const db = realmDb();
    await expect(
      caller(db, founder).save({ slug: "eurth", wiki: { ...EURTH_WIKI, rosterCategory: "Category:Retired countries (Eurth)" } })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("rosterCategory") });
    expect(db.realm.update).not.toHaveBeenCalled();
  });
});

describe("realms.wiki.discover", () => {
  it("asks for the settings first", async () => {
    await expect(caller(realmDb(), founder).discover({ slug: "eurth", step: { kind: "roster" } })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("reads the roster on the realm's wiki", async () => {
    const step = await caller(realmDb({ wiki: EURTH_WIKI }), founder).discover({ slug: "eurth", step: { kind: "roster" } });
    expect(step).toMatchObject({ kind: "roster", blocked: false, stopped: null, requests: 2 });
    expect(step.kind === "roster" && step.data.nations).toHaveLength(5);
  });

  it("answers a refused step with blocked, not an error, and never takes the wiki offline", async () => {
    installWiki(() => new Response("Forbidden", { status: 403 }));
    const step = await caller(realmDb({ wiki: EURTH_WIKI }), admin).discover({
      slug: "eurth",
      step: { kind: "hints", titles: ["Tavok"] },
    });
    expect(step).toMatchObject({ kind: "hints", blocked: true, data: [], stopped: { kind: "blocked", status: 403 } });
    expect(isExternalHostOffline("iiwiki.com")).toBe(false);
  });
});

describe("realms.wiki.chooseMap and recheckMap", () => {
  it("fetches and checks the original, then stores the choice and its credit in the realm's settings", async () => {
    installWiki((url) => (url.searchParams.get("prop") === "imageinfo" ? json(imageinfoFor(pngSha1())) : undefined));
    const db = realmDb({ maxNationsPerUser: 2, wiki: EURTH_WIKI });
    const result = await caller(db, founder).chooseMap({ slug: "eurth", fileTitle: "Eurth_political_map_2024.png" });

    expect(result.map.file).toMatchObject({ width: 64, height: 32, size: png.byteLength, mime: "image/png", chosenBy: "clerk_founder" });
    expect(db.state.settings).toMatchObject({
      maxNationsPerUser: 2,
      wiki: EURTH_WIKI,
      map: {
        source: { wiki: "iiwiki", fileTitle: "File:Eurth political map 2024.png", sha1: pngSha1() },
        attribution: "Eurth political map 2024.png by Cartographer Eurth, CC BY-SA 4.0, via IIWiki",
      },
    });
    // The original came from the wiki's own host, not through an image re-encoding service.
    const download = wiki.calls.find((u) => u.pathname.startsWith("/images/"))!;
    expect(download.href).toBe("https://iiwiki.com/images/3/3a/Eurth_political_map_2024.png");
  });

  it("refuses a download whose SHA-1 differs from the wiki's, storing nothing", async () => {
    const db = realmDb({ wiki: EURTH_WIKI });
    await expect(
      caller(db, founder).chooseMap({ slug: "eurth", fileTitle: "File:Eurth political map 2024.png" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("SHA-1") });
    expect(db.realm.update).not.toHaveBeenCalled();
  });

  it("re-check: unchanged, changed or missing against the wiki's current SHA-1", async () => {
    const recorded = "4f1c6a0e2b6d5c3a9e8f7d6c5b4a39281706f5e4";
    const stored = (fileTitle: string, sha1: string) => ({
      wiki: EURTH_WIKI,
      map: {
        source: { wiki: "iiwiki", fileTitle, sha1 },
        attribution: "x",
        file: { width: 8192, height: 4096, size: 1, mime: "image/png", licence: null, descriptionUrl: null, chosenAt: "2026-10-01T00:00:00.000Z", chosenBy: "clerk_founder", checkedAt: null },
      },
    });

    const same = realmDb(stored("File:Eurth political map 2024.png", recorded));
    expect(await caller(same, founder).recheckMap({ slug: "eurth" })).toMatchObject({ status: "unchanged", changed: false });
    expect((same.state.settings.map as { file: { checkedAt: string | null } }).file.checkedAt).toEqual(expect.any(String));

    const changed = realmDb(stored("File:Eurth political map 2024.png", "b".repeat(40)));
    expect(await caller(changed, founder).recheckMap({ slug: "eurth" })).toMatchObject({
      status: "changed",
      changed: true,
      currentSha1: recorded,
    });
    expect((changed.state.settings.map as { source: { sha1: string } }).source.sha1).toBe("b".repeat(40));

    const gone = realmDb(stored("File:Rostervania locator.png", "c".repeat(40)));
    expect(await caller(gone, admin).recheckMap({ slug: "eurth" })).toMatchObject({ status: "missing", currentSha1: null });
  });

  it("hands the map import the chosen original, and refuses one that changed since it was chosen", async () => {
    installWiki((url) => (url.searchParams.get("prop") === "imageinfo" ? json(imageinfoFor(pngSha1())) : undefined));
    const db = realmDb({ wiki: EURTH_WIKI });
    await caller(db, founder).chooseMap({ slug: "eurth", fileTitle: "File:Eurth political map 2024.png" });

    const original = await fetchChosenWikiMapOriginal(db, "eurth-id");
    expect(original).toMatchObject({ filename: "Eurth political map 2024.png", width: 64, height: 32, sha1: pngSha1() });
    expect(original.buffer.equals(png)).toBe(true);

    installWiki((url) => (url.searchParams.get("prop") === "imageinfo" ? json(imageinfoFor("d".repeat(40))) : undefined));
    await expect(fetchChosenWikiMapOriginal(db, "eurth-id")).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(fetchChosenWikiMapOriginal(realmDb(), "eurth-id")).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("asks for a chosen map before a re-check", async () => {
    await expect(caller(realmDb({ wiki: EURTH_WIKI }), founder).recheckMap({ slug: "eurth" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("infobox hints export (P2.5)", () => {
  const actor = { id: "u_founder", clerkUserId: "clerk_founder" };
  const deps = () => ({
    client: (source: "iiwiki" | "althistory") =>
      createDiscoveryClient(source, { fetchImpl: wiki.fetch, apiUrl: "https://iiwiki.com/api.php", delayMs: 0 }),
  });

  it("gives each roster nation its capital coordinates and a proxied locator map thumbnail, then caches", async () => {
    const db = realmDb({ wiki: EURTH_WIKI });
    const hints = await realmInfoboxHints(db, actor, "eurth", deps());
    const byTitle = Object.fromEntries(hints.nations.map((n) => [n.title, n]));

    expect(hints).toMatchObject({ complete: true, blocked: false, stopped: null });
    expect(byTitle["Aurelian Commonwealth"]).toEqual({
      title: "Aurelian Commonwealth",
      hasInfobox: true,
      capital: "Port Aurel",
      capitalCoordinates: [45.25, 12.5],
      locatorMap: {
        fileTitle: "File:Aurelia (orthographic projection).svg",
        thumbUrl: expect.stringContaining("/api/mediawiki/iiwiki/images/thumb/2/2b/"),
      },
    });
    expect(byTitle.Rostervania!.locatorMap).toEqual({ fileTitle: "File:Rostervania locator.png", thumbUrl: null });
    expect(byTitle["Nanto (Eurth)"]).toMatchObject({ capitalCoordinates: [-120, -10.5], locatorMap: null });

    const asked = wiki.calls.length;
    await realmInfoboxHints(db, actor, "eurth", deps());
    expect(wiki.calls.length).toBe(asked);
  });

  it("returns the nations read so far, uncached, when the wiki refuses part-way", async () => {
    installWiki((_url, index) => (index >= 2 ? new Response("", { status: 403 }) : undefined));
    const db = realmDb({ wiki: EURTH_WIKI });
    const hints = await realmInfoboxHints(db, actor, "eurth", deps());
    expect(hints).toMatchObject({ complete: false, blocked: true, nations: [] });
    expect(await globalCache.get("realm-wiki-hints:eurth-id")).toBeNull();
  });
});
