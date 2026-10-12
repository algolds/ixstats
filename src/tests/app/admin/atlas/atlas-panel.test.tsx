/**
 * The Atlas page: its header, health strip, tabs (Realms by default), and the import wizard that `?importJob` opens.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { healthSummary, realmRow, resetFakeAtlas, state } from "~/tests/helpers/fake-atlas-ui";

jest.mock("~/trpc/react", () => ({ api: jest.requireActual("~/tests/helpers/fake-atlas-ui").api }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title, actions }: { title: string; actions: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));
jest.mock("~/components/maps/editor/panels/EditQueuePanel", () => ({
  EditQueuePanel: () => <p>edit queue body</p>,
}));
jest.mock("~/app/admin/maps/_components/map-import/RealmMapImportWizard", () => ({
  RealmMapImportWizard: ({ initialJobId }: { initialJobId?: string | null }) => (
    <p>import wizard {initialJobId ?? "new"}</p>
  ),
}));
jest.mock("~/app/admin/maps/style-editor/_components/StyleEditorFrame", () => ({
  StyleEditorFrame: ({ height }: { height?: number }) => <p>style frame {height}</p>,
}));

import { AtlasPanel } from "~/app/admin/maps/_components/atlas/AtlasPanel";

/** Radix tabs switch on mouse down */
const openTab = (name: string) => fireEvent.mouseDown(screen.getByRole("tab", { name }));

beforeEach(() => {
  resetFakeAtlas();
  state.health = healthSummary();
  state.overview = { realms: [realmRow()], partial: false };
  window.history.replaceState(null, "", "/admin/maps");
});

describe("the Atlas page", () => {
  it("opens on the Realms tab and offers World Studio and Import a map", () => {
    render(<AtlasPanel />);
    expect(screen.getByRole("heading", { name: "Atlas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "World Studio" })).toHaveAttribute(
      "href",
      "/admin/maps/studio"
    );
    expect(screen.getByRole("button", { name: "Import a map" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Realms" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("link", { name: "Eurth" })).toBeInTheDocument();
  });

  it("switches between Realms, Jobs, Edit queue and Map style", () => {
    render(<AtlasPanel />);
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Realms",
      "Jobs",
      "Edit queue",
      "Map style",
    ]);
    openTab("Edit queue");
    expect(screen.getByText("edit queue body")).toBeInTheDocument();
    openTab("Map style");
    expect(screen.getByText("style frame 720")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open full screen" })).toHaveAttribute(
      "href",
      "/admin/maps/style-editor"
    );
  });

  it("opens the import wizard from the header button and closes it again", () => {
    render(<AtlasPanel />);
    expect(screen.queryByText(/import wizard/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Import a map" }));
    expect(screen.getByText("import wizard new")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText(/import wizard/)).toBeNull();
  });

  it("opens a fresh wizard after the ?importJob one is closed", () => {
    window.history.replaceState(null, "", "/admin/maps?importJob=job_42");
    render(<AtlasPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Import a map" }));
    expect(screen.getByText("import wizard new")).toBeInTheDocument();
  });

  it("opens the wizard on the job in ?importJob", () => {
    window.history.replaceState(null, "", "/admin/maps?importJob=job_42");
    render(<AtlasPanel />);
    expect(screen.getByText("import wizard job_42")).toBeInTheDocument();
  });
});

describe("the health strip", () => {
  it("shows running jobs, failures in 24 hours, storage and the last cron runs", () => {
    render(<AtlasPanel />);
    const strip = screen.getByLabelText("Map health");
    expect(within(strip).getByText("Running jobs")).toBeInTheDocument();
    expect(within(strip).getByText("2")).toBeInTheDocument();
    expect(within(strip).getByText("1 queued")).toBeInTheDocument();
    expect(within(strip).getByText("Failed in 24 hours")).toBeInTheDocument();
    expect(within(strip).getByText("3")).toBeInTheDocument();
    expect(within(strip).getByText("2.0 KB")).toBeInTheDocument();
    expect(within(strip).getByText("5.0 MB or more")).toBeInTheDocument();
    expect(within(strip).getByText("map-tiles: succeeded 2h ago")).toBeInTheDocument();
    expect(within(strip).getByText("geo-profiles: Never ran")).toBeInTheDocument();
    expect(within(strip).getByText("map-import: failed 10m ago")).toBeInTheDocument();
  });

  it("says Not measured for a folder that ran out of time", () => {
    render(<AtlasPanel />);
    expect(
      within(screen.getByLabelText("Map health")).getByText("Not measured")
    ).toBeInTheDocument();
  });

  it("opens the tab that explains each item", () => {
    render(<AtlasPanel />);
    const strip = screen.getByLabelText("Map health");
    fireEvent.click(within(strip).getByText("Failed in 24 hours"));
    expect(screen.getByRole("tab", { name: "Jobs" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(strip).getByText("Tiles"));
    expect(screen.getByRole("tab", { name: "Realms" })).toHaveAttribute("aria-selected", "true");
  });

  it("says so when the summary cannot be read", () => {
    state.health = undefined;
    render(<AtlasPanel />);
    expect(screen.getByText("The health summary could not be read.")).toBeInTheDocument();
  });

  it("shows the server's message when the summary fails", () => {
    state.readErrors.health = "Health is down";
    render(<AtlasPanel />);
    expect(screen.getByText("Health is down")).toBeInTheDocument();
  });

  it("shows a placeholder while the summary loads", () => {
    state.loading.health = true;
    render(<AtlasPanel />);
    expect(screen.queryByLabelText("Map health")).toBeNull();
    expect(screen.queryByText("The health summary could not be read.")).toBeNull();
  });
});
