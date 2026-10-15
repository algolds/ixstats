/**
 * The founding flow at /builder: the saved draft restores its step, deep links to a step whose
 * prerequisites are missing redirect, the draft saves two seconds after the last change,
 * Continue focuses the first invalid field, switching archetype asks first and keeps identity,
 * and Found nation needs a confirm and sends none of the explicit payloads.
 */
import React from "react";
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
  it("renders one h1 and restores the saved draft at its step", () => {
    serve(named("government"));
    render(<FoundingFlowView />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(heading("How is your nation governed?")).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/builder?step=government", { scroll: false });
  });

  it("sends a deep link with missing prerequisites to the first incomplete step", () => {
    serve(applyStart(emptyFoundingDraft(), "nordic"), "step=economy");
    render(<FoundingFlowView />);
    expect(heading("Name your nation")).toBeInTheDocument();
    expect(mockReplace).toHaveBeenCalledWith("/builder?step=identity", { scroll: false });
  });

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

  it("says when the draft could not be saved, with a retry", async () => {
    jest.useFakeTimers();
    mockSave.mockRejectedValueOnce(new Error("offline"));
    serve(named("identity"), "step=identity");
    render(<FoundingFlowView />);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: "Valoria Nova" } });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save your draft");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    expect(mockSave).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Draft saved")).toBeInTheDocument();
  });

  it("asks for a start before moving on", () => {
    serve(null);
    render(<FoundingFlowView />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Choose a kind of nation, or start blank.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("Continue focuses the first invalid field", () => {
    const draft = named("identity");
    serve({ ...draft, identity: { ...draft.identity, name: "" } }, "step=identity");
    render(<FoundingFlowView />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    const name = screen.getByLabelText(/^Name/);
    expect(name).toHaveFocus();
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter a name for your nation.")).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("opens More details to focus an invalid field inside it", () => {
    const draft = named("identity");
    serve({ ...draft, identity: { ...draft.identity, isoCode: "TOOLONG" } }, "step=identity");
    render(<FoundingFlowView />);
    expect(screen.queryByLabelText(/Country code/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Country code/)).toHaveFocus();
  });

  it("switching archetype asks first, then keeps the identity", () => {
    serve(named("start"), "step=start");
    render(<FoundingFlowView />);
    fireEvent.click(screen.getByRole("radio", { name: /Skilled industrial economy/ }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent(
      "Switching to Skilled industrial economy replaces your size, wealth and government. Your name, flag and other identity stay."
    );
    expect(mockPush).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: "Switch" }));
    expect(mockPush).toHaveBeenCalledWith("/builder?step=identity");
    expect(screen.getByLabelText(/^Name/)).toHaveValue("Valoria");
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

  it("shows a refusal as a Signal with the step that fixes it", async () => {
    mockCreate.mockRejectedValueOnce({
      message: 'A country named "Valoria" already exists in this realm',
    });
    serve(named("review"), "step=review");
    render(<FoundingFlowView />);
    fireEvent.click(screen.getByRole("button", { name: "Found nation" }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("alertdialog")).getByRole("button", { name: "Found nation" })
      );
    });
    expect(screen.getByRole("alert")).toHaveTextContent("That name is taken in this realm");
    fireEvent.click(screen.getByRole("button", { name: "Change the name" }));
    expect(mockPush).toHaveBeenCalledWith("/builder?step=identity");
    expect(screen.getByRole("button", { name: "Back to review" })).toBeInTheDocument();
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
