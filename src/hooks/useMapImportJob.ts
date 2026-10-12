"use client";

import { api, type RouterOutputs } from "~/trpc/react";

export type MapImportJobView = RouterOutputs["geoEditor"]["mapImport"]["job"];
export type MapImportContext = RouterOutputs["geoEditor"]["mapImport"]["context"];
export type MapImportDiff = RouterOutputs["geoEditor"]["mapImport"]["preview"];

const ACTIVE = new Set(["queued", "running"]);

/**
 * A map import job, polled every second while it is queued or running. A job that cannot be read at all (the first
 * read failed) is not polled again: asking every second would not change the answer.
 */
export function useMapImportJob(jobId: string | null) {
  return api.geoEditor.mapImport.job.useQuery(
    { jobId: jobId ?? "" },
    {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const { data, status } = query.state;
        if (!data && status === "error") return false;
        return ACTIVE.has(data?.status ?? "queued") ? 1000 : false;
      },
    }
  );
}

export const isJobActive = (job: MapImportJobView | undefined) => !!job && ACTIVE.has(job.status);
