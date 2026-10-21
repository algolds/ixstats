/**
 * The founding flow at /builder: the draft saves two seconds after the last change, and founding
 * the nation needs a confirm (no keyboard shortcut founds) and sends none of the explicit payloads.
 */
import "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  applyStart,
  emptyFoundingDraft,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";
// ---- next/navigation: a tiny URL store the flow reads and writes ----------------------------
const mockNav = { params: new URLSearchParams(), listeners: new Set<() => void>() };
function mockSetUrl(href: string) {
  mockNav.params = new URLSearchParams(href.split("?")[1] ?? "");
  mockNav.listeners.forEach((listener) => listener());
}
const mockPush = jest.fn((href: string) => mockSetUrl(href));
const mockReplace = jest.fn((href: string) => mockSetUrl(href));
jest.mock("next/navigation", () => {
  const { useSyncExternalStore } = jest.requireActual("react");
  const subscribe = (listener: () => void) => {
    mockNav.listeners.add(listener);
    return () => mockNav.listeners.delete(listener);
  };
  return {
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
    useSearchParams: () => useSyncExternalStore(subscribe, () => mockNav.params),
    usePathname: () => "/builder",
  };
});

// ---- tRPC -----------------------------------------------------------------------------------
const SUMMARY = {
  gdp: 800e9,
  gdpPerCapita: 40_000,
  population: 20e6,
  budgetBalancePercentOfGdp: -0.4,
  budgetBalanceLabel: "Balanced",
  stability: 64,
  governmentEffectiveness: 71,
  expectedGrowth: 2.4,
};
let mockServerDraft: { data: unknown; updatedAt: Date } | null = null;
const mockSave = jest.fn();
const mockClear = jest.fn();
const mockCreate = jest.fn();
const mockRealms = {
  defaultRealmId: "ixnay",
  realms: [{ id: "ixnay", slug: "ixnay", name: "Ixnay", held: 0, cap: 1, canCreate: true }],
};
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ invalidate: jest.fn() }),
    realms: {
      builderRealms: { useQuery: () => ({ data: mockRealms, isLoading: false }) },
    },
    builderDraft: {
      get: {
        useQuery: () => ({ data: mockServerDraft, isSuccess: true, isError: false }),
      },
      save: { useMutation: () => ({ mutateAsync: mockSave }) },
      clear: { useMutation: () => ({ mutateAsync: mockClear }) },
    },
    countries: {
      previewFounding: {
        useQuery: () => ({
          data: SUMMARY,
          isError: false,
          isFetching: false,
          isPlaceholderData: false,
        }),
      },
      createCountry: { useMutation: () => ({ mutateAsync: mockCreate, isPending: false }) },
      searchWiki: { useMutation: () => ({ mutateAsync: jest.fn() }) },
      parseInfobox: { useMutation: () => ({ mutateAsync: jest.fn() }) },
    },
  },
}));

jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);

import { FoundingFlowView } from "~/app/builder/_founding/FoundingFlow";

function named(step: FoundingDraft["step"] = "start"): FoundingDraft {
  const draft = applyStart(emptyFoundingDraft(), "nordic");
  return {
    ...draft,
    step,
    updatedAt: 10,
    identity: { ...draft.identity, name: "Valoria", capitalCity: "Port Val" },
  };
}

function serve(draft: FoundingDraft | null, url = "") {
  mockServerDraft = draft ? { data: draft, updatedAt: new Date(10) } : null;
  mockNav.params = new URLSearchParams(url);
}

const heading = (name: string | RegExp) => screen.getByRole("heading", { level: 2, name });

beforeEach(() => {
  jest.useRealTimers();
  window.localStorage.clear();
  mockPush.mockClear();
  mockReplace.mockClear();
  mockSave.mockReset().mockResolvedValue({ success: true });
  mockClear.mockReset().mockResolvedValue({ success: true });
  mockCreate.mockReset().mockResolvedValue({ id: "c1", name: "Valoria" });
});

describe("founding flow", () => {
  it("saves the whole draft, step included, two seconds after the last change", async () => {
    jest.useFakeTimers();
    serve(named("identity"), "step=identity");
    render(<FoundingFlowView />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Valoria Nova" } });
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1999));
    expect(mockSave).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const saved = mockSave.mock.calls[0]![0].data as FoundingDraft;
    expect(saved).toMatchObject({
      kind: "founding",
      step: "identity",
      identity: { name: "Valoria Nova" },
      start: { archetypeKey: "nordic" },
    });
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
    // The crash copy is written too.
    expect(window.localStorage.getItem("ixstats:founding-draft")).toContain("Valoria Nova");
  });
  it("Found nation needs a confirm and sends none of the explicit payloads", async () => {
    serve(named("review"), "step=review");
    render(<FoundingFlowView />);
    expect(heading("Valoria")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Found nation" }));
    expect(mockCreate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("Found Valoria?");
    expect(dialog).toHaveTextContent("in Ixnay");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Found nation" }));
    });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const input = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
    expect(input).toMatchObject({ name: "Valoria", realmId: "ixnay", archetypeId: "nordic" });
    expect(input).not.toHaveProperty("taxSystemData");
    expect(input).not.toHaveProperty("governmentStructure");
    expect(input).not.toHaveProperty("economyBuilderState");
    expect(mockClear).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith("/mycountry/welcome");
  });
  it("no keyboard shortcut founds", () => {
    serve(named("review"), "step=review");
    render(<FoundingFlowView />);
    fireEvent.keyDown(document, { key: "s", ctrlKey: true });
    fireEvent.keyDown(document, { key: "s", metaKey: true });
    fireEvent.keyDown(document, { key: "Enter" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
