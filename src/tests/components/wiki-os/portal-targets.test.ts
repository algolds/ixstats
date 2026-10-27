/** @jest-environment jsdom */
/**
 * C4b (plan 2026-10-25 sister wikis, Task 13, carried from the Task 11 review): the nodes of the live article the
 * reader mounts widgets on. Coords default to the label "Location" and zoom 4, a map embed keeps its options, a stat
 * its key, and the targets come coords, then maps, then stats, then sister boxes. A sister box inside another box, and
 * any placeholder inside a live embed, is that embed's content and mounts nothing. Another wiki's page mounts nothing.
 */
import { readPortalTargets } from "~/components/wiki-os/reader/placeholder-dom";

function articleOf(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container;
}

const sisterBox = (title: string, inner = "") =>
  `<div class="sister-link" data-sister-wiki="iiwiki" data-sister-title="${title}" data-sister-mode="page">${inner}</div>`;

describe("readPortalTargets", () => {
  it("reads a coordinate placeholder with the label Location and zoom 4 when it names neither", () => {
    const [target] = readPortalTargets(
      articleOf('<span class="wikios-coords-placeholder" data-lat="12.5" data-lng="-3.25"></span>'),
      "ixwiki"
    );
    expect(target).toMatchObject({
      type: "coords",
      data: { lat: 12.5, lng: -3.25, zoom: 4, label: "Location" },
    });
  });

  it("reads a coordinate placeholder's own label and zoom", () => {
    const [target] = readPortalTargets(
      articleOf(
        '<span class="wikios-coords-placeholder" data-lat="1" data-lng="2" data-zoom="7" data-label="Harbour"></span>'
      ),
      "ixwiki"
    );
    expect(target?.data).toEqual({ lat: 1, lng: 2, zoom: 7, label: "Harbour" });
  });

  it("reads a map embed's options, and none as an empty string", () => {
    const targets = readPortalTargets(
      articleOf(
        '<div class="wikios-map-embed-placeholder" data-lat="4" data-lng="5" data-zoom="6" data-options="layer=terrain"></div>' +
          '<div class="wikios-map-embed-placeholder" data-lat="0" data-lng="0"></div>'
      ),
      "ixwiki"
    );
    expect(targets.map((target) => target.data)).toEqual([
      { lat: 4, lng: 5, zoom: 6, options: "layer=terrain" },
      { lat: 0, lng: 0, zoom: 4, options: "" },
    ]);
  });

  it("reads a stat placeholder's key, and none as an empty string", () => {
    const targets = readPortalTargets(
      articleOf(
        '<span class="wikios-stat-placeholder" data-key="CountryData:Caphiria:gdp"></span>' +
          '<span class="wikios-stat-placeholder"></span>'
      ),
      "ixwiki"
    );
    expect(targets).toMatchObject([
      { type: "stat", data: { key: "CountryData:Caphiria:gdp" } },
      { type: "stat", data: { key: "" } },
    ]);
  });

  it("orders coords, then maps, then stats, then sister boxes, whatever the page order", () => {
    const targets = readPortalTargets(
      articleOf(
        sisterBox("Caphiria") +
          '<span class="wikios-stat-placeholder" data-key="MyCountry:gdp"></span>' +
          '<div class="wikios-map-embed-placeholder" data-lat="1" data-lng="1"></div>' +
          '<span class="wikios-coords-placeholder" data-lat="2" data-lng="2"></span>'
      ),
      "ixwiki"
    );
    expect(targets.map((target) => target.type)).toEqual(["coords", "map-embed", "stat", "sister"]);
  });

  it("mounts nothing on another wiki's page", () => {
    const article = articleOf(
      '<span class="wikios-coords-placeholder" data-lat="2" data-lng="2"></span>' +
        sisterBox("Caphiria")
    );
    expect(readPortalTargets(article, "iiwiki")).toEqual([]);
    expect(readPortalTargets(article, "althistory")).toEqual([]);
  });

  it("skips a sister box nested inside another box", () => {
    const targets = readPortalTargets(articleOf(sisterBox("Outer", sisterBox("Inner"))), "ixwiki");
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ type: "sister", data: { title: "Outer" } });
  });

  it("skips every placeholder and sister box inside a live embed", () => {
    const embedded =
      '<span class="wikios-coords-placeholder" data-lat="2" data-lng="2"></span>' +
      '<div class="wikios-map-embed-placeholder" data-lat="1" data-lng="1"></div>' +
      '<span class="wikios-stat-placeholder" data-key="MyCountry:gdp"></span>' +
      sisterBox("Inside");
    const targets = readPortalTargets(
      articleOf(`<div class="wikios-sister-embed">${embedded}</div>` + sisterBox("Outside")),
      "ixwiki"
    );
    expect(targets).toHaveLength(1);
    expect(targets[0]).toMatchObject({ type: "sister", data: { title: "Outside" } });
  });
});
