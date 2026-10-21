import { fireEvent, render, screen, within } from "@testing-library/react";
import { MapPipelinePanel } from "~/app/admin/realms/_components/map-pipeline/MapPipelinePanel";
import {
  MAP_PIPELINE_STEP_LABELS,
  MAP_PIPELINE_STEPS,
  type RealmMapPipeline,
} from "~/lib/maps/realm-map-pipeline";

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type Input = object;
const calls: Record<string, Input[]> = {};
const responses: Record<string, object> = {};
const runQueries: string[] = [];
let view: object | undefined;
let runs: object[] = [];
let runData: Record<string, object> = {};

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));

function mutation(name: string) {
  return {
    useMutation: (opts?: { onSuccess?: (data: object, input: Input) => void }) => ({
      mutate: (input: Input) => {
        (calls[name] ??= []).push(input);
        if (responses[name]) opts?.onSuccess?.(responses[name], input);
      },
      isPending: false,
    }),
  };
}

jest.mock("~/trpc/react", () => {
  const invalidate = { invalidate: jest.fn() };
  return {
    api: {
      useUtils: () => ({
        realms: { mapPipeline: { get: invalidate, runs: invalidate, run: invalidate } },
      }),
      realms: {
        mapPipeline: {
          get: { useQuery: () => ({ data: view, isLoading: false, error: null }) },
          runs: { useQuery: () => ({ data: runs }) },
          run: {
            useQuery: ({ jobId }: { jobId: string }) => {
              runQueries.push(jobId);
              return { data: runData[jobId], error: null };
            },
          },
          save: mutation("save"),
          loadPreset: mutation("loadPreset"),
          start: mutation("start"),
          cancel: mutation("cancel"),
        },
      },
    },
  };
});

const pipeline: RealmMapPipeline = {
  art: { blank: { repoPath: "Blank.png" }, geography: { repoPath: "Overlays/Geography.png" } },
  rasters: [{ id: "geography", label: "Geography", kind: "base", art: "geography" }],
  physical: { land: "blank" },
  flags: { localize: true },
  defaultView: "auto",
  coverage: { tolerance: 0.045, smooth: 2 },
};

const baseView = {
  realm: { id: "eurth-id", slug: "eurth", name: "Eurth" },
  pipeline,
  problem: null,
  source: { repo: "someone/eurth-map", ref: "main" },
  presets: [{ id: "eurth-map", label: "Eurth map", description: null }],
  steps: MAP_PIPELINE_STEPS.map((step) => ({ step, label: MAP_PIPELINE_STEP_LABELS[step] })),
  built: { rasterLayers: [], defaultView: null, hasClimateKey: false },
};
describe("Map pipeline panel", () => {
  beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    for (const key of Object.keys(responses)) delete responses[key];
    runQueries.length = 0;
    view = baseView;
    runs = [];
    runData = {};
  });
  it("asks before a preset replaces everything", () => {
    render(<MapPipelinePanel slug="eurth" />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Replace everything" }));
    fireEvent.click(screen.getByRole("button", { name: "Load preset" }));
    expect(calls.loadPreset).toBeUndefined();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("its own art included");
    fireEvent.click(within(dialog).getByRole("button", { name: "Load preset" }));
    expect(calls.loadPreset).toEqual([{ realm: "eurth", presetId: "eurth-map", force: true }]);
  });

  it("saves an edited raster row, and holds runs until the edit is saved", () => {
    render(<MapPipelinePanel slug="eurth" />);
    expect(screen.getByDisplayValue("Overlays/Geography.png")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Raster 1 label"), { target: { value: "Relief" } });
    expect(screen.getByRole("button", { name: "Dry run" })).toBeDisabled();
    expect(screen.getByText(/Save your changes first/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(calls.save).toEqual([
      {
        realm: "eurth",
        pipeline: {
          ...pipeline,
          rasters: [{ id: "geography", label: "Relief", kind: "base", art: "geography" }],
        },
      },
    ]);
  });
  it("runs only the chosen steps, and confirms an apply", () => {
    responses.start = { jobId: "job-2" };
    render(<MapPipelinePanel slug="eurth" />);
    for (const step of MAP_PIPELINE_STEPS.filter((s) => s !== "labels" && s !== "flags")) {
      fireEvent.click(screen.getByRole("checkbox", { name: MAP_PIPELINE_STEP_LABELS[step] }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Map labels, Local flags write to the realm's map");
    fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    expect(calls.start).toEqual([{ realm: "eurth", steps: ["labels", "flags"], dryRun: false }]);
  });
});
