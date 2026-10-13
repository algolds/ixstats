/**
 * Picking a generated country on the Studio map: a click on one picks its slot, a click on the sea or a new world
 * clears it, and the cursor is a pointer over a country.
 */

import { act, fireEvent, render, screen } from "@testing-library/react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { StudioCountryCard } from "~/components/maps/studio/StudioCountryCard";
import { useStudioCountryPick } from "~/hooks/useStudioCountryPick";
import { DRAFT_POLITICAL_ID } from "~/lib/maps/world-draft-layers";
import type { WorldSlot } from "~/lib/worldgen/v2/types";
import type { WorldGenResult } from "~/lib/worldgen/worker/world-messages";
import { worldResult } from "~/tests/helpers/fake-world-worker";

const slot = (key: string, name: string): WorldSlot => ({
  key,
  name,
  colour: "#aa3355",
  cells: 40,
  areaKm2: 312_000,
  population: 8_400_000,
  gdpPerCapita: 21_500,
});

function fakeMap() {
  const handlers = new Map<string, (event: { point: { x: number; y: number } }) => void>();
  const canvas = document.createElement("canvas");
  /** The slot key under the next pointer event; null is the sea */
  let under: string | null = null;
  let drawn = true;
  const map = {
    on: (event: string, handler: (event: { point: { x: number; y: number } }) => void) =>
      handlers.set(event, handler),
    off: (event: string) => handlers.delete(event),
    getCanvas: () => canvas,
    getLayer: (id: string) => (drawn && id === DRAFT_POLITICAL_ID ? {} : undefined),
    queryRenderedFeatures: jest.fn(() => (under ? [{ properties: { slotKey: under } }] : [])),
  };
  const fire = (event: string, key: string | null) => {
    under = key;
    act(() => handlers.get(event)!({ point: { x: 1, y: 1 } }));
  };
  return {
    map: map as unknown as MapLibreMap,
    canvas,
    handlers,
    fire,
    hide: () => (drawn = false),
  };
}

let picked: ReturnType<typeof useStudioCountryPick> | null = null;
function Host({ map, result }: { map: MapLibreMap | null; result: WorldGenResult | null }) {
  picked = useStudioCountryPick(map, result);
  return null;
}

const world = worldResult({ slots: [slot("slot_1", "Varenia"), slot("slot_2", "Ostmark")] });

describe("useStudioCountryPick", () => {
  it("picks the slot of the country clicked, and drops it on a click on the sea", () => {
    const rig = fakeMap();
    render(<Host map={rig.map} result={world} />);
    expect(picked!.slot).toBeNull();
    rig.fire("click", "slot_2");
    expect(picked!.slot?.name).toBe("Ostmark");
    rig.fire("click", null);
    expect(picked!.slot).toBeNull();
  });

  it("forgets the pick when a new world comes, and when cleared", () => {
    const rig = fakeMap();
    const view = render(<Host map={rig.map} result={world} />);
    rig.fire("click", "slot_1");
    expect(picked!.slot?.name).toBe("Varenia");
    view.rerender(<Host map={rig.map} result={{ ...world }} />);
    expect(picked!.slot).toBeNull();

    rig.fire("click", "slot_1");
    act(() => picked!.clear());
    expect(picked!.slot).toBeNull();
  });

  it("picks nothing while the draft has no countries drawn (a fitted world keeps the realm's borders)", () => {
    const rig = fakeMap();
    rig.hide();
    render(<Host map={rig.map} result={world} />);
    rig.fire("click", "slot_1");
    expect(picked!.slot).toBeNull();
  });

  it("shows a pointer over a country and stops listening when the map goes", () => {
    const rig = fakeMap();
    const view = render(<Host map={rig.map} result={world} />);
    rig.fire("mousemove", "slot_1");
    expect(rig.canvas.style.cursor).toBe("pointer");
    rig.fire("mousemove", null);
    expect(rig.canvas.style.cursor).toBe("");
    view.rerender(<Host map={null} result={world} />);
    expect(rig.handlers.size).toBe(0);
  });
});

describe("StudioCountryCard", () => {
  it("shows the country's name and starting figures, and closes", () => {
    const onClose = jest.fn();
    render(<StudioCountryCard slot={slot("slot_1", "Varenia")} onClose={onClose} />);
    const card = screen.getByLabelText("Varenia");
    expect(card).toHaveTextContent("Varenia");
    expect(card).toHaveTextContent("312k km²");
    expect(card).toHaveTextContent("8.40M");
    expect(card).toHaveTextContent("$21,500");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
