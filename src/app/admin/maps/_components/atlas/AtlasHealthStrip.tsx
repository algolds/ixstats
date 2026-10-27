"use client";

import type { ReactNode } from "react";
import { api, type RouterOutputs } from "~/trpc/react";
import { Card } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Stat } from "~/components/ui/stat";
import { timeAgo } from "~/lib/format/compact";
import { formatBytes } from "./format";

export type AtlasTab = "realms" | "jobs" | "edits" | "style";

type Health = RouterOutputs["atlas"]["health"]["summary"];
type Figure = Health["storage"]["tiles"];

const STORAGE: Array<{ key: keyof Health["storage"]; label: string; tab: AtlasTab }> = [
  { key: "tiles", label: "Tiles", tab: "realms" },
  { key: "rasters", label: "Rasters", tab: "realms" },
  { key: "imports", label: "Import files", tab: "jobs" },
];

const CRON: Array<{ key: keyof Health["cron"]; tab: AtlasTab }> = [
  { key: "map-tiles", tab: "realms" },
  { key: "geo-profiles", tab: "realms" },
  { key: "map-import", tab: "jobs" },
];

const CRON_STATUS: Record<string, string> = {
  success: "succeeded",
  failed: "failed",
  skipped: "skipped",
};

function sizeText(figure: Figure): string {
  if (figure.bytes === null) return "Not measured";
  return figure.partial ? `${formatBytes(figure.bytes)} or more` : formatBytes(figure.bytes);
}

function cronText(run: Health["cron"][keyof Health["cron"]]): string {
  if (!run) return "Never ran";
  return `${CRON_STATUS[run.lastStatus] ?? run.lastStatus} ${timeAgo(run.lastRunAt)}`;
}

function StripItem({
  tab,
  onOpen,
  children,
}: {
  tab: AtlasTab;
  onOpen: (tab: AtlasTab) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(tab)}
      className="rounded-control focus-visible:outline-tint min-w-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}

/** Running and failed jobs, folder sizes and the last map cron runs; each item opens the tab that explains it. */
export function AtlasHealthStrip({ onOpenTab }: { onOpenTab: (tab: AtlasTab) => void }) {
  const { data, isLoading, error } = api.atlas.health.summary.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  if (isLoading) return <Skeleton className="rounded-card h-28 w-full" />;
  if (!data) {
    return (
      <p className="text-label-secondary text-footnote">
        {error?.message ?? "The health summary could not be read."}
      </p>
    );
  }

  return (
    <Card content="data" padding="md" aria-label="Map health" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StripItem tab="jobs" onOpen={onOpenTab}>
          <Stat
            size="sm"
            label="Running jobs"
            value={data.jobs.running}
            hint={`${data.jobs.queued} queued`}
          />
        </StripItem>
        <StripItem tab="jobs" onOpen={onOpenTab}>
          <Stat size="sm" label="Failed in 24 hours" value={data.jobs.failedLast24h} />
        </StripItem>
        {STORAGE.map(({ key, label, tab }) => (
          <StripItem key={key} tab={tab} onOpen={onOpenTab}>
            <Stat size="sm" label={label} value={sizeText(data.storage[key])} />
          </StripItem>
        ))}
      </div>
      <ul className="text-footnote text-label-secondary flex flex-wrap gap-x-6 gap-y-1">
        {CRON.map(({ key, tab }) => (
          <li key={key}>
            <StripItem tab={tab} onOpen={onOpenTab}>
              {key}: {cronText(data.cron[key])}
            </StripItem>
          </li>
        ))}
      </ul>
    </Card>
  );
}
