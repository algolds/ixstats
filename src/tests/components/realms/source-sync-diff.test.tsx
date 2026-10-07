import { fireEvent, render, screen } from "@testing-library/react";
import { SyncDiffView } from "~/app/admin/realms/_components/source-sync/SyncDiffView";

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

jest.mock("~/trpc/react", () => ({ api: {} }));

const summary = {
  counts: { sourceNations: 3, matched: 1, create: 1, update: 1, features: 1, alliances: 1, unmatched: 1, missing: 1 },
  creates: [
    {
      name: "Deseti",
      key: "Deseti",
      from: "source",
      wikiTitle: "Deseti",
      officialName: null,
      capital: null,
      population: null,
      gdpPerCapita: null,
      landArea: 6895,
      continent: "Europa",
      readInfobox: true,
    },
  ],
  updates: [
    {
      countryId: "c1",
      name: "Tavok",
      key: "Tavok",
      claimed: false,
      bindKey: false,
      changes: [{ field: "population", from: 1_000_000, to: 48_000_000 }],
    },
  ],
  skippedClaimed: [{ countryId: "c2", name: "Owned", fields: ["population"] }],
  locked: [],
  features: [{ key: "Deseti", action: "create", nation: "Deseti" }],
  featuresUnchanged: 114,
  alliances: [
    {
      key: "wasp",
      name: "West Argic Security Pact",
      shortName: "WASP",
      color: "#8e44ad",
      type: "military",
      isNew: true,
      changes: [],
      addMembers: ["Tavok"],
      notInSource: [],
    },
  ],
  unknownMembers: [{ organization: "West Argic Security Pact", member: "Haitu", reason: "No nation of that key in the source" }],
  missing: [{ countryId: "c3", name: "Gone", key: "Gone" }],
  unmatched: [{ key: "Ide-Jima", name: "Ide Jima", reason: "Its name matches more than one nation of the realm", candidates: [] }],
  excluded: [],
  warnings: [],
};

const run = {
  id: "run1",
  realmId: "eurth-id",
  startedAt: new Date("2026-10-07T12:00:00Z"),
  finishedAt: new Date("2026-10-07T12:00:05Z"),
  dryRun: true,
  triggeredBy: "clerk_admin",
  status: "success",
  summary,
  errors: [],
} as never;

function renderDiff(nation = jest.fn(), organization = jest.fn()) {
  render(
    <SyncDiffView
      run={run}
      overrides={{ nation, organization, pending: false }}
      config={{ overrides: { nations: {}, organizations: {} } } as never}
      countries={[{ id: "c1", name: "Tavok", externalSourceKey: "Tavok", claimed: false }]}
    />
  );
  return { nation, organization };
}

describe("SyncDiffView", () => {
  it("summarises the run and lists every section", () => {
    renderDiff();
    expect(screen.getByText(/3 source nations: 1 matched, 1 new/)).toBeInTheDocument();
    for (const title of [
      "Left to you",
      "New nations (unclaimed)",
      "Figure changes",
      "Claimed nations left alone",
      "Borders",
      "Alliances",
      "No longer in the source",
    ])
      expect(screen.getByText(title)).toBeInTheDocument();
  });

  it("excludes an unmatched entry, pins a field, and excludes an organisation", () => {
    const { nation, organization } = renderDiff();
    fireEvent.click(screen.getAllByRole("button", { name: "Exclude" })[0]!);
    expect(nation).toHaveBeenCalledWith("Ide-Jima", { exclude: true });
    fireEvent.click(screen.getByRole("button", { name: "Pin current value" }));
    expect(nation).toHaveBeenCalledWith("Tavok", { lockedFields: ["population"] });
    const excludes = screen.getAllByRole("button", { name: "Exclude" });
    fireEvent.click(excludes[excludes.length - 1]!);
    expect(organization).toHaveBeenCalledWith("wasp", { exclude: true });
  });
});
