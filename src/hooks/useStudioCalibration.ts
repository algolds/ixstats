"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { StudioRealm } from "~/components/maps/studio/StudioContext";
import type { WorldGenerator, WorldGenResult } from "~/hooks/useWorldGenerator";
import type { WorldMeasures } from "~/lib/worldgen/measure-world";
import { api } from "~/trpc/react";

/** A request the world outran (see `useStudioDiagnostics`): dropped without a word, asked again for the new world. */
const OUTRUN = /world changed|was restarted|no world to draw/i;

type Source = Pick<WorldGenerator, "state" | "result" | "measure">;

export type WorldFigures =
  | { state: "none" }
  | { state: "measuring" }
  | { state: "ready"; measures: WorldMeasures }
  | { state: "failed"; error: string };

export type RealmFigures =
  | { slug: string; name: string; state: "loading" }
  | { slug: string; name: string; state: "ready"; measures: WorldMeasures; mapVersion: number }
  /** The server answered `ok: false`: the realm has nothing to measure (the reason is its own words) */
  | { slug: string; name: string; state: "unmeasurable"; reason: string }
  | { slug: string; name: string; state: "failed"; reason: string };

export interface StudioCalibration {
  world: WorldFigures;
  /** The realms compared with, in column order (one or two) */
  columns: RealmFigures[];
  /** The slugs chosen for the two slots; the second may be empty */
  chosen: readonly [string | null, string | null];
  choose: (slot: 0 | 1, slug: string | null) => void;
  /** Measure the world again after a failure */
  retry: () => void;
}

/** Ixnay and Eurth, when the Studio knows them. */
function defaultChoice(realms: readonly StudioRealm[]): [string | null, string | null] {
  return [
    realms.find((realm) => realm.isIxnay)?.slug ?? null,
    realms.find((realm) => realm.slug === "eurth")?.slug ?? null,
  ];
}

type Outcome =
  { of: WorldGenResult; measures: WorldMeasures } | { of: WorldGenResult; error: string };

/**
 * The figures the Calibration tab compares: the generated world's, measured by the worker (never on this thread) and
 * asked for again whenever a new world lands, and one or two realms', measured on the server from their stored maps.
 */
export function useStudioCalibration(
  { state, result, measure }: Source,
  realms: readonly StudioRealm[]
): StudioCalibration {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [picked, setPicked] = useState<[string | null, string | null] | null>(null);

  const settled = state === "ready" && result !== null;
  useEffect(() => {
    if (!settled) return;
    let current = true;
    measure().then(
      (measures) => {
        if (current) setOutcome({ of: result, measures });
      },
      (error: Error) => {
        if (current && !OUTRUN.test(error.message))
          setOutcome({ of: result, error: error.message });
      }
    );
    return () => {
      current = false;
    };
  }, [settled, result, measure, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const chosen = picked ?? defaultChoice(realms);
  const choose = useCallback(
    (slot: 0 | 1, slug: string | null) =>
      setPicked((now) => {
        const next: [string | null, string | null] = [...(now ?? defaultChoice(realms))];
        next[slot] = slug;
        return next;
      }),
    [realms]
  );

  const slugs = chosen.filter((slug): slug is string => slug !== null);
  const queries = api.useQueries((t) =>
    slugs.map((realm) =>
      t.atlas.studio.realmMeasures({ realm }, { retry: false, staleTime: 60_000 })
    )
  );
  const columns = slugs.map<RealmFigures>((slug, index) => {
    const name = realms.find((realm) => realm.slug === slug)?.name ?? slug;
    const query = queries[index];
    if (query?.isError) return { slug, name, state: "failed", reason: query.error.message };
    const data = query?.data;
    if (!data) return { slug, name, state: "loading" };
    if (!data.ok) return { slug, name, state: "unmeasurable", reason: data.reason };
    return { slug, name, state: "ready", measures: data.measures, mapVersion: data.mapVersion };
  });

  const world = useMemo<WorldFigures>(() => {
    if (!result) return { state: "none" };
    if (outcome?.of !== result) return { state: "measuring" };
    return "error" in outcome
      ? { state: "failed", error: outcome.error }
      : { state: "ready", measures: outcome.measures };
  }, [result, outcome]);

  return { world, columns, chosen, choose, retry };
}
