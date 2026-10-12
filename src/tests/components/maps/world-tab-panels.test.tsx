/**
 * The World tab in the editor's sidebar: shown to the realm's map editors in the world editor, never on Ixnay and
 * never in the country editor.
 */
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/maps/core/hooks/useRealmMapDisplay", () => ({
  useRealmMapDisplay: jest.fn(),
  useRealmRelief: () => ({ available: false, shown: false, toggle: jest.fn() }),
}));
jest.mock("~/components/maps/editor/panels/WorldPanel", () => ({
  WorldPanel: () => <div data-testid="world-panel" />,
}));
jest.mock("~/components/maps/editor/components/useFeatureActionHandlers", () => ({
  useFeatureActionHandlers: () => ({
    onSelectFeature: jest.fn(),
    onEditFeature: jest.fn(),
    onDeleteFeature: jest.fn(),
  }),
}));
jest.mock("~/components/maps/editor/components/LinkageValidationPanel", () => ({
  LinkageValidationPanel: () => <div>links body</div>,
}));
jest.mock("~/components/maps/editor/components/SovereigntyPanel", () => ({
  SovereigntyPanel: () => <div>sovereignty body</div>,
}));
jest.mock("~/components/maps/editor/components/PropertiesPanelContent", () => ({
  PropertiesPanelContent: () => <div>properties body</div>,
}));
jest.mock("~/components/maps/editor/components/HistoryPanel", () => ({
  HistoryPanel: () => <div>history body</div>,
}));
jest.mock("~/components/maps/editor/panels/EditQueuePanel", () => ({
  EditQueuePanel: () => <div>queue body</div>,
}));
jest.mock("~/components/maps/editor/panels/WikiScannerPanel", () => ({
  WikiScannerPanel: () => <div>wiki body</div>,
}));
jest.mock("~/components/maps/editor/panels/StorylinesPanel", () => ({
  StorylinesPanel: () => <div>stories body</div>,
}));

import { useRealmMapDisplay } from "~/components/maps/core/hooks/useRealmMapDisplay";
import { MapEditorSidebarPanels } from "~/components/maps/editor/components/MapEditorSidebarPanels";
import type { TabId } from "~/components/maps/editor/EditorPanel";
import { stubResizeObserver } from "~/tests/helpers/resize-observer";

const display = jest.mocked(useRealmMapDisplay);

// Falling back to the Layers tab draws its opacity sliders
beforeAll(stubResizeObserver);

const WORLD_TABS: TabId[] = ["linkages", "sovereignty", "layers", "world"];

function stateOf(over: Record<string, unknown> = {}) {
  return {
    editor: {
      mode: "view",
      allFeatures: [],
      featuresLoading: false,
      history: [],
      selectedFeature: null,
      selectedIds: new Set(),
      guides: [],
    },
    isWorldMode: true,
    panelsLocked: false,
    isAdmin: false,
    panelConfigs: {
      panelA: { placement: "left", tabs: WORLD_TABS, collapsed: false },
      panelB: { placement: "right", tabs: ["properties", "history"], collapsed: false },
    },
    setPanelConfigs: jest.fn(),
    activeSidebarTab: "linkages",
    setActiveSidebarTab: jest.fn(),
    layerStates: {},
    setLayerStates: jest.fn(),
    editorVisibleLayers: new Set<string>(),
    toggleEditorLayer: jest.fn(),
    featureCounts: {},
    showGuides: true,
    setShowGuides: jest.fn(),
    worldMapLayers: [],
    handleMoveTab: jest.fn(),
    handleChangePanelPlacement: jest.fn(),
    ...over,
  };
}

const realm = (over: Record<string, unknown> = {}) => ({
  realmId: "r_eurth",
  realmSlug: "eurth",
  isIxnay: false,
  canEdit: true,
  ...over,
});

function renderPanel(state: ReturnType<typeof stateOf>, panelId: "panelA" | "panelB" = "panelA") {
  return render(
    <MapEditorSidebarPanels
      panelId={panelId}
      state={state as never}
      brushTargetId={null}
      setBrushTargetId={jest.fn()}
      worldMap={null}
    />
  );
}

const tabNames = () => screen.queryAllByRole("tab").map((tab) => tab.getAttribute("aria-label"));

describe("the World tab's visibility", () => {
  it("is offered to a realm's map editor, next to the other panel A tabs", () => {
    display.mockReturnValue(realm() as never);
    renderPanel(stateOf());
    expect(tabNames()).toEqual(["Links", "Sovereign", "Layers", "World"]);
  });

  it("is offered to a site admin", () => {
    display.mockReturnValue(realm({ canEdit: false }) as never);
    renderPanel(stateOf({ isAdmin: true }));
    expect(tabNames()).toContain("World");
  });

  it("is not offered to someone who can't edit the realm's map", () => {
    display.mockReturnValue(realm({ canEdit: false }) as never);
    renderPanel(stateOf());
    expect(tabNames()).not.toContain("World");
    expect(tabNames()).toContain("Layers");
  });

  it("is never offered on Ixnay, not even to a site admin", () => {
    display.mockReturnValue(realm({ isIxnay: true, canEdit: true }) as never);
    renderPanel(stateOf({ isAdmin: true }));
    expect(tabNames()).not.toContain("World");
  });

  it("waits for the realm to load rather than flash on Ixnay", () => {
    display.mockReturnValue(undefined);
    renderPanel(stateOf());
    expect(tabNames()).not.toContain("World");
  });

  it("is not part of the country editor", () => {
    display.mockReturnValue(realm() as never);
    renderPanel(
      stateOf({
        isWorldMode: false,
        panelConfigs: {
          panelA: { placement: "left", tabs: ["layers", "world"], collapsed: false },
          panelB: { placement: "right", tabs: ["properties"], collapsed: false },
        },
      })
    );
    expect(tabNames()).toEqual(["Layers"]);
  });

  it("follows the layout when the founder moved it to the other panel", () => {
    display.mockReturnValue(realm() as never);
    renderPanel(
      stateOf({
        panelConfigs: {
          panelA: { placement: "left", tabs: ["linkages", "layers"], collapsed: false },
          panelB: { placement: "right", tabs: ["properties", "world"], collapsed: false },
        },
      }),
      "panelB"
    );
    expect(tabNames()).toEqual(["Properties", "World"]);
  });
});

describe("the World tab's content", () => {
  it("opens the world panel when the tab is the active one, and not before", () => {
    display.mockReturnValue(realm() as never);
    const { rerender } = renderPanel(stateOf());
    expect(screen.queryByTestId("world-panel")).toBeNull();
    rerender(
      <MapEditorSidebarPanels
        panelId="panelA"
        state={stateOf({ activeSidebarTab: "world" }) as never}
        brushTargetId={null}
        setBrushTargetId={jest.fn()}
        worldMap={null}
      />
    );
    expect(screen.getByTestId("world-panel")).toBeInTheDocument();
  });

  it("switches to it when its tab is clicked", () => {
    display.mockReturnValue(realm() as never);
    const state = stateOf();
    renderPanel(state);
    fireEvent.click(screen.getByRole("tab", { name: "World" }));
    expect(state.setActiveSidebarTab).toHaveBeenCalledWith("world");
  });

  it("is not drawn for a tab that is not offered: the panel shows its first tab instead", () => {
    display.mockReturnValue(realm({ isIxnay: true }) as never);
    renderPanel(stateOf({ activeSidebarTab: "world" }));
    expect(screen.queryByTestId("world-panel")).toBeNull();
    expect(screen.getByText("links body")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Links" })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps the requested tab when this panel shows it", () => {
    display.mockReturnValue(realm() as never);
    renderPanel(stateOf({ activeSidebarTab: "sovereignty" }));
    expect(screen.getByText("sovereignty body")).toBeInTheDocument();
  });
});
