/**
 * How the editor's state brings in the World tab: a saved panel layout from before it gets the tab added (world
 * editor) or stripped of it (country editor); a new layout has it; and `?editor=world` opens the editor
 * on it.
 */
import { renderHook } from "@testing-library/react";

const searchParams = { current: new URLSearchParams() };
jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams.current,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));
jest.mock("~/components/maps/core/MapRealmContext", () => ({ useMapRealm: () => undefined }));

import { useEditorLayoutState } from "~/components/maps/editor/hooks/state/useEditorLayoutState";
import { useEditorGeoDataState } from "~/components/maps/editor/hooks/state/useEditorGeoDataState";

const LAYOUT_KEY = "ixworld-editor-panels-config-v4";
const layoutProps = (isWorldMode: boolean) => ({
  isWorldMode,
  activeEditorMode: "view" as const,
  editorMode: "view",
  mapSelectedCountry: null,
});

const storeLayout = (panelA: string[], panelB = ["properties", "history"]) =>
  window.localStorage.setItem(
    LAYOUT_KEY,
    JSON.stringify({
      panelA: { placement: "left", tabs: panelA, collapsed: false },
      panelB: { placement: "right", tabs: panelB, collapsed: false },
    })
  );

beforeEach(() => {
  window.localStorage.clear();
  searchParams.current = new URLSearchParams();
});

describe("the panel layout", () => {
  it("has the World tab in panel A from the start in the world editor", () => {
    const { result } = renderHook(() => useEditorLayoutState(layoutProps(true)));
    expect(result.current.panelConfigs.panelA.tabs).toEqual([
      "linkages",
      "sovereignty",
      "layers",
      "world",
    ]);
  });

  it("does not put it in the country editor's layout", () => {
    const { result } = renderHook(() => useEditorLayoutState(layoutProps(false)));
    expect(result.current.panelConfigs.panelA.tabs).not.toContain("world");
  });

  it("adds the tab to a layout saved before it existed", () => {
    storeLayout(["linkages", "sovereignty", "layers"]);
    const { result } = renderHook(() => useEditorLayoutState(layoutProps(true)));
    expect(result.current.panelConfigs.panelA.tabs).toEqual([
      "linkages",
      "sovereignty",
      "layers",
      "world",
    ]);
    expect(JSON.parse(window.localStorage.getItem(LAYOUT_KEY)!).panelA.tabs).toContain("world");
  });

  it("leaves the tab where the founder put it", () => {
    storeLayout(["linkages", "layers"], ["properties", "world", "history"]);
    const { result } = renderHook(() => useEditorLayoutState(layoutProps(true)));
    expect(result.current.panelConfigs.panelA.tabs).not.toContain("world");
    expect(result.current.panelConfigs.panelB.tabs).toEqual(["properties", "world", "history"]);
  });

  it("takes the tab out of a layout the country editor opens", () => {
    storeLayout(["layers", "wiki", "stories", "world"]);
    const { result } = renderHook(() => useEditorLayoutState(layoutProps(false)));
    expect(result.current.panelConfigs.panelA.tabs).toEqual(["layers", "wiki", "stories"]);
  });
});

describe("the tab the editor opens on", () => {
  const geoProps = (over: Partial<Parameters<typeof useEditorGeoDataState>[0]> = {}) => ({
    isWorldMode: true,
    activeCountryId: null,
    setActiveCountryId: jest.fn(),
    mapSelectedCountry: null,
    setMapSelectedCountry: jest.fn(),
    ...over,
  });
  const openTab = (over: Partial<Parameters<typeof useEditorGeoDataState>[0]> = {}) =>
    renderHook(() => useEditorGeoDataState(geoProps(over))).result.current.activeSidebarTab;

  it("is Links in the world editor and Layers in the country editor", () => {
    expect(openTab()).toBe("linkages");
    expect(openTab({ isWorldMode: false })).toBe("layers");
  });

  it("is World when the address is ?editor=world", () => {
    searchParams.current = new URLSearchParams("realm=eurth&editor=world");
    expect(openTab()).toBe("world");
  });

  it("is not World for the labels address, which opens its own dialog", () => {
    searchParams.current = new URLSearchParams("realm=eurth&editor=labels");
    expect(openTab()).toBe("linkages");
  });

  it("stays Layers in the country editor whatever the address says", () => {
    searchParams.current = new URLSearchParams("editor=world");
    expect(openTab({ isWorldMode: false })).toBe("layers");
  });
});
