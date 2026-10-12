/**
 * A stand-in for the tRPC pieces the World tab's apply flow uses (`geoEditor.mapImport.start`, `.applyWorld`,
 * `.rebuildRelief`, `.job`, and the cache's `invalidate`). Jobs are set by the test and read through a store, so a
 * test moves a job along and the component that polls it renders again, the way the real query does. `calls` logs
 * the order of the server calls.
 *
 * Use it from a `jest.mock("~/trpc/react", ...)` factory: `jest.requireActual("~/tests/helpers/fake-map-import")`.
 */
import { useSyncExternalStore } from "react";

export interface FakeCallError {
  message: string;
  data?: { code: string };
}

type JobView = Record<string, unknown>;

const jobs = new Map<string, JobView>();
const readErrors = new Map<string, FakeCallError>();
const listeners = new Set<() => void>();
let revision = 0;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const emit = () => {
  revision += 1;
  listeners.forEach((listener) => listener());
};

/** The server calls in the order they were made ("upload" is logged by the test's fetch). */
export const calls: string[] = [];

export const start = jest.fn();
export const applyWorld = jest.fn();
export const rebuildRelief = jest.fn();
export const invalidated = {
  version: jest.fn(),
  display: jest.fn(),
  worldStatus: jest.fn(),
};
/** The job ids the component asked the job query for, with whether it was enabled */
export const jobReads: Array<{ jobId: string; enabled: boolean }> = [];

export function setJob(id: string, job: JobView) {
  jobs.set(id, { id, ...job });
  emit();
}
export function failRead(id: string, error: FakeCallError) {
  readErrors.set(id, error);
  emit();
}
export function resetFakeMapImport() {
  jobs.clear();
  readErrors.clear();
  calls.length = 0;
  jobReads.length = 0;
  for (const fn of [start, applyWorld, rebuildRelief, ...Object.values(invalidated)])
    fn.mockReset();
}

const logged = (name: string, fn: jest.Mock) => ({
  mutateAsync: (input: object) => {
    calls.push(name);
    return fn(input) as Promise<object>;
  },
});

export const geoEditor = {
  mapImport: {
    start: { useMutation: () => logged("start", start) },
    applyWorld: { useMutation: () => logged("applyWorld", applyWorld) },
    rebuildRelief: { useMutation: () => logged("rebuildRelief", rebuildRelief) },
    job: {
      useQuery: (input: { jobId: string }, options?: { enabled?: boolean }) => {
        useSyncExternalStore(
          subscribe,
          () => revision,
          () => revision
        );
        const enabled = options?.enabled ?? true;
        jobReads.push({ jobId: input.jobId, enabled });
        return {
          data: enabled ? jobs.get(input.jobId) : undefined,
          error: enabled ? (readErrors.get(input.jobId) ?? null) : null,
        };
      },
    },
  },
};

export const useUtils = () => ({
  realms: {
    map: {
      version: { invalidate: invalidated.version },
      display: { invalidate: invalidated.display },
      worldStatus: { invalidate: invalidated.worldStatus },
    },
  },
});
