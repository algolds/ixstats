/** @jest-environment node */
import { describe, it, expect } from "@jest/globals";
import {
  DIRECTIVE_EXECUTION_WINDOW_MS,
  directiveTimeline,
  parseChangeLines
} from "~/components/mycountry/directives/directive-model";
import {
  DIRECTIVE_DOMAINS,
  DIRECTIVE_PRESETS
} from "~/components/mycountry/shared/primitives/composer/directive-presets";
import { assemblePackages } from "~/lib/intent/assemble";
import { DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS } from "~/lib/government/exec-bandwidth";

describe("directiveTimeline", () => {
  const created = 1_000_000;

  it("mirrors the server's executive bandwidth execution window", () => {
    expect(DIRECTIVE_EXECUTION_WINDOW_MS).toBe(DIRECTIVE_EXEC_BANDWIDTH_WINDOW_MS);
  });

  it("holds executive bandwidth while an active directive is inside its execution week", () => {
    const t = directiveTimeline(
      { status: "active", createdIxTime: created, execBandwidthCost: 12 },
      created + DIRECTIVE_EXECUTION_WINDOW_MS / 2
    );
    expect(t.phase).toBe("executing");
    expect(t.heldExecBandwidth).toBe(12);
    expect(t.executionProgress).toBeCloseTo(0.5);
    expect(t.releasesAt).toBe(created + DIRECTIVE_EXECUTION_WINDOW_MS);
  });

  it("is in force (executive bandwidth released) after the week, until completed", () => {
    const t = directiveTimeline(
      { status: "active", createdIxTime: created, execBandwidthCost: 12 },
      created + DIRECTIVE_EXECUTION_WINDOW_MS + 1
    );
    expect(t).toMatchObject({ phase: "in_force", heldExecBandwidth: 0, releasesAt: null });
  });

  it("maps closed statuses and treats legacy rows without a cost as holding nothing", () => {
    const now = created + 10;
    expect(
      directiveTimeline({ status: "completed", createdIxTime: created, execBandwidthCost: 5 }, now)
        .phase
    ).toBe("completed");
    expect(
      directiveTimeline({ status: "abandoned", createdIxTime: created, execBandwidthCost: 5 }, now)
        .phase
    ).toBe("abandoned");
    expect(
      directiveTimeline(
        { status: "proposed", createdIxTime: created, execBandwidthCost: null },
        now
      ).phase
    ).toBe("draft");
    expect(
      directiveTimeline({ status: "active", createdIxTime: created, execBandwidthCost: null }, now)
        .heldExecBandwidth
    ).toBe(0);
  });
});

describe("effect rows", () => {
  it("parses stored change lines defensively", () => {
    expect(
      parseChangeLines('[{"kind":"budget","label":"Defense budget +1 notch","detail":"x"}]')
    ).toHaveLength(1);
    expect(parseChangeLines("not json")).toEqual([]);
    expect(parseChangeLines(null)).toEqual([]);
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
});
