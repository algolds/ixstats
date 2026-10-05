import type { EditorFeature } from "~/hooks/map-editor/editor-types";

/** Feature types a new storyline event can be placed at. */
const PLACE_TYPE_LABELS: Partial<Record<EditorFeature["type"], string>> = {
  city: "City",
  poi: "POI",
  storyPin: "Story pin",
  peak: "Peak",
};

export interface StoryPlaceOption {
  value: string;
  label: string;
  coordinates: [number, number];
}

/**
 * Places a new storyline event can sit at: the country's own point features (they are inside the
 * country, so the server's containment check passes), cities first, then by name.
 */
export function storyPlaceOptions(features: readonly EditorFeature[]): StoryPlaceOption[] {
  const order = Object.keys(PLACE_TYPE_LABELS);
  return features
    .filter(
      (f) =>
        PLACE_TYPE_LABELS[f.type] !== undefined &&
        Array.isArray(f.coordinates) &&
        f.coordinates.length >= 2 &&
        Number.isFinite(f.coordinates[0]) &&
        Number.isFinite(f.coordinates[1])
    )
    .sort(
      (a, b) =>
        order.indexOf(a.type) - order.indexOf(b.type) || (a.name ?? "").localeCompare(b.name ?? "")
    )
    .map((f) => ({
      value: `${f.type}:${f.id}`,
      label: `${f.name || "Unnamed"} (${PLACE_TYPE_LABELS[f.type]})`,
      coordinates: [f.coordinates![0], f.coordinates![1]],
    }));
}

/** The order a pin appended to a storyline gets: one past the highest, 0 for an empty one. */
export function nextStorylineOrder(pins: ReadonlyArray<{ storylineOrder: number | null }>): number {
  const orders = pins.map((p) => p.storylineOrder).filter((o): o is number => o !== null);
  return orders.length > 0 ? Math.max(...orders) + 1 : pins.length;
}
