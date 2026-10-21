/** Import jobs: progress and results, cancel a running job, retry a failed one, resume one left waiting. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/hooks/useNotify", () => {
  const notify = { success: jest.fn(), error: jest.fn(), info: jest.fn() };
  return { useNotify: () => notify };
});

import { api } from "~/trpc/react";
import { ImportJobs } from "~/app/admin/cards/imports/ImportJobs";

const job = (overrides: object) => ({
  id: "job_1",
  source: "iiwiki",
  kind: "MANUAL",
  status: "RUNNING",
  label: "Category:Elm",
  total: 4,
  processed: 2,
  staged: 1,
  skipped: 1,
  blocked: 0,
  failed: 0,
  error: null,
  createdAt: new Date(),
  startedAt: new Date(),
  heartbeatAt: new Date(),
  finishedAt: null,
  ...overrides,
});

const mutation = (mutate: jest.Mock) => ({ mutate, isPending: false }) as never;
const cancel = jest.fn();
const retry = jest.fn();
const resume = jest.fn();
const refetchItems = jest.fn();

function serve(jobs: object[], items: object[] = []) {
  jest.mocked(api.useUtils).mockReturnValue({
    cards: { admin: { imports: { jobs: { invalidate: jest.fn() } } } },
  } as never);
  jest.mocked(api.cards.admin.imports.jobs.useQuery).mockReturnValue({ data: jobs } as never);
  jest.mocked(api.cards.admin.imports.items.useQuery).mockReturnValue({
    data: items,
    refetch: refetchItems,
  } as never);
  jest.mocked(api.cards.admin.imports.cancel.useMutation).mockReturnValue(mutation(cancel));
  jest.mocked(api.cards.admin.imports.retry.useMutation).mockReturnValue(mutation(retry));
  jest.mocked(api.cards.admin.imports.resume.useMutation).mockReturnValue(mutation(resume));
}

beforeEach(() => jest.clearAllMocks());

describe("ImportJobs", () => {
  it("lists jobs with their progress and lets an admin cancel a running one or retry a failed one", () => {
    serve([
      job({}),
      job({
        id: "job_2",
        status: "FAILED",
        kind: "DAILY",
        label: "Daily IIWiki import",
        processed: 3,
        failed: 1,
        error: "IIWiki stopped answering (HTTP 403).",
      }),
    ]);
    render(<ImportJobs />);
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
    expect(screen.getByText("1 staged · 1 skipped · 0 blocked · 0 failed")).toBeInTheDocument();
    expect(screen.getByText("1 staged · 1 skipped · 0 blocked · 1 failed")).toBeInTheDocument();
    expect(screen.getAllByText("IIWiki")).toHaveLength(2);
    expect(screen.getByText("IIWiki stopped answering (HTTP 403).")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]!);
    expect(cancel).toHaveBeenCalledWith({ jobId: "job_1" });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledWith({ jobId: "job_2" });
  });

  it("offers to resume a job no run has touched for a while", () => {
    const stale = new Date(Date.now() - 10 * 60_000);
    serve([job({ status: "QUEUED", heartbeatAt: null, createdAt: stale })]);
    render(<ImportJobs />);
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(resume).toHaveBeenCalled();
  });

  it("offers nothing to change on a finished job", () => {
    serve([job({ status: "DONE", processed: 4, finishedAt: new Date() })]);
    render(<ImportJobs />);
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows each page's result, rarity and licence", () => {
    serve(
      [job({})],
      [
        {
          id: "i1",
          title: "Union Assembly",
          status: "STAGED",
          cardId: "c1",
          rarity: "ULTRA_RARE",
          licence: "CC BY-SA 4.0",
          reason: null,
        },
        {
          id: "i2",
          title: "Elm",
          status: "SKIPPED",
          cardId: null,
          rarity: null,
          licence: null,
          reason: "Already a card",
        },
      ]
    );
    render(<ImportJobs />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(screen.getByText("Waiting for review")).toBeInTheDocument();
    expect(screen.getByText("Ultra rare")).toBeInTheDocument();
    expect(screen.getByText("CC BY-SA 4.0")).toBeInTheDocument();
    expect(screen.getByText("Already a card")).toBeInTheDocument();
    expect(screen.getByText("IIWiki · Showing 2 of 4 pages")).toBeInTheDocument();
  });

  it("polls a running job's results, stops once the live job finishes, and reads its final results once", () => {
    serve([job({})]);
    const { rerender } = render(<ImportJobs />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    const items = jest.mocked(api.cards.admin.imports.items.useQuery);
    expect(items.mock.calls.at(-1)).toEqual([
      { jobId: "job_1" },
      expect.objectContaining({ enabled: true, refetchInterval: 5_000 }),
    ]);
    expect(refetchItems).not.toHaveBeenCalled();

    const done = job({ status: "DONE", processed: 4, finishedAt: new Date() });
    serve([done]);
    rerender(<ImportJobs />);
    expect(items.mock.calls.at(-1)?.[1]).toEqual(
      expect.objectContaining({ enabled: true, refetchInterval: false })
    );
    expect(refetchItems).toHaveBeenCalledTimes(1);

    serve([{ ...done }]);
    rerender(<ImportJobs />);
    expect(refetchItems).toHaveBeenCalledTimes(1);
  });

  it("reads a finished job's results without an extra read when opened", () => {
    serve([job({ status: "DONE", processed: 4, finishedAt: new Date() })]);
    render(<ImportJobs />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(refetchItems).not.toHaveBeenCalled();
  });

  it("keeps the sheet open on the job it shows when newer jobs push that job out of the list", () => {
    serve([job({})]);
    const { rerender } = render(<ImportJobs />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    serve([job({ id: "job_9", label: "Category:Oak" })]);
    rerender(<ImportJobs />);
    expect(screen.getByRole("dialog")).toHaveTextContent("Category:Elm");
    expect(jest.mocked(api.cards.admin.imports.items.useQuery).mock.calls.at(-1)?.[0]).toEqual({
      jobId: "job_1",
    });
  });

  it("says what to do when there are no imports", () => {
    serve([]);
    render(<ImportJobs />);
    expect(screen.getByText("No imports yet")).toBeInTheDocument();
  });
});
