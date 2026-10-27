"use client";

import { FACTORY_PRESETS, type WorldPresetOption } from "~/lib/worldgen/world-presets";
import { api } from "~/trpc/react";

export interface WorldPresets {
  /** Null while they load */
  presets: readonly WorldPresetOption[] | null;
  /** The built-ins from code stand in because the published presets could not be read */
  fallback: boolean;
}

/**
 * One more try after a failure, unless the server answered with a client error (FORBIDDEN, NOT_FOUND, ...): asking
 * again cannot change that answer.
 */
export function retryPresets(
  failures: number,
  error: { data?: { httpStatus?: number } | null }
): boolean {
  const status = error.data?.httpStatus ?? 0;
  return failures < 1 && !(status >= 400 && status < 500);
}

/**
 * The presets the World tab offers: the published, unarchived ones from the database, in the admin's order. If they
 * cannot be read, the three built-ins from code stand in (`fallback`), so a founder can still make a world; the
 * recipe is not saved meanwhile, since the stand-in is not the founder's choice. Every caller shares one query, which
 * is read again each time the tab opens (the default staleTime holds it fresh for 30 seconds). The server hands them
 * to the realm's map editors only, so the realm is named; a tab with no realm slug has no one to ask.
 */
export function useWorldPresets(realmSlug: string | null): WorldPresets {
  const query = api.realms.map.worldPresets.useQuery(
    { realm: realmSlug ?? "" },
    { enabled: !!realmSlug, retry: retryPresets }
  );
  if (!realmSlug) return { presets: FACTORY_PRESETS, fallback: true };
  if (query.data) return { presets: query.data, fallback: false };
  return query.isError
    ? { presets: FACTORY_PRESETS, fallback: true }
    : { presets: null, fallback: false };
}
