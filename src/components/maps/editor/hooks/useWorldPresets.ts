"use client";

import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import { api } from "~/trpc/react";

/**
 * The presets the World tab offers: the published, unarchived ones from the database, in the admin's order. Null
 * while they load. If they cannot be read, the three built-ins from code stand in, so a founder can still make a
 * world. Every caller shares one query, which is read again each time the tab opens (the default staleTime holds it
 * fresh for 30 seconds).
 */
export function useWorldPresets(): readonly WorldPresetOption[] | null {
  const query = api.realms.map.worldPresets.useQuery(undefined, { retry: 1 });
  if (query.data) return query.data;
  return query.isError ? FACTORY_PRESETS : null;
}
