/**
 * What the country page's entry points already know when they open the lore writer
 * (docs/specs/2026-10-24-native-lore-design.md, "Writing flow"): "Write about this place" on a region,
 * city or story pin seeds a Place with its title and, when the map has it, its location; "Write about this event" on
 * a History entry seeds an Event with its title and date. Pure.
 */
import type { LoreFieldSeed } from "./lore-prefill";
import type { LoreType } from "./lore-types";

export interface LoreSeed extends LoreFieldSeed {
  type: LoreType;
  title: string;
}

type LngLat = readonly [number, number] | null;

/** A place on the map: a region has no point; a city or pin has one when the map stores it. */
export function placeSeed(
  title: string,
  point: LngLat = null,
  subdivision: string | null = null
): LoreSeed {
  if (!point) return { type: "place", title };
  const [lng, lat] = point;
  return {
    type: "place",
    title,
    place: subdivision ? { lng, lat, subdivision } : { lng, lat },
  };
}

/** A History entry: its title and the date it reads on the timeline. */
export function eventSeed(title: string, date: string): LoreSeed {
  return { type: "event", title, date };
}
