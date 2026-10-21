import { fireEvent, render, screen } from "@testing-library/react";
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
  { id: "default", slug: "ixnay", name: "Ixnay" },
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
  it("refuses an empty or out-of-range rate, and holds applying until the edit is saved", () => {
    render(<NationsTab />);
    fireEvent.change(screen.getByLabelText("Adjusted GDP growth, Strong"), {
      target: { value: "" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Every rate needs a number");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dry run" })).toBeDisabled();
  });
  it("starts a dry run, and keeps Apply off until one has run", () => {
    render(<NationsTab />);
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Dry run" }));
    expect(preview).toHaveBeenCalledWith({ realmId: "eurth-id" });
  });
});
