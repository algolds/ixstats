"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { ValueSelect } from "~/components/ui/value-select";
import { JobDetailSheet } from "./JobDetailSheet";
import { JobsTable } from "./JobsTable";
import { KIND_OPTIONS, STATUS_OPTIONS } from "./job-labels";

const ALL = "all";

type Kind = (typeof KIND_OPTIONS)[number][0];
type Status = (typeof STATUS_OPTIONS)[number][0];

const isActive = (status: string) => status === "running" || status === "queued";

/** Every map job across realms, newest first, filtered by realm, kind and status, with paging. */
export function AtlasJobsTab() {
  const [realm, setRealm] = useState(ALL);
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const realms = api.atlas.realms.overview.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const jobs = api.atlas.jobs.list.useInfiniteQuery(
    {
      realm: realm === ALL ? undefined : realm,
      kind: kind === ALL ? undefined : (kind as Kind),
      status: status === ALL ? undefined : (status as Status),
    },
    {
      retry: false,
      getNextPageParam: (last) => last.nextCursor ?? undefined,
      refetchInterval: (query) =>
        query.state.data?.pages.some((page) => page.jobs.some((job) => isActive(job.status)))
          ? 5000
          : false,
    }
  );
  const rows = jobs.data?.pages.flatMap((page) => page.jobs) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <ValueSelect
          aria-label="Realm"
          value={realm}
          onValueChange={setRealm}
          options={[
            [ALL, "All realms"],
            ...(realms.data?.realms ?? []).map((row) => [row.slug, row.name] as const),
          ]}
          className="w-44"
        />
        <ValueSelect
          aria-label="Kind"
          value={kind}
          onValueChange={setKind}
          options={[[ALL, "All kinds"], ...KIND_OPTIONS]}
          className="w-44"
        />
        <ValueSelect
          aria-label="Status"
          value={status}
          onValueChange={setStatus}
          options={[[ALL, "All statuses"], ...STATUS_OPTIONS]}
          className="w-44"
        />
      </div>
      {jobs.isLoading ? (
        <Skeleton className="rounded-card h-64 w-full" />
      ) : jobs.error ? (
        <p className="text-label-secondary text-body">{jobs.error.message}</p>
      ) : (
        <Card content="feed">
          {rows.length === 0 ? (
            <EmptyState
              compact
              title="No jobs"
              message="Jobs appear here when a map is imported or built."
            />
          ) : (
            <JobsTable jobs={rows} onOpen={setOpenJob} />
          )}
        </Card>
      )}
      {jobs.hasNextPage && (
        <Button
          variant="outline"
          className="self-start"
          disabled={jobs.isFetchingNextPage}
          onClick={() => void jobs.fetchNextPage()}
        >
          {jobs.isFetchingNextPage ? "Loading" : "Load more"}
        </Button>
      )}
      <JobDetailSheet jobId={openJob} onClose={() => setOpenJob(null)} />
    </div>
  );
}
