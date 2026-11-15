import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { BorderToolRail } from "~/components/maps/editor/components/BorderToolRail";
import { EditorZoomControls } from "~/components/maps/editor/components/EditorZoomControls";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { StudioCountryCard } from "~/components/maps/studio/StudioCountryCard";
import { StudioInspector } from "~/components/maps/studio/StudioInspector";
import { StudioPhoneNotice } from "~/components/maps/studio/StudioPhoneNotice";
import { StudioRail } from "~/components/maps/studio/StudioRail";
import { StudioTopBar } from "~/components/maps/studio/StudioTopBar";
import { renderTab } from "~/tests/helpers/studio-tab-fixtures";

jest.mock("~/trpc/react", () => jest.requireActual("~/tests/helpers/fake-studio-trpc"));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

beforeAll(() => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

describe("Map Editor & World Studio subtle Facet chrome", () => {
  it("defines facet-chrome-subtle in layers.css with vibrant secondary ink and opaque accessibility fallbacks", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/styles/facet/layers.css"), "utf8");
    const start = css.indexOf("@utility facet-chrome-subtle");
    expect(start).toBeGreaterThan(-1);
    const rest = css.slice(start + 1);
    const nextUtility = rest.indexOf("@utility ");
    const block = nextUtility === -1 ? css.slice(start) : css.slice(start, start + 1 + nextUtility);

    expect(block).toContain("--color-label-secondary: var(--color-label-vibrant-secondary)");
    expect(block).toContain("color-mix(in srgb, var(--color-surface) 78%, transparent)");
    expect(block).toContain("blur(12px) saturate(125%)");
    expect(block).toMatch(
      /@variant\s+transparency-reduced\s*\{[^}]*background-color:\s*var\(--color-surface\)[^}]*backdrop-filter:\s*none/s
    );
    expect(block).toMatch(
      /@variant\s+contrast-more\s*\{[^}]*background-color:\s*var\(--color-surface\)[^}]*border-color:\s*var\(--color-separator-opaque\)[^}]*backdrop-filter:\s*none/s
    );
  });

  it("renders Map Editor status bar, tool rails, panel frame, and zoom controls on facet-chrome-subtle", () => {
    const zoomIn = jest.fn();
    const zoomOut = jest.fn();
    const fakeMap = { zoomIn, zoomOut } as unknown as MapLibreMap;

    const { unmount } = render(
      <div data-app="maps">
        <EditorStatusBar mode="view" zoom={4.5} featureCount={12} />
        <MapEditorToolbar mode="add-city" onModeChange={jest.fn()} />
        <BorderToolRail mode="split" onModeChange={jest.fn()} />
        <EditorZoomControls map={fakeMap} />
        <EditorPanel
          mode="view"
          collapsed={false}
          onToggleCollapse={jest.fn()}
          tabs={["layers", "properties"]}
          layersContent={<div>Layers body</div>}
        />
      </div>
    );

    const statusBar = screen.getByRole("status");
    expect(statusBar).toHaveAttribute("data-layer", "chrome");
    expect(statusBar.className).toContain("facet-chrome-subtle");
    expect(statusBar.textContent).toContain("–, –");
    expect(statusBar.textContent).not.toContain("—");

    const editorTools = screen.getByRole("toolbar", { name: "Editor tools" });
    expect(editorTools).toHaveAttribute("data-layer", "chrome");
    expect(editorTools.className).toContain("facet-chrome-subtle");

    const borderTools = screen.getByRole("toolbar", { name: "Border tools" });
    expect(borderTools).toHaveAttribute("data-layer", "chrome");
    expect(borderTools.className).toContain("facet-chrome-subtle");
    const activeBorderTool = screen.getByRole("button", { name: "Split borders (X)" });
    expect(activeBorderTool).toHaveAttribute("aria-pressed", "true");
    expect(activeBorderTool.className).toContain("bg-tint");
    expect(activeBorderTool.className).toContain("text-on-tint");

    const zoomGroup = screen.getByRole("group", { name: "Map zoom" });
    expect(zoomGroup).toHaveAttribute("data-layer", "chrome");
    expect(zoomGroup.className).toContain("facet-chrome-subtle");
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(zoomIn).toHaveBeenCalledTimes(1);
    expect(zoomOut).toHaveBeenCalledTimes(1);

    const tablist = screen.getByRole("tablist", { name: "Editor panels" });
    expect(tablist.closest("[data-layer='chrome']")?.className).toContain("facet-chrome-subtle");

    unmount();
  });

  it("renders World Studio top bar, rail, inspector, country card, and phone notice in Maps-tinted subtle chrome", () => {
    const { container, unmount } = renderTab(
      <div data-app="maps">
        <StudioTopBar />
        <StudioRail />
        <StudioInspector />
        <StudioCountryCard
          slot={{
            key: "slot_1",
            name: "Valenholm",
            colour: "#3b82f6",
            cells: 420,
            areaKm2: 125_000,
            population: 8_400_000,
            gdpPerCapita: 41_200,
          }}
          onClose={jest.fn()}
        />
      </div>
    );

    const header = container.querySelector("header");
    expect(header).toHaveAttribute("data-layer", "chrome");
    expect(header?.className).toContain("facet-chrome-subtle");

    const rail = screen.getByRole("region", { name: "Parameters" });
    expect(rail).toHaveAttribute("data-layer", "chrome");
    expect(rail.className).toContain("facet-chrome-subtle");

    const inspector = container.querySelector("aside");
    expect(inspector).toHaveAttribute("data-layer", "chrome");
    expect(inspector?.className).toContain("facet-chrome-subtle");

    const countryCard = screen.getByRole("region", { name: "Valenholm" });
    expect(countryCard).toHaveAttribute("data-layer", "chrome");
    expect(countryCard.className).toContain("facet-chrome-subtle");

    unmount();

    const phone = render(<StudioPhoneNotice />);
    expect(phone.container.firstElementChild).toHaveAttribute("data-app", "maps");
    phone.unmount();
  });
});
