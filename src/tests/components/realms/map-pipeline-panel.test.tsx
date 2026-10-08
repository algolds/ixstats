import { fireEvent, render, screen, within } from "@testing-library/react";
import { MapPipelinePanel } from "~/app/admin/realms/_components/map-pipeline/MapPipelinePanel";
import { MapPipelineTab } from "~/app/admin/realms/_components/map-pipeline/MapPipelineTab";
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
        adminListRealms: {
          useQuery: () => ({
            data: [
              { id: "default", slug: "ixworld", name: "IxWorld" },
              { id: "eurth-id", slug: "eurth", name: "Eurth" },
            ],
            isLoading: false,
          }),
        },
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

const run = (overrides: object) => ({
  id: "job-1",
  realmId: "eurth-id",
  kind: "map-pipeline",
  status: "succeeded",
  progress: 100,
  stage: null,
  dryRun: true,
  error: null,
  requestedBy: "user_1",
  requestedByName: "Ixnay",
  createdAt: new Date("2026-10-07T10:00:00Z"),
  options: { steps: ["repair", "rasters"], dryRun: true },
  result: null,
  ...overrides,
});

describe("Map pipeline panel", () => {
  beforeEach(() => {
    for (const key of Object.keys(calls)) delete calls[key];
    for (const key of Object.keys(responses)) delete responses[key];
    runQueries.length = 0;
    view = baseView;
    runs = [];
    runData = {};
  });

  it("offers a preset or a blank config to a realm with no pipeline", () => {
    view = { ...baseView, pipeline: null };
    render(<MapPipelinePanel slug="eurth" />);
    expect(screen.getByText("No map pipeline yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dry run" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load preset" }));
    expect(calls.loadPreset).toEqual([{ realm: "eurth", presetId: "eurth-map", force: false }]);

    fireEvent.click(screen.getByRole("button", { name: "Start from scratch" }));
    expect(screen.getByText("Art files")).toBeInTheDocument();
    expect(screen.getByText("Unsaved changes.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(calls.save).toEqual([{ realm: "eurth", pipeline: { art: {}, rasters: [] } }]);
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

  it("shows which steps read each art file", () => {
    render(<MapPipelinePanel slug="eurth" />);
    const blank = screen.getByLabelText("Art 1 name").closest("tr")!;
    expect(within(blank).getByText("Physical layers")).toBeInTheDocument();
    const geography = screen.getByLabelText("Art 2 name").closest("tr")!;
    expect(within(geography).getByText("Raster layers")).toBeInTheDocument();
  });

  it("puts validation errors at their fields and refuses to save", () => {
    render(<MapPipelinePanel slug="eurth" />);
    fireEvent.change(screen.getByLabelText("Art 2 name"), { target: { value: "Geo_Map" } });
    expect(screen.getByLabelText("Art 2 name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Art names are lower case letters/)).toBeInTheDocument();
    // The raster still names "geography", which no longer exists.
    expect(screen.getByText('No art named "geography"')).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("2 fields need fixing");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("starts a dry run of every step and shows each step's report", () => {
    responses.start = { jobId: "job-1" };
    runData["job-1"] = run({
      options: { steps: ["repair", "rasters"], dryRun: true },
      result: {
        phase: "pipeline",
        dryRun: true,
        art: {},
        steps: [
          {
            step: "repair",
            status: "unchanged",
            summary: "115 borders: smoothing up to date",
            details: [],
            ms: 700,
          },
          {
            step: "rasters",
            status: "would-change",
            summary: "1 raster layer to build",
            details: ["geography: version abc, z0–5, new"],
            ms: 600,
          },
        ],
      },
    });
    render(<MapPipelinePanel slug="eurth" />);
    fireEvent.click(screen.getByRole("button", { name: "Dry run" }));
    expect(calls.start).toEqual([{ realm: "eurth", steps: [...MAP_PIPELINE_STEPS], dryRun: true }]);
    const results = screen.getByRole("list", { name: "Step results" });
    expect(within(results).getByText("Unchanged")).toBeInTheDocument();
    expect(within(results).getByText("Would change")).toBeInTheDocument();
    expect(within(results).getByText("1 raster layer to build")).toBeInTheDocument();
    fireEvent.click(within(results).getByRole("button", { name: /Details \(1\)/ }));
    expect(within(results).getByText("geography: version abc, z0–5, new")).toBeInTheDocument();
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

  it("follows a running run with progress and cancel", () => {
    runs = [
      {
        ...run({ id: "job-3", status: "running" }),
        steps: ["physical"],
        results: [],
      },
    ];
    runData["job-3"] = run({
      id: "job-3",
      status: "running",
      progress: 40,
      stage: "Physical layers: Tracing rivers",
    });
    render(<MapPipelinePanel slug="eurth" />);
    expect(screen.getByRole("status")).toHaveTextContent("Physical layers: Tracing rivers");
    expect(screen.getByText("A run is in progress.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel run" }));
    expect(calls.cancel).toEqual([{ jobId: "job-3" }]);
  });

  it("lists past runs and opens one's details", () => {
    runs = [
      {
        ...run({
          id: "job-5",
          dryRun: false,
          requestedBy: "script:build-realm-map",
          requestedByName: "script build-realm-map",
        }),
        steps: ["areas"],
        results: [{ step: "areas", status: "changed", summary: "12 areas", ms: 500 }],
      },
      {
        ...run({ id: "job-4", status: "failed", error: "Upload again" }),
        steps: ["rasters"],
        results: [],
      },
    ];
    runData["job-4"] = run({ id: "job-4", status: "failed", error: "Upload again" });
    render(<MapPipelinePanel slug="eurth" />);
    const history = screen.getByRole("list", { name: "Run history" });
    const items = within(history).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Applied");
    expect(items[0]).toHaveTextContent("by script build-realm-map");
    expect(within(items[0]!).getByText("Changed")).toBeInTheDocument();
    expect(items[1]).toHaveTextContent("Failed");
    expect(items[1]).toHaveTextContent("by Ixnay");
    expect(items[1]).toHaveTextContent("Upload again");
    fireEvent.click(within(items[1]!).getByRole("button", { name: /Details of the run/ }));
    expect(runQueries).toContain("job-4");
  });

  it("shows a stored config that no longer reads", () => {
    view = { ...baseView, pipeline: null, problem: 'physical: No art named "blank"' };
    render(<MapPipelinePanel slug="eurth" />);
    expect(screen.getByText(/The saved pipeline no longer reads/)).toBeInTheDocument();
    expect(screen.getByText(/physical: No art named "blank"/)).toBeInTheDocument();
  });
});

describe("/admin/realms Map tab", () => {
  beforeEach(() => {
    view = baseView;
    runs = [];
  });

  it("opens on the first realm other than IxWorld", () => {
    render(<MapPipelineTab />);
    expect(screen.getByText("Art files")).toBeInTheDocument();
    expect(screen.getByText(/someone\/eurth-map at main/)).toBeInTheDocument();
  });
});
