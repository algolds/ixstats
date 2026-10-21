/**
 * The Jobs tab: filters and paging, the detail sheet, and Cancel, Retry and Roll back only where a job allows them.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  calls,
  jobRow,
  realmRow,
  resetFakeAtlas,
  responses,
  state,
} from "~/tests/helpers/fake-atlas-ui";

jest.mock("~/trpc/react", () => ({ api: jest.requireActual("~/tests/helpers/fake-atlas-ui").api }));
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => jest.requireActual("~/tests/helpers/fake-atlas-ui").notify,
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
    expect(screen.getByRole("alertdialog")).toHaveTextContent(
      "nations or slots it made are removed"
    );
    fireEvent.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Roll back" })
    );
    expect(calls.at(-1)).toEqual(["atlas.jobs.rollback", { importId: "imp_1" }]);
  });
});
describe("continuing a retried job", () => {
  beforeEach(() => mockPush.mockClear());
  it("opens a retried world check, which can then be applied after asking", () => {
    state.jobPages = [
      page(jobRow({ id: "failed", kind: "world", status: "failed", canRetry: true })),
    ];
    responses["atlas.jobs.retry"] = { jobId: "check_2", retryAs: "world-check", note: "New check" };
    responses["geoEditor.mapImport.applyWorld"] = { jobId: "apply_3" };
    state.jobDetail = {
      ...jobRow({ id: "check_2", kind: "world", dryRun: true }),
      result: { layers: ["a", "b"], nations: 3 },
      retryNote: "",
      canApply: true,
    };
    render(<AtlasJobsTab />);
    fireEvent.click(
      within(rowOf("Open World apply failed")).getByRole("button", { name: "Retry" })
    );
    expect(mockPush).not.toHaveBeenCalled();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("Job check_2")).toBeInTheDocument();

    fireEvent.click(within(sheet).getByRole("button", { name: "Apply this check" }));
    expect(calls.filter(([name]) => name === "geoEditor.mapImport.applyWorld")).toEqual([]);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Layers: 2 items, Nations: 3");
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Apply" }));
    expect(calls).toContainEqual(["geoEditor.mapImport.applyWorld", { jobId: "check_2" }]);
    // The sheet follows to the apply job
    expect(screen.getByText("Job apply_3")).toBeInTheDocument();
  });
});
