import { describe, it, expect } from "@jest/globals";
import { generateBlazon } from "../blazon";
import type { HeraldryComposition } from "../types";

describe("generateBlazon", () => {
  it("generates blazon for plain field with single tincture", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [],
      },
    };
    expect(generateBlazon(comp)).toBe("Azure");
  });

  it("generates blazon for per pale division", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "per-pale",
          tinctures: ["gules", "or"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [],
      },
    };
    expect(generateBlazon(comp)).toBe("Per pale Gules and Or");
  });

  it("generates blazon for field + ordinary", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [
          {
            type: "fess",
            tincture: "or",
            lineStyle: "straight",
          },
        ],
        charges: [],
      },
    };
    expect(generateBlazon(comp)).toBe("Azure, a fess Or");
  });

  it("generates blazon for field + ordinary + charge", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [
          {
            type: "fess",
            tincture: "or",
            lineStyle: "straight",
          },
        ],
        charges: [
          {
            chargeId: "lion",
            position: "fess-point",
            count: 1,
            tincture: "argent",
            attitude: "rampant",
            size: 1.0,
          },
        ],
      },
    };
    expect(generateBlazon(comp)).toBe("Azure, a fess Or; a lion rampant Argent");
  });

  it("generates blazon for quarterly division", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "quarterly",
          tinctures: ["azure", "or", "or", "azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [],
      },
    };
    expect(generateBlazon(comp)).toBe("Quarterly, first and fourth Azure, second and third Or");
  });

  it("handles pluralization for multiple charges", () => {
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
            chargeId: "eagle",
            position: "in-pale",
            count: 3,
            tincture: "or",
            attitude: "displayed",
            size: 0.5,
          },
        ],
      },
    };
    expect(generateBlazon(comp)).toBe("Azure; three eagles displayed Or");
  });

  it("includes motto", () => {
    const comp: HeraldryComposition = {
      shield: {
        shape: "heater",
        field: {
          division: "plain",
          tinctures: ["azure"],
          lineStyle: "straight",
        },
        ordinaries: [],
        charges: [],
      },
      externals: {
        motto: {
          text: "In Hoc Signo Vinces",
          position: "below",
        },
      },
    };
    expect(generateBlazon(comp)).toBe('Azure; Motto: "In Hoc Signo Vinces" upon a scroll below');
  });
});
