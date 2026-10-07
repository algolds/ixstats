"use client";

import { Button } from "~/components/ui/button";
import { RunStatusBadge, type SyncRun } from "./SourceSyncPanel";

const who = (triggeredBy: string) =>
  triggeredBy === "cron" ? "schedule" : triggeredBy === "script" ? "script" : "staff";

/** The realm's last runs, newest first; choosing one shows its diff above. */
export function SyncRunHistory({
  runs,
  selectedId,
  onSelect,
}: {
  runs: SyncRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border-separator bg-surface rounded-card border p-4 md:p-6">
      <h3 className="text-label text-headline mb-3">Run history</h3>
      {runs.length === 0 ? (
        <p className="text-label-secondary text-body">No runs yet. Start with a dry run.</p>
      ) : (
        <ul className="divide-separator divide-y">
          {runs.map((run) => {
            const counts = run.summary?.counts;
            return (
              <li key={run.id} className="flex flex-wrap items-center gap-3 py-2">
                <RunStatusBadge status={run.status} />
                <span className="text-label text-footnote">{run.dryRun ? "Dry run" : "Applied"}</span>
                <span className="text-label-secondary text-footnote">
                  {new Date(run.startedAt).toLocaleString()} · by {who(run.triggeredBy)}
                </span>
                {counts && (
                  <span className="text-label-secondary text-footnote">
                    {counts.create} new · {counts.update} changed · {counts.features} borders ·{" "}
                    {counts.alliances} alliances · {counts.unmatched} unmatched
                  </span>
                )}
                {run.errors[0] && (
                  <span className="text-destructive-ink text-footnote">{run.errors[0]}</span>
                )}
                {run.summary && (
                  <Button
                    size="xs"
                    variant={selectedId === run.id ? "secondary" : "ghost"}
                    className="ml-auto"
                    onClick={() => onSelect(run.id)}
                  >
                    {selectedId === run.id ? "Showing" : "Show diff"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
