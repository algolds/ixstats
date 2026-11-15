// src/lib/wiki-os/wiki-source-availability.ts
// The wikis a feature can take a page from, and whether each can answer right now. One list (IxWiki first, then the
// sister wikis WikiOS reads), one label per wiki, and one rule for pickers: a wiki that cannot answer is listed but
// disabled, with a short reason, and is never the selected one. Pure and client-safe: the IIWiki switch and the
// breaker are read on the server (`getIiwikiAvailability`, `wikios.iiwikiAvailability`) and arrive here as data.

import { z } from "zod";
import { WIKI_SOURCES, type WikiSource } from "./config";
import type { IiwikiFeature, IiwikiSwitchState } from "./iiwiki-switch";
import { SISTER_READER_IDS } from "./wiki-hosts";

/** Every wiki a page can be taken from, in the order pickers list them: IxWiki, then the sister wikis. */
export const WIKI_SOURCE_IDS: readonly [WikiSource, ...WikiSource[]] = [
  "ixwiki",
  ...SISTER_READER_IDS,
];

export const wikiSourceSchema = z.enum(WIKI_SOURCE_IDS);

/** How a picker names a wiki: IxWiki is "Wiki" inside IxStates, a sister wiki keeps its own name. */
export function wikiSourceLabel(source: WikiSource): string {
  return WIKI_SOURCES[source].name;
}

/** Why IIWiki gives no answer: an administrator switched it off, or its breaker is open after failures. */
export type IiwikiUnavailableReason = "disabled" | "resting";

/** Per IIWiki switch feature: null when IIWiki answers for it, else why not. Nothing else leaves the server. */
export type IiwikiAvailability = Record<IiwikiFeature, IiwikiUnavailableReason | null>;

/** The breaker as `upstreamGuard.circuitStatus` reports it: only its state and how long it still rests. */
export interface IiwikiCircuit {
  state: "closed" | "open" | "probing";
  retryInMs: number;
}

/**
 * Whether the breaker refuses a call now: while it rests, or while its one probe is out. An open breaker whose rest
 * is over admits the next call as its probe, so a picker offers IIWiki again then.
 */
const circuitRefuses = (circuit: IiwikiCircuit) =>
  circuit.state === "probing" || (circuit.state === "open" && circuit.retryInMs > 0);

/**
 * The availability of each feature under `state` and the breaker. The switch is said first: a feature that is
 * switched off stays off whatever the breaker does.
 */
export function iiwikiAvailability(
  state: IiwikiSwitchState,
  circuit: IiwikiCircuit
): IiwikiAvailability {
  const resting = circuitRefuses(circuit);
  const features = Object.keys(state.features) as IiwikiFeature[];
  return Object.fromEntries(
    features.map((id): [IiwikiFeature, IiwikiUnavailableReason | null] => {
      if (!state.enabled || !state.features[id]) return [id, "disabled"];
      return [id, resting ? "resting" : null];
    })
  ) as IiwikiAvailability;
}

/** What a picker says under a wiki it cannot offer (the words of `WikiUnavailableError`). */
export function unavailableReasonText(reason: IiwikiUnavailableReason): string {
  return reason === "disabled"
    ? "IIWiki is switched off for now."
    : "IIWiki could not be reached just now.";
}

export interface WikiSourceOption {
  value: WikiSource;
  label: string;
  disabled: boolean;
  /** Why the wiki is disabled, in a sentence; null when it can be picked. */
  reason: string | null;
}

/**
 * The picker's options for `feature`. Only IIWiki has a switch; until the availability has loaded (`undefined`)
 * every wiki can be picked, and a refused call then says why itself.
 */
export function wikiSourceOptions(
  sources: readonly WikiSource[],
  availability: IiwikiAvailability | undefined,
  feature: IiwikiFeature
): WikiSourceOption[] {
  return sources.map((value) => {
    const why = value === "iiwiki" ? (availability?.[feature] ?? null) : null;
    return {
      value,
      label: wikiSourceLabel(value),
      disabled: why !== null,
      reason: why ? unavailableReasonText(why) : null,
    };
  });
}

/** The wiki a picker shows as selected: the picked one while it can be picked, else the first that can. */
export function selectedWikiSource(
  picked: WikiSource | null | undefined,
  options: readonly WikiSourceOption[]
): WikiSource {
  const usable = options.filter((option) => !option.disabled);
  return (
    usable.find((option) => option.value === picked)?.value ??
    usable[0]?.value ??
    options[0]?.value ??
    "ixwiki"
  );
}

/** A failed read's message when its wiki could not answer (tRPC 503, 429 or the Exchange's 412), else `fallback`. */
export function wikiReadErrorText(
  error: { message?: string; data?: { code?: string } | null } | null | undefined,
  fallback: string
): string {
  const code = error?.data?.code;
  const outage =
    code === "SERVICE_UNAVAILABLE" ||
    code === "TOO_MANY_REQUESTS" ||
    code === "PRECONDITION_FAILED";
  return outage && error?.message ? error.message : fallback;
}
