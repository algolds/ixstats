import { describe, it, expect } from "@jest/globals";
import { validateComposition } from "~/lib/heraldry/validation";
import type { HeraldryComposition } from "~/lib/heraldry/types";

describe("validateComposition", () => {
  it("returns empty warnings array for a valid composition", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "or",
            size: 1.0,
          },
        ],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings).toEqual([]);
  });

  it("flags metal-on-metal (Or charge on Argent field)", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["argent"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "or",
            size: 1.0,
          },
        ],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.code).toBe("rule-of-tincture");
    expect(warnings[0]?.severity).toBe("advisory");
  });

  it("flags colour-on-colour (Gules charge on Azure field)", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "gules",
            size: 1.0,
          },
        ],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.code).toBe("rule-of-tincture");
  });

  it("does not flag rule of tincture for furs (ermine)", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "ermine",
            size: 1.0,
          },
        ],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings).toEqual([]);
  });

  it("flags empty division tinctures", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "per-pale",
          tinctures: [],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.code).toBe("empty-division");
  });

  it("flags scale warnings for too small size (< 0.1)", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "or",
            size: 0.05,
          },
        ],
      },
    };
    const warnings = validateComposition(comp);
    expect(warnings.length).toBe(1);
    expect(warnings[0]?.code).toBe("scale-too-small");
  });
});
