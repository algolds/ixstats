import { coverView, heroNationHref, heroNationStatus } from "~/lib/realms/hero-map";

describe("coverView", () => {
  it("centres on the bounds and takes the zoom that covers the box", () => {
    const view = coverView([-90, -10, 90, 10], 1024, 256, 0);
    expect(view.center[0]).toBeCloseTo(0);
    expect(view.center[1]).toBeCloseTo(0);
    // Width alone needs zoom 2 (180 degrees across 1024px); the thin band needs more, so the sides crop.
    expect(view.zoom).toBeGreaterThan(2);
    expect(view.zoom).toBeCloseTo(Math.log2(256 / ((512 * 2 * 0.17543) / (2 * Math.PI))), 2);
  });

  it("centres latitude in Mercator, not halfway between the degrees", () => {
    const { center } = coverView([0, 0, 10, 60], 400, 400, 0);
    expect(center[1]).toBeGreaterThan(30);
  });

  it("never zooms below the whole world", () => {
    expect(coverView([-180, -75, 180, 75], 100, 50).zoom).toBe(0);
  });
});

describe("heroNationHref", () => {
  it("sends an open nation to the realm's Nations tab, filtered to it", () => {
    expect(
      heroNationHref({ id: "c1", slug: "aurelia", name: "New Aurelia", status: "open" }, "ixnay")
    ).toBe("/r/ixnay/nations?nation=New%20Aurelia");
  });

  it("sends a claimed or locked country to its page", () => {
    expect(
      heroNationHref({ id: "c2", slug: "caphiria", name: "Caphiria", status: "claimed" }, "ixnay")
    ).toBe("/countries/caphiria");
    expect(heroNationHref({ id: "c3", slug: null, name: "Npc", status: "other" }, "ixnay")).toBe(
      "/countries/c3"
    );
  });

  it("leads nowhere for a region with no country", () => {
    expect(heroNationHref({ id: null, slug: null, name: "Wilds", status: "other" }, "ixnay")).toBe(
      null
    );
  });
});

it("words each status for the hover card", () => {
  expect(heroNationStatus("claimed")).toBe("Claimed by a player");
  expect(heroNationStatus("open")).toBe("Open to claim");
  expect(heroNationStatus("other")).toBe("Not open to players");
});
