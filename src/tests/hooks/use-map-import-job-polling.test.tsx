/**
 * The map import job query under real React Query: it polls every second while the job runs, and not after it is
 * over, after the component is gone, or when the job could not be read at all.
 */
import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// The job query of tRPC, replaced by React Query itself with the options the hook passes
jest.mock("~/trpc/react", () => {
  const { useQuery } = jest.requireActual("@tanstack/react-query");
  const fetchJob = jest.fn();
  return {
    fetchJob,
    api: {
      geoEditor: {
        mapImport: {
          job: {
            useQuery: (input: { jobId: string }, options: object) =>
              useQuery({
                queryKey: ["job", input.jobId],
                queryFn: () => fetchJob(input.jobId),
                ...options,
              }),
          },
        },
      },
    },
  };
});

import { useMapImportJob } from "~/hooks/useMapImportJob";

const { fetchJob } = jest.requireMock("~/trpc/react") as { fetchJob: jest.Mock };

let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const tick = (ms: number) => act(async () => void (await jest.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  jest.useFakeTimers();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  fetchJob.mockReset();
});
afterEach(() => {
  client.clear();
  jest.useRealTimers();
});

describe("useMapImportJob polling", () => {
  it("asks again every second while the job runs, and stops once it has succeeded", async () => {
    fetchJob.mockResolvedValue({ status: "running" });
    renderHook(() => useMapImportJob("j1"), { wrapper });
    await tick(0);
    expect(fetchJob).toHaveBeenCalledTimes(1);
    await tick(3000);
    expect(fetchJob.mock.calls.length).toBeGreaterThanOrEqual(4);

    fetchJob.mockResolvedValue({ status: "succeeded" });
    await tick(1000);
    const settled = fetchJob.mock.calls.length;
    await tick(10_000);
    expect(fetchJob).toHaveBeenCalledTimes(settled);
  });

  it("stops asking when the component is gone", async () => {
    fetchJob.mockResolvedValue({ status: "running" });
    const { unmount } = renderHook(() => useMapImportJob("j1"), { wrapper });
    await tick(2000);
    unmount();
    const before = fetchJob.mock.calls.length;
    await tick(10_000);
    expect(fetchJob).toHaveBeenCalledTimes(before);
  });

  it("asks about another job when the id changes, and about none without one", async () => {
    fetchJob.mockResolvedValue({ status: "succeeded" });
    const { rerender } = renderHook(({ id }: { id: string | null }) => useMapImportJob(id), {
      wrapper,
      initialProps: { id: null as string | null },
    });
    await tick(2000);
    expect(fetchJob).not.toHaveBeenCalled();
    rerender({ id: "j2" });
    await tick(0);
    expect(fetchJob).toHaveBeenCalledWith("j2");
    rerender({ id: null });
    await tick(5000);
    expect(fetchJob).toHaveBeenCalledTimes(1);
  });

  it("does not keep asking about a job that could not be read at all", async () => {
    fetchJob.mockRejectedValue(new Error("Import not found"));
    const { result } = renderHook(() => useMapImportJob("j1"), { wrapper });
    await tick(0);
    expect(result.current.error).toBeTruthy();
    const before = fetchJob.mock.calls.length;
    await tick(10_000);
    expect(fetchJob).toHaveBeenCalledTimes(before);
  });

  it("keeps asking about a running job whose latest read failed", async () => {
    fetchJob.mockResolvedValueOnce({ status: "running" });
    fetchJob.mockRejectedValueOnce(new Error("Network down"));
    fetchJob.mockResolvedValue({ status: "succeeded" });
    const { result } = renderHook(() => useMapImportJob("j1"), { wrapper });
    await tick(0);
    await tick(1010);
    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toMatchObject({ status: "running" });
    await tick(1000);
    expect(result.current.data).toMatchObject({ status: "succeeded" });
  });
});
