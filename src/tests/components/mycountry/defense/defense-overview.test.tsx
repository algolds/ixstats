/**
 * Realm time D2b: the overview. Readiness reads as a C-level with its four areas and the weakest one named with what
 * lifts it; every budget warning carries its advice; a raised alert shows when it bites on the realm calendar and
 * reads "Paused" on a stopped realm; the burden names its source.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { ReadinessCard } from "~/components/mycountry/domains/defense/overview/ReadinessCard";
import { DefenseWarnings } from "~/components/mycountry/domains/defense/overview/DefenseWarnings";
import { DefenseOverview } from "~/components/mycountry/domains/defense/overview/DefenseOverview";
import { WARNING_COPY } from "~/components/mycountry/domains/defense/defense-copy";
import { ownerDefense } from "~/tests/fixtures/defense-overview";
import { CLOCK_NOW, DAY, pausedReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

describe("readiness", () => {
  it("shows the C-level and highlights the weakest area with its fix", () => {
    render(
      <ReadinessCard
        readiness={0.76}
        cLevel="C-3"
        subScores={{ personnel: 0.95, equipment: 0.9, condition: 0.61, training: 0.82 }}
      />
    );
    expect(screen.getByText("C-3")).toBeTruthy();
    expect(screen.getByText("Partly ready")).toBeTruthy();
    expect(screen.getByText("76% readiness")).toBeTruthy();
    const areas = within(screen.getByRole("list", { name: "Readiness areas" })).getAllByRole("listitem");
    expect(areas).toHaveLength(4);
    const worst = areas.filter((a) => a.hasAttribute("data-worst"));
    expect(worst).toHaveLength(1);
    expect(worst[0]!.textContent).toMatch(/Equipment condition/);
    expect(worst[0]!.textContent).toMatch(/Weakest/);
    expect(worst[0]!.textContent).toMatch(/favour maintenance/);
  });
});

describe("warnings", () => {
  it("says nothing when the budget is healthy", () => {
    const { container } = render(<DefenseWarnings warnings={[]} />);
    expect(container.textContent).toBe("");
  });

  it("lists each warning with what to do about it", () => {
    render(<DefenseWarnings warnings={["cannotRecapitalise", "readinessFalling", "payArrears"]} />);
    expect(screen.getByText("3 problems in the defense budget")).toBeTruthy();
    for (const copy of Object.values(WARNING_COPY)) {
      expect(screen.getByText(copy.advice, { exact: false })).toBeTruthy();
    }
  });

  it("titles a single warning by itself", () => {
    render(<DefenseWarnings warnings={["payArrears"]} />);
    expect(screen.getByText(WARNING_COPY.payArrears.title)).toBeTruthy();
    expect(screen.getByText(WARNING_COPY.payArrears.advice)).toBeTruthy();
  });
});

describe("national force", () => {
  const raised = (reader: ReturnType<typeof sixTimesReader>) => {
    const base = ownerDefense();
    render(
      <DefenseOverview
        reader={reader}
        nowClockMs={CLOCK_NOW}
        overview={{
          ...base,
          policy: {
            ...base.policy,
            alertLevel: "high",
            alertInEffect: "peacetime",
            alertEffectiveAtClockMs: CLOCK_NOW + 10 * DAY,
          },
        }}
      />
    );
  };

  it("shows when a raised alert bites, on the realm calendar", () => {
    raised(sixTimesReader());
    expect(screen.getByText(/High from \d+ (Thaw|Frostfall) \d+ AE \(in /)).toBeTruthy();
  });

  it("reads Paused while the realm's clock is stopped", () => {
    raised(pausedReader());
    expect(screen.getByText(/High from .*\(Paused\)/)).toBeTruthy();
  });

  it("names the burden's source, the human factor and the technology lag", () => {
    render(<DefenseOverview overview={ownerDefense()} reader={sixTimesReader()} nowClockMs={CLOCK_NOW} />);
    expect(screen.getByText("2.1% of GDP")).toBeTruthy();
    expect(screen.getByText(/Defense department's lines/)).toBeTruthy();
    expect(screen.getByText("×1.04")).toBeTruthy();
    expect(screen.getByText("3.2 years behind")).toBeTruthy();
    expect(screen.getByText("C-3 · 72%")).toBeTruthy();
  });
});
