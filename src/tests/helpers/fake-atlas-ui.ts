/**
 * A stand-in for the `atlas.*` tRPC pieces the Atlas admin UI reads and calls. A test sets `state` (what the queries
 * answer) and reads `calls` (every mutation, in order, with its input). Mutations answer with `responses[name]` and
 * run the component's `onSuccess`.
 *
 * Use it from a `jest.mock("~/trpc/react", ...)` factory: `jest.requireActual("~/tests/helpers/fake-atlas-ui")`.
 */
import type { RouterOutputs } from "~/trpc/react";

type Atlas = RouterOutputs["atlas"];
export type RealmRow = Atlas["realms"]["overview"]["realms"][number];
export type JobRow = Atlas["jobs"]["list"]["jobs"][number];
export type Health = Atlas["health"]["summary"];

export const realmRow = (over: Partial<RealmRow> = {}): RealmRow => ({
  id: "r_eurth",
  slug: "eurth",
  name: "Eurth",
  status: "active",
  visibility: "public",
  mapVersion: 4,
  layers: { present: 7, total: 7, missing: [] },
  relief: "built",
  linkage: { linked: 10, total: 10 },
  nations: { total: 12, owned: 5, open: 6, reserved: 1 },
  pendingClaims: 0,
  lastJob: null,
  invalidGeometry: 0,
  flags: [],
  ...over,
});

export const jobRow = (over: Partial<JobRow> = {}): JobRow => ({
  id: "job_1",
  realm: { id: "r_eurth", slug: "eurth", name: "Eurth" },
  kind: "png",
  status: "succeeded",
  progress: 100,
  stage: null,
  dryRun: false,
  error: null,
  filename: "eurth.png",
  parentJobId: null,
  requestedBy: "admin_1",
  createdAt: new Date("2026-10-12T08:00:00Z"),
  startedAt: null,
  finishedAt: null,
  canCancel: false,
  canRetry: false,
  retryAs: "apply",
  retryBlocked: null,
  importId: null,
  canRollBack: false,
  ...over,
});

const figure = (bytes: number | null, partial = false) => ({
  bytes,
  partial,
  measuredAt: new Date("2026-10-12T08:00:00Z"),
});

export const healthSummary = (over: Partial<Health> = {}): Health => ({
  jobs: { running: 2, queued: 1, failedLast24h: 3 },
  storage: { tiles: figure(2048), rasters: figure(null), imports: figure(5 * 1024 * 1024, true) },
  cron: {
    "map-tiles": {
      lastRunAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
      lastStatus: "success",
      lastSuccessAt: null,
    },
    "geo-profiles": null,
    "map-import": {
      lastRunAt: new Date(Date.now() - 600_000).toISOString(),
      lastStatus: "failed",
      lastSuccessAt: null,
    },
  },
  ...over,
});

export interface AtlasState {
  health: Health | undefined;
  overview: { realms: RealmRow[]; partial: boolean } | undefined;
  /** The pages `atlas.jobs.list` answers to an infinite query */
  jobPages: Array<{ jobs: JobRow[]; nextCursor: string | null }>;
  /** What `atlas.jobs.list` answers to a plain query (the realm page) */
  recentJobs: JobRow[];
  jobDetail: (JobRow & { result: object | null; retryNote: string }) | undefined;
  realm: Atlas["realms"]["get"] | undefined;
  realmError: string | null;
}

export const state: AtlasState = {
  health: undefined,
  overview: undefined,
  jobPages: [],
  recentJobs: [],
  jobDetail: undefined,
  realm: undefined,
  realmError: null,
};

export const calls: Array<[name: string, input: object]> = [];
export const responses: Record<string, object> = {};
/** The inputs the list queries were asked with */
export const listInputs: object[] = [];
export const fetchNextPage = jest.fn();
export const invalidate = jest.fn();

export function resetFakeAtlas() {
  state.health = undefined;
  state.overview = undefined;
  state.jobPages = [];
  state.recentJobs = [];
  state.jobDetail = undefined;
  state.realm = undefined;
  state.realmError = null;
  calls.length = 0;
  listInputs.length = 0;
  fetchNextPage.mockClear();
  invalidate.mockClear();
  Object.keys(responses).forEach((key) => delete responses[key]);
}

function mutation(name: string) {
  return {
    useMutation: (opts?: { onSuccess?: (data: object, input: object) => void }) => ({
      mutate: (input: object) => {
        calls.push([name, input]);
        opts?.onSuccess?.(responses[name] ?? {}, input);
      },
      isPending: false,
    }),
  };
}

const query = (read: () => object | undefined) => ({
  useQuery: () => ({ data: read(), isLoading: false, error: null }),
});

const utils = (): object =>
  new Proxy(() => undefined, {
    get: (_target, prop) => (prop === "invalidate" ? invalidate : utils()),
  });

export const api = {
  useUtils: utils,
  atlas: {
    health: { summary: query(() => state.health) },
    realms: {
      overview: query(() => state.overview),
      get: {
        useQuery: () => ({
          data: state.realm,
          isLoading: false,
          error: state.realmError ? { message: state.realmError } : null,
        }),
      },
      refresh: mutation("atlas.realms.refresh"),
    },
    jobs: {
      list: {
        useQuery: (input: object) => {
          listInputs.push(input);
          return { data: { jobs: state.recentJobs, nextCursor: null } };
        },
        useInfiniteQuery: (input: object) => {
          listInputs.push(input);
          const last = state.jobPages.at(-1);
          return {
            data: { pages: state.jobPages },
            isLoading: false,
            error: null,
            hasNextPage: !!last?.nextCursor,
            isFetchingNextPage: false,
            fetchNextPage,
          };
        },
      },
      get: query(() => state.jobDetail),
      cancel: mutation("atlas.jobs.cancel"),
      retry: mutation("atlas.jobs.retry"),
      rollback: mutation("atlas.jobs.rollback"),
    },
  },
  geoEditor: { mapImport: { rebuildRelief: mutation("geoEditor.mapImport.rebuildRelief") } },
};
