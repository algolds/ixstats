"use client";

import { useState } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { NationOverride, OrganizationOverride } from "~/lib/realms/sources/config";
import { nextRunAt } from "~/lib/realms/sources/schedule";
import { SourceSettingsForm } from "./SourceSettingsForm";
import { SyncDiffView } from "./SyncDiffView";
import { SyncRunHistory } from "./SyncRunHistory";

export type SourceSyncView = RouterOutputs["realms"]["sourceSync"]["get"];
export type SyncRun = SourceSyncView["runs"][number];

/** Staff decisions for one source key, sent as they are made (the dry run lists offer them). */
export interface OverrideActions {
  nation: (key: string, next: NationOverride | null) => void;
  organization: (key: string, next: OrganizationOverride | null) => void;
  pending: boolean;
}

const STATUS_TONE: Record<string, "success" | "warning" | "destructive" | "default"> = {
  success: "success",
  partial: "warning",
  failed: "destructive",
  running: "default",
};

export function RunStatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_TONE[status] ?? "default"}>{status}</Badge>;
}

/**
 * A realm's source sync: where its nations come from, what a run may change, its schedule and continent table,
 * dry runs (the diff) and applied runs, and the run history. Shown in /admin/realms (site admins) and in the
 * realm's Manage tab (its founder).
 */
export function SourceSyncPanel({ slug }: { slug: string }) {
  const notify = useNotify();
  const utils = api.useUtils();
  const [formKey, setFormKey] = useState(0);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const { data: view, isLoading, error } = api.realms.sourceSync.get.useQuery(
    { slug },
    {
      retry: false,
      // Follow a running apply until it finishes.
      refetchInterval: (query) =>
        query.state.data?.runs.some((run) => run.status === "running") ? 4000 : false,
    }
  );
  const refresh = () => void utils.realms.sourceSync.get.invalidate({ slug });
  const dryRun = api.realms.sourceSync.dryRun.useMutation({
    onSuccess: (outcome) => {
      setSelectedRunId(outcome.runId);
      if (outcome.status === "failed") notify.error("Dry run failed", outcome.errors[0] ?? "");
      else notify.success("Dry run finished", "The diff is below. Nothing was written.");
    },
    onError: (e) => notify.error("Dry run failed", e.message),
    onSettled: refresh,
  });
  const apply = api.realms.sourceSync.startApply.useMutation({
    onSuccess: ({ runId }) => {
      setSelectedRunId(runId);
      notify.info("Sync started", "It runs in the background; its result appears in the run history.");
    },
    onError: (e) => notify.error("Could not start the sync", e.message),
    onSettled: refresh,
  });
  const setOverride = api.realms.sourceSync.setOverride.useMutation({
    onError: (e) => notify.error("Could not save that decision", e.message),
    onSettled: refresh,
  });
  const overrides: OverrideActions = {
    nation: (key, override) => setOverride.mutate({ kind: "nation", slug, key, override }),
    organization: (key, override) => setOverride.mutate({ kind: "organization", slug, key, override }),
    pending: setOverride.isPending,
  };

  if (isLoading) return <p className="text-label-secondary text-body">Loading the source sync…</p>;
  if (!view) return <p className="text-label-secondary text-body">{error?.message ?? "Not available."}</p>;

  const runs = view.runs;
  const running = runs.some((run) => run.status === "running");
  const selected = runs.find((run) => run.id === selectedRunId) ?? runs.find((run) => run.summary) ?? null;
  const next = view.config ? nextRunAt(view.config, new Date()) : null;

  return (
    <div className="flex flex-col gap-6">
      <SourceSettingsForm
        key={formKey}
        slug={slug}
        view={view}
        onSaved={() => {
          setFormKey((k) => k + 1);
          refresh();
        }}
      />

      {view.config && (
        <section className="border-separator bg-surface rounded-card flex flex-col gap-3 border p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-label text-headline">Run</h3>
              <p className="text-label-secondary text-footnote">
                {view.config.lastRunAt
                  ? `Last applied ${new Date(view.config.lastRunAt).toLocaleString()}`
                  : "Never applied."}
                {view.config.lastStatus && <> · last status {view.config.lastStatus}</>}
                {next ? ` · next scheduled run ${next.toLocaleString()}` : " · no schedule"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={dryRun.isPending || running}
                onClick={() => dryRun.mutate({ slug })}
              >
                {dryRun.isPending ? "Reading the source…" : "Dry run"}
              </Button>
              <Button size="sm" disabled={apply.isPending || running} onClick={() => apply.mutate({ slug })}>
                {running ? "Sync running…" : "Apply"}
              </Button>
            </div>
          </div>
          <p className="text-label-secondary text-footnote">
            A dry run reads the source and shows what would change. Apply writes it: new nations are created
            unclaimed, figures and borders are updated as the options allow, and alliances gain their listed
            members. Nothing is ever deleted and no claimed nation changes hands.
          </p>
        </section>
      )}

      {selected?.summary && (
        <SyncDiffView
          run={selected}
          overrides={overrides}
          config={view.config}
          countries={view.countries}
        />
      )}

      <SyncRunHistory runs={runs} selectedId={selected?.id ?? null} onSelect={setSelectedRunId} />
    </div>
  );
}
