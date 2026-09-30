/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import {
  DIRECTIVE_EXECUTION_WINDOW_MS,
  directiveTimeline,
  ledgerToEffect,
  consequenceToEffect,
  gdpShiftToEffect,
  formatGdpShift,
  parseChangeLines,
  suggestedDomain,
  categoryLabel,
} from "~/components/mycountry/directives/directive-model";
import {
  DIRECTIVE_DOMAINS,
  DIRECTIVE_PRESETS,
  filterPresets,
} from "~/components/mycountry/shared/primitives/composer/directive-presets";
import { assemblePackages } from "~/lib/intent/assemble";
import { DIRECTIVE_CIVCAP_WINDOW_MS } from "~/lib/government/civcap";

describe("directiveTimeline", () => {
  const created = 1_000_000;

  it("mirrors the server's CivCap execution window", () => {
    expect(DIRECTIVE_EXECUTION_WINDOW_MS).toBe(DIRECTIVE_CIVCAP_WINDOW_MS);
  });

  it("holds CivCap while an active directive is inside its execution week", () => {
    const t = directiveTimeline(
      { status: "active", createdIxTime: created, civCapCost: 12 },
      created + DIRECTIVE_EXECUTION_WINDOW_MS / 2
    );
    expect(t.phase).toBe("executing");
    expect(t.heldCivCap).toBe(12);
    expect(t.executionProgress).toBeCloseTo(0.5);
    expect(t.releasesAt).toBe(created + DIRECTIVE_EXECUTION_WINDOW_MS);
  });

  it("is in force (CivCap released) after the week, until completed", () => {
    const t = directiveTimeline(
      { status: "active", createdIxTime: created, civCapCost: 12 },
      created + DIRECTIVE_EXECUTION_WINDOW_MS + 1
    );
    expect(t).toMatchObject({ phase: "in_force", heldCivCap: 0, releasesAt: null });
  });

  it("maps closed statuses and treats legacy rows without a cost as holding nothing", () => {
    const now = created + 10;
    expect(
      directiveTimeline({ status: "completed", createdIxTime: created, civCapCost: 5 }, now).phase
    ).toBe("completed");
    expect(
      directiveTimeline({ status: "abandoned", createdIxTime: created, civCapCost: 5 }, now).phase
    ).toBe("abandoned");
    expect(
      directiveTimeline({ status: "proposed", createdIxTime: created, civCapCost: null }, now).phase
    ).toBe("draft");
    expect(
      directiveTimeline({ status: "active", createdIxTime: created, civCapCost: null }, now)
        .heldCivCap
    ).toBe(0);
  });
});

describe("effect rows", () => {
  it("judges favourability by field (falling unemployment is good)", () => {
    const row = ledgerToEffect({
      id: "a",
      targetField: "unemploymentRate",
      deltaValue: -0.3,
      previousValue: 6.5,
      newValue: 6.2,
    });
    expect(row).toMatchObject({
      label: "Unemployment",
      value: "−0.3",
      direction: "down",
      favorable: true,
      caption: "6.5 → 6.2",
    });
  });

  it("formats projected consequences and the GDP level shift", () => {
    expect(
      consequenceToEffect({ targetField: "publicApproval", operation: "subtract", value: 1.5 }, "k")
    ).toMatchObject({ label: "Public Approval", value: "−1.5", favorable: false });
    expect(formatGdpShift(0.000583)).toBe("+0.058%");
    expect(gdpShiftToEffect(0.000583, 1).caption).toContain("1 IxTime year,");
  });

  it("parses stored change lines defensively", () => {
    expect(
      parseChangeLines('[{"kind":"budget","label":"Defense budget +1 notch","detail":"x"}]')
    ).toHaveLength(1);
    expect(parseChangeLines("not json")).toEqual([]);
    expect(parseChangeLines(null)).toEqual([]);
  });

  it("labels engine categories in plain English", () => {
    expect(categoryLabel("security")).toBe("Public order");
    expect(categoryLabel("foreign")).toBe("Foreign");
  });
});

describe("directive presets", () => {
  it("covers every domain and never trips the domestic-only guard", () => {
    for (const d of DIRECTIVE_DOMAINS) {
      expect(DIRECTIVE_PRESETS.some((p) => p.domain === d)).toBe(true);
    }
    for (const p of DIRECTIVE_PRESETS) {
      expect(() => assemblePackages(p.label)).not.toThrow();
    }
  });

  it("has unique labels and filters by domain and text", () => {
    const labels = DIRECTIVE_PRESETS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(filterPresets("Defense", "").every((p) => p.domain === "Defense")).toBe(true);
    expect(filterPresets("All", "rail").map((p) => p.label)).toContain(
      "Construct a high-speed rail corridor"
    );
    expect(filterPresets("All", "zzzz")).toEqual([]);
  });

  it("suggests the domain answering the weakest signal", () => {
    expect(suggestedDomain({ crimeRate: 70 })).toBe("Security");
    expect(suggestedDomain({ militaryReadiness: 40 })).toBe("Defense");
    expect(suggestedDomain({ publicApproval: 30 })).toBe("Social");
    expect(suggestedDomain({ crimeRate: 10, publicApproval: 70 })).toBeNull();
  });
});
