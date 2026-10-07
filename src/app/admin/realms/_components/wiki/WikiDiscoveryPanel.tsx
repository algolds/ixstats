"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { WikiMapCandidates } from "./WikiMapCandidates";
import type { RealmWikiView } from "./RealmWikiPanel";

type StepOutput = RouterOutputs["realms"]["wiki"]["discover"];
type RosterData = Extract<StepOutput, { kind: "roster" }>["data"];
type NationHint = Extract<StepOutput, { kind: "hints" }>["data"][number];
type MapData = Extract<StepOutput, { kind: "maps" }>["data"];
type Stop = StepOutput["stopped"];

interface Progress {
  roster: RosterData | null;
  hints: NationHint[];
  /** How many roster nations have been read (the next hints batch starts here). */
  nextIndex: number;
  maps: MapData | null;
  stopped: Stop;
  requests: number;
}

const EMPTY: Progress = { roster: null, hints: [], nextIndex: 0, maps: null, stopped: null, requests: 0 };

/**
 * "Discover from wiki": the roster, each nation's infobox hints (in batches, with progress) and the candidate
 * world maps, read step by step. A step the wiki refuses keeps what was read; Continue picks up from there.
 */
export function WikiDiscoveryPanel({ slug, view }: { slug: string; view: RealmWikiView }) {
  const notify = useNotify();
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [running, setRunning] = useState<string | null>(null);
  const discover = api.realms.wiki.discover.useMutation();

  /** Runs every remaining step from `start`; stops at the first refusal or error. */
  const run = async (start: Progress) => {
    let state: Progress = { ...start, stopped: null };
    const commit = (next: Progress) => {
      state = next;
      setProgress(next);
    };
    try {
      if (!state.roster) {
        setRunning("Reading the roster…");
        const step = await discover.mutateAsync({ slug, step: { kind: "roster" } });
        if (step.kind !== "roster") return;
        commit({ ...state, roster: step.data, stopped: step.stopped, requests: state.requests + step.requests });
        if (step.stopped) return;
      }
      const nations = state.roster?.nations ?? [];
      while (state.nextIndex < nations.length) {
        setRunning(`Reading nation pages ${state.nextIndex + 1} to ${Math.min(nations.length, state.nextIndex + view.hintBatch)} of ${nations.length}…`);
        const titles = nations.slice(state.nextIndex, state.nextIndex + view.hintBatch);
        const step = await discover.mutateAsync({ slug, step: { kind: "hints", titles } });
        if (step.kind !== "hints") return;
        const read = new Set(step.data.map((hint) => hint.title));
        // A stopped batch keeps the pages it read; the rest of the batch is read again on Continue.
        const advance = step.stopped ? titles.findIndex((title) => !read.has(title)) : titles.length;
        commit({
          ...state,
          hints: [...state.hints, ...step.data],
          nextIndex: state.nextIndex + (advance === -1 ? titles.length : advance),
          stopped: step.stopped,
          requests: state.requests + step.requests,
        });
        if (step.stopped) return;
      }
      setRunning("Looking for world maps…");
      const exclude = state.hints.flatMap((hint) =>
        [hint.flag, hint.coatOfArms, ...hint.mapFiles].filter((file): file is string => !!file)
      );
      const step = await discover.mutateAsync({ slug, step: { kind: "maps", exclude: exclude.slice(0, 1500) } });
      if (step.kind !== "maps") return;
      commit({ ...state, maps: step.data, stopped: step.stopped, requests: state.requests + step.requests });
    } catch (error) {
      notify.error("Discovery failed", error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(null);
    }
  };

  const { roster, hints, maps, stopped } = progress;
  const withInfobox = hints.filter((hint) => hint.hasInfobox);
  const missing = hints.filter((hint) => hint.missing);
  const withoutInfobox = hints.filter((hint) => !hint.hasInfobox && !hint.missing);
  const withCoords = hints.filter((hint) => hint.capitalCoordinates);
  const started = roster !== null;
  const finished = maps !== null && !stopped;

  return (
    <section className="border-separator bg-surface rounded-card flex flex-col gap-4 border p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-label text-headline">Discover from wiki</h3>
          <p className="text-label-secondary text-footnote">
            Reads the roster, each nation&apos;s infobox and the world&apos;s map files, a few requests at a time.
            Nothing is written until you choose a map.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stopped && !running && (
            <Button size="sm" variant="outline" onClick={() => void run(progress)}>
              Continue
            </Button>
          )}
          <Button size="sm" disabled={running !== null} onClick={() => void run(EMPTY)}>
            {running ? "Discovering…" : started ? "Run again" : "Discover"}
          </Button>
        </div>
      </div>

      {running && (
        <p role="status" className="text-label-secondary text-footnote">
          {running}
        </p>
      )}

      {stopped && (
        <div role="alert" className="bg-warning/15 rounded-row flex flex-col gap-1 p-3">
          <span className="text-warning-ink text-body">
            {stopped.kind === "blocked" || stopped.kind === "rate-limited"
              ? "The wiki stopped answering part-way. What was read is shown below."
              : "Discovery stopped early. What was read is shown below."}
          </span>
          <span className="text-label-secondary text-footnote">
            {stopped.message} (while reading the {stopped.phase}). Press Continue to pick up from there.
          </span>
        </div>
      )}

      {roster && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{roster.nations.length} nations</Badge>
            <span className="text-label-secondary text-footnote">
              {roster.method === "roster" ? `from ${roster.category}` : "found by their infobox (capped crawl)"}
              {roster.truncated && ", list cut short by the discovery caps"}
            </span>
          </div>
          {roster.suspects.length > 0 && (
            <p className="text-warning-ink text-footnote">
              {roster.suspects.length} roster entries look like a category of pages rather than a nation:{" "}
              {roster.suspects.join(", ")}
            </p>
          )}
          {hints.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">{withInfobox.length} with an infobox</Badge>
              <Badge variant={withoutInfobox.length ? "warning" : "default"}>
                {withoutInfobox.length} without
              </Badge>
              {missing.length > 0 && <Badge variant="destructive">{missing.length} pages missing</Badge>}
              <Badge variant="default">{withCoords.length} with capital coordinates</Badge>
              <span className="text-label-secondary text-footnote">
                {progress.nextIndex} of {roster.nations.length} pages read
              </span>
            </div>
          )}
          {withoutInfobox.length + missing.length > 0 && (
            <details className="text-footnote">
              <summary className="text-label-secondary cursor-pointer">Nations without an infobox</summary>
              <p className="text-label-secondary mt-1">
                {[...withoutInfobox.map((h) => h.title), ...missing.map((h) => `${h.title} (missing)`)].join(", ")}
              </p>
            </details>
          )}
        </div>
      )}

      {maps && <WikiMapCandidates slug={slug} maps={maps} chosen={view.map?.source.fileTitle ?? null} />}

      {finished && (
        <p className="text-label-secondary text-footnote">Done in {progress.requests} requests.</p>
      )}
    </section>
  );
}
