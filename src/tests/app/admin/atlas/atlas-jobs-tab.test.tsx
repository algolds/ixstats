/**
 * The Jobs tab: filters and paging, the detail sheet, and Cancel, Retry and Roll back only where a job allows them.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  calls,
  fetchNextPage,
  jobRow,
  listInputs,
  realmRow,
  resetFakeAtlas,
  responses,
  state,
} from "~/tests/helpers/fake-atlas-ui";

jest.mock("~/trpc/react", () => ({ api: jest.requireActual("~/tests/helpers/fake-atlas-ui").api }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/components/ui/sheet", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
      open ? <div role="dialog">{children}</div> : null,
    SheetContent: passthrough,
    SheetHeader: passthrough,
    SheetTitle: passthrough,
    SheetDescription: passthrough,
  };
});

import { AtlasJobsTab } from "~/app/admin/maps/_components/atlas/AtlasJobsTab";

const page = (...jobs: ReturnType<typeof jobRow>[]) => ({ jobs, nextCursor: null });
const rowOf = (name: RegExp | string) => screen.getByRole("button", { name }).closest("tr")!;

beforeEach(() => {
  resetFakeAtlas();
  state.overview = {
    partial: false,
    realms: [realmRow(), realmRow({ id: "r_b", slug: "borea", name: "Borea" })],
  };
});

describe("the job list", () => {
  it("lists each job with its kind, realm, status and progress", () => {
    state.jobPages = [
      page(
        jobRow({
          id: "j1",
          kind: "world",
          dryRun: true,
          status: "running",
          progress: 40,
          stage: "Checking",
        }),
        jobRow({ id: "j2", kind: "map-pipeline", status: "failed", error: "No art" })
      ),
    ];
    render(<AtlasJobsTab />);
    const world = rowOf("Open World check j1");
    expect(within(world).getByText("Eurth")).toBeInTheDocument();
    expect(within(world).getByText("Running")).toBeInTheDocument();
    expect(within(world).getByText("Checking, 40%")).toBeInTheDocument();
    expect(within(rowOf("Open Map pipeline run j2")).getByText("Failed")).toBeInTheDocument();
  });

  it("passes the realm, kind and status filters to the query", () => {
    render(<AtlasJobsTab />);
    expect(listInputs.at(-1)).toEqual({ realm: undefined, kind: undefined, status: undefined });
    fireEvent.click(screen.getByRole("combobox", { name: "Realm" }));
    fireEvent.click(screen.getByRole("option", { name: "Borea" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Kind" }));
    fireEvent.click(screen.getByRole("option", { name: "World" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Status" }));
    fireEvent.click(screen.getByRole("option", { name: "Failed" }));
    expect(listInputs.at(-1)).toEqual({ realm: "borea", kind: "world", status: "failed" });
  });

  it("pages with Load more while the server has a next cursor", () => {
    state.jobPages = [{ jobs: [jobRow()], nextCursor: "c1" }];
    render(<AtlasJobsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("offers no Load more on the last page, and says when there are no jobs", () => {
    state.jobPages = [page()];
    render(<AtlasJobsTab />);
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(screen.getByText("No jobs")).toBeInTheDocument();
  });
});

describe("job actions", () => {
  it("shows Cancel, Retry and Roll back only where the job allows them", () => {
    state.jobPages = [
      page(
        jobRow({ id: "queued", status: "queued", canCancel: true }),
        jobRow({ id: "failed", status: "failed", canRetry: true }),
        jobRow({ id: "done", canRollBack: true, importId: "imp_1" }),
        jobRow({ id: "plain" })
      ),
    ];
    render(<AtlasJobsTab />);
    const actions = (id: string) =>
      within(rowOf(`Open Apply (PNG) ${id}`))
        .queryAllByRole("button")
        .map((button) => button.textContent)
        .filter((text) => text !== `Apply (PNG)`);
    expect(actions("queued")).toEqual(["Cancel"]);
    expect(actions("failed")).toEqual(["Retry"]);
    expect(actions("done")).toEqual(["Roll back"]);
    expect(actions("plain")).toEqual([]);
  });

  it("retries a failed job with its id", () => {
    state.jobPages = [page(jobRow({ id: "failed", status: "failed", canRetry: true }))];
    responses["atlas.jobs.retry"] = { jobId: "new", retryAs: "apply", note: "Started again" };
    render(<AtlasJobsTab />);
    fireEvent.click(
      within(rowOf("Open Apply (PNG) failed")).getByRole("button", { name: "Retry" })
    );
    expect(calls).toEqual([["atlas.jobs.retry", { jobId: "failed" }]]);
  });

  it("asks before cancelling and before rolling back", () => {
    state.jobPages = [
      page(
        jobRow({ id: "queued", status: "queued", canCancel: true }),
        jobRow({ id: "done", canRollBack: true, importId: "imp_1" })
      ),
    ];
    responses["atlas.jobs.rollback"] = { restored: 3, deleted: 1 };
    render(<AtlasJobsTab />);
    fireEvent.click(
      within(rowOf("Open Apply (PNG) queued")).getByRole("button", { name: "Cancel" })
    );
    expect(calls).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel job" }));
    expect(calls).toEqual([["atlas.jobs.cancel", { jobId: "queued" }]]);

    fireEvent.click(
      within(rowOf("Open Apply (PNG) done")).getByRole("button", { name: "Roll back" })
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Roll back" })
    );
    expect(calls.at(-1)).toEqual(["atlas.jobs.rollback", { importId: "imp_1" }]);
  });
});

describe("the detail sheet", () => {
  it("opens a job with its error, result summary and the retry note", () => {
    state.jobPages = [page(jobRow({ id: "failed", status: "failed", canRetry: true }))];
    state.jobDetail = {
      ...jobRow({ id: "failed", status: "failed", canRetry: true, error: "The upload is gone" }),
      result: { written: 12, warnings: ["a", "b"], summary: { x: 1 } },
      retryNote: "Starts again from the same upload.",
    };
    render(<AtlasJobsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Open Apply (PNG) failed" }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("The upload is gone")).toBeInTheDocument();
    expect(within(sheet).getByText("Written")).toBeInTheDocument();
    expect(within(sheet).getByText("12")).toBeInTheDocument();
    expect(within(sheet).getByText("2 items")).toBeInTheDocument();
    expect(within(sheet).getByText("1 fields")).toBeInTheDocument();
    expect(within(sheet).getByText("Starts again from the same upload.")).toBeInTheDocument();
    expect(within(sheet).getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("says why a failed job cannot be retried", () => {
    state.jobPages = [page(jobRow({ id: "failed", status: "failed" }))];
    state.jobDetail = {
      ...jobRow({ id: "failed", status: "failed", retryBlocked: "The upload is gone" }),
      result: null,
      retryNote: "",
    };
    render(<AtlasJobsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Open Apply (PNG) failed" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: "Retry" })).toBeNull();
    expect(within(screen.getByRole("dialog")).getByText("The upload is gone")).toBeInTheDocument();
  });
});
