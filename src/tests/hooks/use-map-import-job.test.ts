/**
 * The map import job query polls every second while the job is queued or running, and stops once it is done, or when
 * the job could not be read at all.
 */
jest.mock("~/trpc/react", () => ({
  api: { geoEditor: { mapImport: { job: { useQuery: jest.fn() } } } },
}));

import { renderHook } from "@testing-library/react";
import { api } from "~/trpc/react";
import { useMapImportJob } from "~/hooks/useMapImportJob";

const useQuery = jest.mocked(api.geoEditor.mapImport.job.useQuery as unknown as jest.Mock);

type Options = {
  enabled: boolean;
  refetchInterval: (query: {
    state: { data?: { status: string }; status: string };
  }) => number | false;
};

function options(jobId: string | null): Options {
  useQuery.mockReturnValue({});
  renderHook(() => useMapImportJob(jobId));
  return useQuery.mock.calls.at(-1)![1] as Options;
}

describe("useMapImportJob", () => {
  it("asks for the job it was given, and nothing without one", () => {
    expect(useQuery).not.toHaveBeenCalled();
    options("j1");
    expect(useQuery.mock.calls.at(-1)![0]).toEqual({ jobId: "j1" });
    expect(options("j1").enabled).toBe(true);
    expect(options(null).enabled).toBe(false);
  });

  it.each(["queued", "running"])("polls every second while the job is %s", (status) => {
    const { refetchInterval } = options("j1");
    expect(refetchInterval({ state: { data: { status }, status: "success" } })).toBe(1000);
  });

  it("polls before the first answer", () => {
    const { refetchInterval } = options("j1");
    expect(refetchInterval({ state: { status: "pending" } })).toBe(1000);
  });

  it.each(["succeeded", "failed", "cancelled"])("stops once the job has %s", (status) => {
    const { refetchInterval } = options("j1");
    expect(refetchInterval({ state: { data: { status }, status: "success" } })).toBe(false);
  });

  it("stops when the job cannot be read at all, which asking again would not change", () => {
    const { refetchInterval } = options("j1");
    expect(refetchInterval({ state: { status: "error" } })).toBe(false);
  });

  it("keeps polling a running job whose latest read failed, since the job is still going", () => {
    const { refetchInterval } = options("j1");
    expect(refetchInterval({ state: { data: { status: "running" }, status: "error" } })).toBe(1000);
  });
});

beforeEach(() => useQuery.mockReset());
