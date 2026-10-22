/**
 * Heraldry on a corpus of coats of arms: the blazon each is read as, the rule-of-tincture and scale warnings the
 * editor shows, the random designer's output, which must always be a composition the schema stores and the
 * rule of tincture allows, and the rendered shield, from which a hostile custom charge's scripts, handlers, images
 * and external references are stripped (XSS) while the drawing stays well-formed.
 *
 * Folds: src/tests/lib/heraldry/shield-scene.test.tsx
 */
import { generateBlazon } from "~/lib/heraldry/blazon";
import { compositionSchema } from "~/lib/heraldry/composition-schema";
import { generateRandomComposition } from "~/lib/heraldry/generator";
import type { HeraldryComposition } from "~/lib/heraldry/types";
import { validateComposition } from "~/lib/heraldry/validation";
import { buildShieldScene, serializeShieldSvg } from "~/lib/heraldry/shield-scene";
import "~/components/maps/vexel/renderer/ShieldRenderer";

type Shield = HeraldryComposition["shield"];
const arms = (
  field: Partial<Shield["field"]>,
  rest: Partial<Shield> = {},
  externals?: HeraldryComposition["externals"]
) =>
  ({
    shield: {
      shape: "heater",
      field: { division: "plain", tinctures: ["azure"], lineStyle: "straight", ...field },
      ordinaries: [],
      charges: [],
      ...rest,
    },
    ...(externals && { externals }),
  }) as HeraldryComposition;
const lion = (tincture: string, size = 1, count = 1) => ({
  chargeId: "lion",
  position: "fess-point",
  count,
  tincture,
  size,
});

describe("coats of arms", () => {
  it.each([
    ["a plain field", arms({}), "Azure"],
    [
      "a field per pale",
      arms({ division: "per-pale", tinctures: ["gules", "or"] }),
      "Per pale Gules and Or",
    ],
    [
      "quarterly",
      arms({ division: "quarterly", tinctures: ["azure", "or", "or", "azure"] }),
      "Quarterly, first and fourth Azure, second and third Or",
    ],
    [
      "a fess and a lion",
      arms(
        {},
        {
          ordinaries: [{ type: "fess", tincture: "or", lineStyle: "straight" }],
          charges: [{ ...lion("argent"), attitude: "rampant" }] as never,
        }
      ),
      "Azure, a fess Or; a lion rampant Argent",
    ],
    [
      "three eagles",
      arms(
        {},
        { charges: [{ ...lion("or", 0.5, 3), chargeId: "eagle", attitude: "displayed" }] as never }
      ),
      "Azure; three eagles displayed Or",
    ],
    [
      "a motto",
      arms({}, {}, { motto: { text: "In Hoc Signo Vinces", position: "below" } } as never),
      'Azure; Motto: "In Hoc Signo Vinces" upon a scroll below',
    ],
  ])("blazons %s", (_name, composition, blazon) => {
    expect(generateBlazon(composition)).toBe(blazon);
  });

  it.each([
    ["Or on Azure", arms({}, { charges: [lion("or")] as never }), []],
    ["ermine, a fur, on Azure", arms({}, { charges: [lion("ermine")] as never }), []],
    [
      "metal on metal (Or on Argent)",
      arms({ tinctures: ["argent"] }, { charges: [lion("or")] as never }),
      ["rule-of-tincture"],
    ],
    [
      "a division with no tinctures",
      arms({ division: "per-pale", tinctures: [] }),
      ["empty-division"],
    ],
    [
      "a lion too small to see",
      arms({}, { charges: [lion("or", 0.05)] as never }),
      ["scale-too-small"],
    ],
  ])("warns of %s as it should", (_name, composition, codes) => {
    expect(validateComposition(composition).map((w) => w.code)).toEqual(codes);
  });

  it("designs only arms the schema stores and the rule of tincture allows, biased by government and culture", () => {
    for (let i = 0; i < 20; i++) {
      const composition = generateRandomComposition();
      expect(compositionSchema.safeParse(composition).success).toBe(true);
      expect(validateComposition(composition).filter((w) => w.severity === "caution")).toEqual([]);
    }
    expect(generateRandomComposition({ governmentType: "republic" }).shield.shape).toBe("round");
    const germanic = Array.from({ length: 20 }, () =>
      generateRandomComposition({ cultureGroup: "germanic" })
    );
    expect(germanic.some((c) => c.shield.charges?.[0]?.chargeId === "eagle")).toBe(true);
  });

  it("renders a hostile custom charge into a well-formed shield, without its scripts, handlers, images or external references", () => {
    const customId = "6f1c2a52-6a8e-4b8e-9d55-0c1f7c1d2a11";
    const hostileCharge =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" onload="alert(1)">' +
      '<script>alert(1)</script><circle cx="5" cy="5" r="4"/>' +
      '<image href="https://tracker.example/x.png"/>' +
      '<linearGradient id="g" href="https://evil.example/s.svg#a"/></svg>';
    const svg = serializeShieldSvg(
      buildShieldScene(
        arms(
          { division: "per-pale", tinctures: ["azure", "or"] },
          {
            ordinaries: [{ type: "chief", tincture: "gules", lineStyle: "straight" }],
            charges: [lion("or"), { ...lion("argent"), chargeId: customId }] as never,
          }
        ),
        { [customId]: hostileCharge }
      )
    );

    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
    expect(svg).toContain("<circle");
    expect(svg).toMatch(/<lineargradient id="g"/i); // kept, minus its external href
    expect(svg).not.toMatch(/<script|onload|alert|<image|tracker\.example|evil\.example/i);
  });
});
