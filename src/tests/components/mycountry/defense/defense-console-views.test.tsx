/**
 * Realm time D2b: who sees what. Another nation's page shows only the public order of battle (no levers, no
 * readiness or budget); the owner's free preview shows the overview and the levers' values but no working
 * control; a branch card names its C-level and weakest area.
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";
import { ownerBranch, ownerDefense } from "~/tests/fixtures/defense-overview";
import { sixTimesReader } from "~/tests/fixtures/realm-readers";
import type { OwnerDefense, RedactedDefense } from "~/hooks/useDefenseConsole";

const overviewState: { owner: OwnerDefense | null; redacted: RedactedDefense | null } = {
  owner: null,
  redacted: null,
};

jest.mock("next/navigation", () => ({ useSearchParams: () => null, useRouter: () => ({ push: jest.fn() }) }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => <div data-testid="defense-tab" />,
}));
jest.mock("~/hooks/useNationClock", () => {
  const { sixTimesReader: reader } = jest.requireActual("~/tests/fixtures/realm-readers");
  const shared = reader();
  return { useNationClock: () => shared, useClockNow: () => shared.now() };
});
jest.mock("~/hooks/useDefenseConsole", () => ({
  useDefenseOverview: () => ({ isLoading: false, ...overviewState }),
  useDefenseLevers: () => ({
    pending: false,
    saveShares: jest.fn(),
    applyPreset: jest.fn(),
    saveManpower: jest.fn(),
    setDoctrine: jest.fn(),
    setAlertLevel: jest.fn(),
    setOmPriority: jest.fn(),
    setSurge: jest.fn(),
  }),
  useBranchLevers: () => ({ pending: false, mobilise: jest.fn(), demobilise: jest.fn() }),
}));

import { PremiumPreviewFrame } from "~/components/mycountry/shared/primitives/PremiumPreviewFrame";
import { DefenseCommandPanel } from "~/components/mycountry/domains/defense/DefenseCommandPanel";
import { PolicyPanel } from "~/components/mycountry/domains/defense/PolicyPanel";
import { DefenseOverview } from "~/components/mycountry/domains/defense/overview/DefenseOverview";
import { BranchCard, type BranchActions } from "~/components/mycountry/domains/defense/branches/BranchCard";
import type { ForceBranch } from "~/components/mycountry/domains/defense/forces/force-fields";

beforeAll(stubResizeObserver);
beforeEach(() => {
  overviewState.owner = null;
  overviewState.redacted = null;
});

describe("another nation's Defense page", () => {
  it("shows the public order of battle and nothing else", () => {
    overviewState.redacted = {
      countryId: "c2",
      redacted: true,
      doctrine: "defensive",
      alertInEffect: "elevated",
      branches: [{ id: "x", domain: "sea", name: "Grand Fleet", active: 41_000, reserves: 12_000 }],
    };
    render(<DefenseCommandPanel countryId="c2" />);
    expect(screen.getByText("Public order of battle")).toBeTruthy();
    expect(screen.getByText("Grand Fleet")).toBeTruthy();
    expect(screen.getByText("41,000")).toBeTruthy();
    expect(screen.getByText("Defensive")).toBeTruthy();
    expect(screen.getByText("Elevated")).toBeTruthy();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByTestId("defense-tab")).toBeNull();
    expect(screen.queryByText(/readiness$/i)).toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("gives the owner the console", () => {
    overviewState.owner = ownerDefense();
    render(<DefenseCommandPanel countryId="c1" />);
    expect(screen.getByRole("tablist", { name: "Defense sections" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Budget and posture/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Procurement/ })).toBeTruthy();
    expect(screen.queryByText("Public order of battle")).toBeNull();
  });
});

describe("the owner's free preview", () => {
  it("shows the overview and the levers' values but no working lever", () => {
    overviewState.owner = ownerDefense({ warnings: ["readinessFalling"] });
    render(
      <PremiumPreviewFrame feature="defense" locked>
        <DefenseOverview overview={overviewState.owner} reader={sixTimesReader()} nowClockMs={overviewState.owner.clockMs} />
        <PolicyPanel countryId="c1" />
      </PremiumPreviewFrame>
    );
    expect(screen.getByText("National force")).toBeTruthy();
    expect(screen.getByText(/Upkeep is underfunded/)).toBeTruthy();
    expect(screen.getByText("Budget split")).toBeTruthy();
    // The upgrade button is the only button on the page.
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Upgrade"]);
    expect(screen.queryAllByRole("slider")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });
});

describe("a branch card", () => {
  const row = {
    id: "b-land",
    name: "Royal Army",
    domain: "land",
    motto: null,
    units: [],
    assets: [
      {
        id: "a1",
        name: "Leopard 2A7",
        category: "vehicle",
        status: "operational",
        quantity: 40,
        operational: 40,
        acquisitionCost: 10e6,
        designYear: 2016,
      },
    ],
  } as ForceBranch;
  const actions = (): BranchActions => ({
    toggle: jest.fn(),
    edit: jest.fn(),
    remove: jest.fn(),
    addUnit: jest.fn(),
    editUnit: jest.fn(),
    removeUnit: jest.fn(),
    mobilise: jest.fn(),
    demobilise: jest.fn(),
    savePlan: jest.fn(),
    assetStatus: jest.fn(),
    scrapAsset: jest.fn(),
  });

  it("names its C-level and weakest area, and scraps an asset after asking", () => {
    const a = actions();
    render(<BranchCard row={row} state={ownerBranch()} effortOfTotal={0.6} expanded canEdit pending={false} actions={a} />);
    expect(screen.getByText("C-2 · Mostly ready")).toBeTruthy();
    const worst = document.querySelector("[data-worst]");
    expect(worst?.textContent).toMatch(/Equipment condition.*weakest/);
    expect(screen.getByText(/Gets 60% of the defense effort/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scrap Leopard 2A7" }));
    expect(screen.getByText(/Nothing is\s+refunded/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scrap" }));
    expect(a.scrapAsset).toHaveBeenCalledWith("a1");
  });

  it("saves a plan with an effort weight and a strength cap", () => {
    const a = actions();
    render(<BranchCard row={row} state={ownerBranch()} effortOfTotal={0.6} expanded canEdit pending={false} actions={a} />);
    fireEvent.change(screen.getByLabelText("Effort weight (%)"), { target: { value: "70" } });
    fireEvent.change(screen.getByLabelText("Strength cap (optional)"), { target: { value: "100000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save plan" }));
    expect(a.savePlan).toHaveBeenCalledWith({ id: "b-land", effortShare: 0.7, targetActive: 100_000 });
  });

  it("has no levers in the preview", () => {
    render(
      <BranchCard row={row} state={ownerBranch()} effortOfTotal={0.6} expanded canEdit={false} pending={false} actions={actions()} />
    );
    const names = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(names).toEqual(["Collapse Royal Army"]);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
  });
});
