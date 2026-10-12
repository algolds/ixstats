/**
 * The realm page: its figures, recent jobs, the map pipeline panel, and actions that call the right procedures.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  calls,
  jobRow,
  listInputs,
  realmRow,
  resetFakeAtlas,
  responses,
  state,
} from "~/tests/helpers/fake-atlas-ui";

jest.mock("~/trpc/react", () => ({ api: jest.requireActual("~/tests/helpers/fake-atlas-ui").api }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock("~/app/admin/realms/_components/map-pipeline/MapPipelinePanel", () => ({
  MapPipelinePanel: ({ slug }: { slug: string }) => <p>pipeline panel for {slug}</p>,
}));

import { AtlasRealmPage } from "~/app/admin/maps/_components/atlas/AtlasRealmPage";

const latestImport = (canRollBack: boolean) => ({
  id: "imp_9",
  jobId: "job_9",
  layerTypes: ["political"],
  mode: "replace",
  createdBy: "admin_1",
  summary: null,
  createdAt: new Date("2026-10-11T10:00:00Z"),
  canRollBack,
});

function loadRealm(canRollBack = true) {
  state.realm = {
    realm: realmRow({
      layers: { present: 5, total: 7, missing: ["rivers", "lakes"] },
      flags: ["missing-layers"],
    }),
    partial: false,
    layerCounts: { political: 40, rivers: 0 },
    recentJobs: [],
    latestImport: latestImport(canRollBack),
  };
  state.recentJobs = [jobRow({ id: "recent_1", kind: "world", dryRun: true })];
}

beforeEach(() => {
  resetFakeAtlas();
  loadRealm();
});

describe("the realm page", () => {
  it("shows the realm's figures and problems", () => {
    render(<AtlasRealmPage slug="eurth" />);
    expect(screen.getByRole("heading", { name: "Eurth" })).toBeInTheDocument();
    expect(screen.getByText("5 of 7")).toBeInTheDocument();
    expect(screen.getByText("Missing rivers, lakes")).toBeInTheDocument();
    expect(screen.getByText("5 owned, 6 open, 1 reserved")).toBeInTheDocument();
    expect(screen.getByText("Missing layers")).toBeInTheDocument();
    expect(screen.getByText("40")).toBeInTheDocument();
  });

  it("lists the realm's recent jobs and mounts its map pipeline", () => {
    render(<AtlasRealmPage slug="eurth" />);
    expect(listInputs.at(-1)).toEqual({ realm: "eurth", limit: 10 });
    expect(screen.getByRole("button", { name: "Open World check recent_1" })).toBeInTheDocument();
    expect(screen.getByText("pipeline panel for eurth")).toBeInTheDocument();
  });

  it("links to the editor and to Studio for this realm", () => {
    render(<AtlasRealmPage slug="eurth" />);
    expect(screen.getByRole("link", { name: "Open in editor" })).toHaveAttribute(
      "href",
      "/admin/maps/editor?realm=eurth"
    );
    expect(screen.getByRole("link", { name: "Open in Studio" })).toHaveAttribute(
      "href",
      "/admin/maps/studio?fit=eurth"
    );
  });

  it("says when the realm cannot be read", () => {
    state.realm = undefined;
    state.realmError = "Realm not found";
    render(<AtlasRealmPage slug="nowhere" />);
    expect(screen.getByText("Realm not found")).toBeInTheDocument();
  });
});

describe("the realm page actions", () => {
  it("rebuilds the relief after asking", () => {
    render(<AtlasRealmPage slug="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Rebuild relief" }));
    expect(calls).toEqual([]);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Rebuild relief" })
    );
    expect(calls).toEqual([["geoEditor.mapImport.rebuildRelief", { realmId: "r_eurth" }]]);
  });

  it("rolls back the last import after asking", () => {
    responses["atlas.jobs.rollback"] = { restored: 2, deleted: 0 };
    render(<AtlasRealmPage slug="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Roll back last import" }));
    expect(calls).toEqual([]);
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Roll back" })
    );
    expect(calls).toEqual([["atlas.jobs.rollback", { importId: "imp_9" }]]);
  });

  it("turns Roll back off when the latest import cannot be undone", () => {
    loadRealm(false);
    render(<AtlasRealmPage slug="eurth" />);
    expect(screen.getByRole("button", { name: "Roll back last import" })).toBeDisabled();
  });

  it("refreshes the caches for the realm", () => {
    responses["atlas.realms.refresh"] = { mapVersion: 5 };
    render(<AtlasRealmPage slug="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh caches" }));
    expect(calls).toEqual([["atlas.realms.refresh", { realm: "eurth" }]]);
  });
});
