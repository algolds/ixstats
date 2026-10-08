import { fireEvent, render, screen, within } from "@testing-library/react";
import { NationsTab } from "~/app/admin/realms/_components/nations/NationsTab";
import { IXSTATS_NATION_GROWTH_DEFAULTS } from "~/lib/realms/nation-growth-defaults";

global.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const save = jest.fn();
const preview = jest.fn();
const apply = jest.fn();
let previewData: object | undefined;
let view: object;

const realms = [
  { id: "default", slug: "ixworld", name: "IxWorld" },
  { id: "eurth-id", slug: "eurth", name: "Eurth" },
];

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ realms: { nationDefaults: { get: { invalidate: jest.fn() } } } }),
    realms: {
      adminListRealms: { useQuery: () => ({ data: realms, isLoading: false }) },
      nationDefaults: {
        get: { useQuery: () => ({ data: view, isLoading: false, error: null }) },
        save: { useMutation: () => ({ mutate: save, isPending: false }) },
        preview: {
          useMutation: () => ({
            mutate: preview,
            isPending: false,
            data: previewData,
            reset: jest.fn(),
          }),
        },
        applyToUnclaimed: { useMutation: () => ({ mutate: apply, isPending: false }) },
      },
    },
  },
}));

const baseView = {
  realm: { id: "eurth-id", slug: "eurth", name: "Eurth" },
  table: IXSTATS_NATION_GROWTH_DEFAULTS,
  custom: false,
  systemDefaults: IXSTATS_NATION_GROWTH_DEFAULTS,
  nations: 135,
  unclaimed: 135,
};

describe("/admin/realms Nations tab", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    previewData = undefined;
    view = baseView;
  });

  it("opens on the first realm other than IxWorld and shows its per-tier table as percents", () => {
    render(<NationsTab />);
    expect(screen.getByText(/Eurth follows the IxStats defaults/)).toBeInTheDocument();
    expect(screen.getByLabelText("Population growth, Developing")).toHaveValue(2.6);
    expect(screen.getByLabelText("Adjusted GDP growth, Developing")).toHaveValue(0.24075);
    expect(
      screen.getByText("135 of 135 nations are unclaimed.", { exact: false })
    ).toBeInTheDocument();
  });

  it("saves an edited table as decimals", () => {
    render(<NationsTab />);
    const save$ = screen.getByRole("button", { name: "Save" });
    expect(save$).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Population growth, Developing"), {
      target: { value: "2" },
    });
    fireEvent.click(save$);
    expect(save).toHaveBeenCalledWith({
      realmId: "eurth-id",
      table: {
        ...IXSTATS_NATION_GROWTH_DEFAULTS,
        Developing: { ...IXSTATS_NATION_GROWTH_DEFAULTS.Developing, populationGrowthRate: 0.02 },
      },
    });
  });

  it("refuses an empty or out-of-range rate, and holds applying until the edit is saved", () => {
    render(<NationsTab />);
    fireEvent.change(screen.getByLabelText("Adjusted GDP growth, Strong"), {
      target: { value: "" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Every rate needs a number");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dry run" })).toBeDisabled();
  });

  it("resets a realm's own table to the IxStats defaults", () => {
    view = { ...baseView, custom: true };
    render(<NationsTab />);
    fireEvent.click(screen.getByRole("button", { name: "Reset to IxStats defaults" }));
    expect(save).toHaveBeenCalledWith({ realmId: "eurth-id", table: null });
  });

  it("starts a dry run, and keeps Apply off until one has run", () => {
    render(<NationsTab />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Dry run" }));
    expect(preview).toHaveBeenCalledWith({ realmId: "eurth-id" });
  });

  it("lists the dry run's changes and enables the apply", () => {
    previewData = {
      unclaimed: 135,
      changed: 2,
      unchanged: 133,
      byTier: { Developing: 1, Strong: 1 },
      sample: [
        {
          id: "c1",
          name: "Tavok",
          tier: "Developing",
          from: { populationGrowthRate: 0.01, adjustedGdpGrowth: 0.03, maxGdpGrowthRate: 0.05 },
          to: {
            populationGrowthRate: 0.026,
            adjustedGdpGrowth: 0.0024075,
            maxGdpGrowthRate: 0.075,
          },
        },
      ],
    };
    render(<NationsTab />);
    expect(
      screen.getByText(/2 unclaimed nations of 135 would change; 133 already match/)
    ).toBeInTheDocument();
    expect(screen.getByText(/By tier: Developing 1, Strong 1/)).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Tavok/ });
    expect(within(row).getByText("1 to 2.6")).toBeInTheDocument();
    expect(within(row).getByText("5 to 7.5")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(apply).toHaveBeenCalledWith({ realmId: "eurth-id" });
  });
});
