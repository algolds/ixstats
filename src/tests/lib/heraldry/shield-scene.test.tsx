import { renderToStaticMarkup } from "react-dom/server";
import type { HeraldryComposition } from "~/lib/heraldry";
import {
  buildShieldScene,
  innerSvgMarkup,
  serializeShieldSvg,
  SHIELD_IMAGE_VIEWBOX,
} from "~/lib/heraldry/shield-scene";
import ShieldRenderer from "~/components/maps/vexel/renderer/ShieldRenderer";

const CUSTOM_ID = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";

const composition: HeraldryComposition = {
  shield: {
    shape: "heater",
    field: { division: "per-pale", tinctures: ["azure", "or"], lineStyle: "straight" },
    ordinaries: [{ type: "chief", tincture: "gules", lineStyle: "straight" }],
    charges: [
      { chargeId: "lion", position: "fess-point", count: 1, tincture: "or", size: 1 },
      { chargeId: CUSTOM_ID, position: "fess-point", count: 1, tincture: "argent", size: 1 },
    ],
  },
};

const hostileCharge =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">' +
  '<script>alert(1)</script><circle cx="5" cy="5" r="4"/>' +
  '<image href="https://tracker.example/x.png"/>' +
  '<linearGradient id="g" href="https://evil.example/s.svg#a"/></svg>';

describe("innerSvgMarkup", () => {
  it("keeps the drawing and drops scripts, handlers, images and external references", () => {
    const inner = innerSvgMarkup(hostileCharge);
    expect(inner).toContain("<circle");
    expect(inner).toMatch(/<lineargradient id="g"/i); // kept, minus its external href
    expect(inner).not.toMatch(/<svg|<\/svg>|script|onload|<image|tracker\.example|evil\.example/i);
  });
});

describe("serializeShieldSvg", () => {
  const scene = buildShieldScene(composition, { [CUSTOM_ID]: hostileCharge });

  it("produces a standalone SVG document at the requested size and framing", () => {
    const svg = serializeShieldSvg(scene, { viewBox: SHIELD_IMAGE_VIEWBOX, size: 256 });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain(`viewBox="${SHIELD_IMAGE_VIEWBOX}" width="256" height="256"`);
    expect(svg.endsWith("</svg>")).toBe(true);
    // The custom charge is inlined, sanitized, with no external reference left.
    expect(svg).toContain("<circle");
    expect(svg).not.toMatch(/script|onload|https?:\/\/(?!www\.w3\.org)/i);
  });

  it("is well-formed XML", () => {
    const svg = serializeShieldSvg(scene);
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
  });

  it("draws the same shapes as the editor's ShieldRenderer", () => {
    const pathsOf = (markup: string) =>
      [...markup.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).sort();
    const editor = renderToStaticMarkup(
      <ShieldRenderer composition={composition} customChargeSvgs={{ [CUSTOM_ID]: hostileCharge }} />
    );
    expect(pathsOf(serializeShieldSvg(scene))).toEqual(pathsOf(editor));
  });
});
