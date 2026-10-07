/** @jest-environment node */
import { withBasePath } from "~/lib/base-path";
import {
  discoverMapCandidates,
  discoverNationHints,
  discoverRoster,
  infoboxFileName,
  mapCandidateScore,
  mapCategoryNames,
  MAX_MAP_CANDIDATES,
  nationHintFromWikitext,
  rankMapCandidates,
  runDiscovery,
} from "~/lib/realms/sources/iiwiki-discovery";
import { createDiscoveryClient } from "~/lib/realms/sources/wiki-discovery-client";
import type { WikiFileInfo } from "~/lib/realms/sources/wiki-file-info";
import { isExternalHostOffline } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { EURTH_WIKI, fakeIiwiki, json } from "~/tests/helpers/iiwiki-fixtures";

const API = "https://iiwiki.com/api.php";
const noSleep = jest.fn(async () => undefined);

function client(respond?: Parameters<typeof fakeIiwiki>[0], maxRequests?: number) {
  const wiki = fakeIiwiki(respond);
  return {
    wiki,
    client: createDiscoveryClient("iiwiki", { fetchImpl: wiki.fetch, apiUrl: API, sleep: noSleep, maxRequests }),
  };
}

const ALL_NATIONS = ["Aurelian Commonwealth", "Maps of Eurth", "Nanto (Eurth)", "Rostervania", "Tavok"];

describe("roster discovery (lore-import's roster rule)", () => {
  it("lists one nation per subcategory or page, following continuation, and flags suspect entries", async () => {
    const { client: c, wiki } = client();
    const step = await discoverRoster(c, EURTH_WIKI);

    expect(step.data).toEqual({
      method: "roster",
      category: "Category:Countries (Eurth)",
      nations: ALL_NATIONS,
      suspects: ["Maps of Eurth"],
      truncated: false,
    });
    expect(step.stopped).toBeNull();
    expect(wiki.calls).toHaveLength(2);
    expect(wiki.calls[1]!.searchParams.get("cmcontinue")).toBe("page|524f53544552|1204");
    expect(wiki.calls[0]!.searchParams.get("formatversion")).toBe("2");
  });
});

describe("nation infobox hints", () => {
  it("reads flags, arms, capitals, {{coord}} coordinates and map files; follows redirects; marks missing pages", async () => {
    const { client: c } = client();
    const step = await discoverNationHints(c, ALL_NATIONS);
    const byTitle = Object.fromEntries(step.data.map((hint) => [hint.title, hint]));

    expect(byTitle["Aurelian Commonwealth"]).toEqual({
      title: "Aurelian Commonwealth",
      missing: false,
      hasInfobox: true,
      flag: "Flag of Aurelia.svg",
      coatOfArms: "Coat of arms of Aurelia.png",
      capital: "Port Aurel",
      capitalCoordinates: [45.25, 12.5],
      mapFiles: ["Aurelia (orthographic projection).svg"],
    });
    // Split latd/longd fields; a File: link with options; an underscore name; a locator left as a comment.
    expect(byTitle["Nanto (Eurth)"]).toMatchObject({
      flag: "Nanto flag.png",
      coatOfArms: "Nanto arms.svg",
      capital: "Kessu",
      capitalCoordinates: [-120, -10.5],
      mapFiles: [],
    });
    // Asked as "Rostervania", read through its redirect.
    expect(byTitle.Rostervania).toMatchObject({
      hasInfobox: true,
      flag: "Rostervania flag.png",
      capitalCoordinates: [151.2, -33.5],
      mapFiles: ["Rostervania locator.png", "Rostervania regions.png"],
    });
    expect(byTitle.Tavok).toMatchObject({ missing: false, hasInfobox: false, flag: null });
    expect(byTitle["Maps of Eurth"]).toMatchObject({ missing: true, hasInfobox: false });
  });

  it("parses image values the way infoboxes write them", () => {
    expect(infoboxFileName("[[File:Flag_of_X.svg|120px|border]]")).toBe("Flag of X.svg");
    expect(infoboxFileName("Image:arms.PNG")).toBe("Arms.PNG");
    expect(infoboxFileName("{{Flagicon|X}}")).toBeNull();
    expect(infoboxFileName("https://evil.example/x.png")).toBeNull();
    expect(infoboxFileName("Not a file")).toBeNull();
    expect(nationHintFromWikitext("X", "No infobox here.")).toMatchObject({ hasInfobox: false, missing: false });
  });
});

describe("map candidates", () => {
  it("searches the usual and the root's map categories, the portal's images and its page image, best first", async () => {
    const { client: c, wiki } = client();
    const step = await discoverMapCandidates(c, EURTH_WIKI, new Set(["Flag of Aurelia.svg"]));
    const titles = step.data.candidates.map((m) => m.fileTitle);

    expect(step.data.categories).toEqual([
      "Category:Maps of Eurth",
      "Category:Eurth maps",
      "Category:Maps (Eurth)",
    ]);
    expect(titles).toEqual([
      "File:Eurth political map 2024.png",
      "File:Eurth world map.svg",
      "File:Eurth physical.jpg",
      "File:Eurth square sketch.png",
    ]);
    // The flag (excluded), the locator and the banner are never candidates.
    expect(titles.some((t) => /Flag|locator|banner/.test(t))).toBe(false);
    const top = step.data.candidates[0]!;
    expect(top).toMatchObject({
      url: "https://iiwiki.com/images/3/3a/Eurth_political_map_2024.png",
      width: 8192,
      height: 4096,
      size: 9876543,
      mime: "image/png",
      sha1: "4f1c6a0e2b6d5c3a9e8f7d6c5b4a39281706f5e4",
      licence: "CC BY-SA 4.0",
      artist: "Cartographer Eurth",
      descriptionUrl: "https://iiwiki.com/wiki/File:Eurth_political_map_2024.png",
      foundIn: ["Category:Eurth maps", "portal images"],
    });
    expect(top.thumbUrl).toBe(
      withBasePath("/api/mediawiki/iiwiki/images/thumb/3/3a/Eurth_political_map_2024.png/320px-Eurth_political_map_2024.png")
    );
    expect(step.data.candidates[1]!.foundIn).toEqual(["portal images", "portal page image"]);
    const imageinfo = wiki.calls.find((u) => u.searchParams.get("prop") === "imageinfo")!;
    expect(imageinfo.searchParams.get("iiprop")).toBe("url|size|mime|sha1|extmetadata");
  });

  it("ranks large, about 2:1, PNG or SVG maps first", () => {
    const file = (fileTitle: string, width: number, height: number, mime = "image/png") => ({ fileTitle, width, height, mime });
    const wide = mapCandidateScore(file("File:A.png", 8000, 4000), []);
    expect(wide).toBeGreaterThan(mapCandidateScore(file("File:A.png", 2000, 1000), []));
    expect(wide).toBeGreaterThan(mapCandidateScore(file("File:A.png", 8000, 8000), []));
    expect(wide).toBeGreaterThan(mapCandidateScore(file("File:A.jpg", 8000, 4000, "image/jpeg"), []));
    expect(mapCandidateScore(file("File:A.png", 8000, 4000), ["Category:Eurth maps"])).toBeGreaterThan(wide);
  });

  it("drops non-images and tiny files, and caps the list", () => {
    const files = new Map<string, WikiFileInfo>();
    const base = { url: "https://iiwiki.com/images/x.png", descriptionUrl: null, thumbUrl: null, size: 1, sha1: "a", licence: null, licenceUrl: null, artist: null, credit: null, attribution: "x" };
    for (let i = 0; i < MAX_MAP_CANDIDATES + 5; i++) {
      files.set(`File:M${i}.png`, { ...base, fileTitle: `File:M${i}.png`, width: 1000 + i, height: 500, mime: "image/png" });
    }
    files.set("File:Doc.pdf", { ...base, fileTitle: "File:Doc.pdf", width: 4000, height: 2000, mime: "application/pdf" });
    files.set("File:Tiny.png", { ...base, fileTitle: "File:Tiny.png", width: 120, height: 60, mime: "image/png" });

    const ranked = rankMapCandidates(files, new Map());
    expect(ranked).toHaveLength(MAX_MAP_CANDIDATES);
    expect(ranked.map((m) => m.fileTitle)).not.toContain("File:Doc.pdf");
    expect(ranked.map((m) => m.fileTitle)).not.toContain("File:Tiny.png");
  });

  it("adds the realm's own map categories first", () => {
    expect(
      mapCategoryNames({ ...EURTH_WIKI, mapCategories: ["Category:Atlas of Eurth"] }, ["Category:Old maps (Eurth)"])
    ).toEqual([
      "Category:Atlas of Eurth",
      "Category:Maps of Eurth",
      "Category:Eurth maps",
      "Category:Maps (Eurth)",
      "Category:Old maps (Eurth)",
    ]);
  });
});

describe("runDiscovery: blocked and partial results", () => {
  it("runs every phase on the recorded wiki", async () => {
    const { client: c } = client();
    const report = await runDiscovery(c, EURTH_WIKI);

    expect(report.blocked).toBe(false);
    expect(report.stopped).toBeNull();
    expect(report.roster.nations).toHaveLength(5);
    expect(report.nations).toHaveLength(5);
    expect(report.maps.candidates[0]!.fileTitle).toBe("File:Eurth political map 2024.png");
    // The nations' locator maps are not offered as world maps.
    expect(report.maps.candidates.map((m) => m.fileTitle)).not.toContain("File:Aurelia (orthographic projection).svg");
  });

  it("returns what it gathered with `blocked` when the wiki answers 403, and stops asking", async () => {
    // Requests 0 and 1 read the roster; request 2 (the nation pages) is refused.
    const { client: c, wiki } = client((_url, index) => (index >= 2 ? new Response("Forbidden", { status: 403 }) : undefined));
    const report = await runDiscovery(c, EURTH_WIKI);

    expect(report.blocked).toBe(true);
    expect(report.stopped).toMatchObject({ kind: "blocked", status: 403, phase: "hints" });
    expect(report.roster.nations).toHaveLength(5);
    expect(report.nations).toEqual([]);
    expect(report.maps.candidates).toEqual([]);
    expect(wiki.calls).toHaveLength(3);
    // A refused discovery never takes the wiki offline for the rest of the app.
    expect(isExternalHostOffline("iiwiki.com")).toBe(false);
  });

  it("treats a Cloudflare challenge page as blocked", async () => {
    const challenge = new Response("<html><title>Just a moment...</title><script src=/cdn-cgi/challenge-platform/x></script></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
    const { client: c } = client((_url, index) => (index === 0 ? challenge : undefined));
    const step = await discoverRoster(c, EURTH_WIKI);

    expect(step.stopped).toMatchObject({ kind: "blocked", phase: "roster" });
    expect(step.data.nations).toEqual([]);
  });

  it("keeps the map files it read when the cap stops it before imageinfo", async () => {
    // Subcategories + 3 categories + portal = 5 requests; imageinfo would be the sixth.
    const { client: c } = client(undefined, 5);
    const step = await discoverMapCandidates(c, EURTH_WIKI);

    expect(step.stopped).toMatchObject({ kind: "cap", phase: "maps" });
    expect(step.data.candidates).toEqual([]);
    expect(step.data.unread).toBeGreaterThan(0);
  });

  it("an API error object stops the step with the wiki's message", async () => {
    const { client: c } = client(() => json({ error: { code: "badvalue", info: "Unrecognized value for parameter \"list\"" } }));
    const step = await discoverRoster(c, EURTH_WIKI);
    expect(step.stopped).toMatchObject({ kind: "error", message: expect.stringContaining("Unrecognized value") });
  });
});
