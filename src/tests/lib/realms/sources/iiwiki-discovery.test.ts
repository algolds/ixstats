/** @jest-environment node */
import {
  discoverMapCandidates,
  discoverNationHints,
  discoverRoster,
  MAX_MAP_CANDIDATES,
  rankMapCandidates,
} from "~/lib/realms/sources/iiwiki-discovery";
import { createDiscoveryClient } from "~/lib/realms/sources/wiki-discovery-client";
import type { WikiFileInfo } from "~/lib/realms/sources/wiki-file-info";
import { EURTH_WIKI, fakeIiwiki, json } from "~/tests/helpers/iiwiki-fixtures";

const API = "https://iiwiki.com/api.php";
const noSleep = jest.fn(async () => undefined);

function client(respond?: Parameters<typeof fakeIiwiki>[0], maxRequests?: number) {
  const wiki = fakeIiwiki(respond);
  return {
    wiki,
    client: createDiscoveryClient("iiwiki", {
      fetchImpl: wiki.fetch,
      apiUrl: API,
      sleep: noSleep,
      maxRequests,
    }),
  };
}

const ALL_NATIONS = [
  "Aurelian Commonwealth",
  "Maps of Eurth",
  "Nanto (Eurth)",
  "Rostervania",
  "Tavok",
];

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
});

describe("map candidates", () => {
  it("drops non-images and tiny files, and caps the list", () => {
    const files = new Map<string, WikiFileInfo>();
    const base = {
      url: "https://iiwiki.com/images/x.png",
      descriptionUrl: null,
      thumbUrl: null,
      size: 1,
      sha1: "a",
      licence: null,
      licenceUrl: null,
      artist: null,
      credit: null,
      attribution: "x",
    };
    for (let i = 0; i < MAX_MAP_CANDIDATES + 5; i++) {
      files.set(`File:M${i}.png`, {
        ...base,
        fileTitle: `File:M${i}.png`,
        width: 1000 + i,
        height: 500,
        mime: "image/png",
      });
    }
    files.set("File:Doc.pdf", {
      ...base,
      fileTitle: "File:Doc.pdf",
      width: 4000,
      height: 2000,
      mime: "application/pdf",
    });
    files.set("File:Tiny.png", {
      ...base,
      fileTitle: "File:Tiny.png",
      width: 120,
      height: 60,
      mime: "image/png",
    });

    const ranked = rankMapCandidates(files, new Map());
    expect(ranked).toHaveLength(MAX_MAP_CANDIDATES);
    expect(ranked.map((m) => m.fileTitle)).not.toContain("File:Doc.pdf");
    expect(ranked.map((m) => m.fileTitle)).not.toContain("File:Tiny.png");
  });
});

describe("a discovery step's blocked and partial results", () => {
  it("treats a Cloudflare challenge page as blocked", async () => {
    const challenge = new Response(
      "<html><title>Just a moment...</title><script src=/cdn-cgi/challenge-platform/x></script></html>",
      {
        status: 200,
        headers: { "content-type": "text/html" },
      }
    );
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
    const { client: c } = client(() =>
      json({ error: { code: "badvalue", info: 'Unrecognized value for parameter "list"' } })
    );
    const step = await discoverRoster(c, EURTH_WIKI);
    expect(step.stopped).toMatchObject({
      kind: "error",
      message: expect.stringContaining("Unrecognized value"),
    });
  });
});
