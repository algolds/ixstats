/**
 * The founding flow at /builder: the draft saves two seconds after the last change, and founding
 * the nation needs a confirm (no keyboard shortcut founds) and sends none of the explicit payloads.
 * The draft's own data-loss rules: switching archetype asks first and keeps the identity, a stored
 * draft is repaired field by field, the local crash copy wins only when newer, and a wiki import
 * takes only the ticked fields (and suggests the closest archetype).
 *
 * Folds founding-draft (its payload cases are in tests/scenarios/engines/founding-to-first-steps).
 */
import "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import {
  applyImport,
  applyStart,
  emptyFoundingDraft,
  parseFoundingDraft,
  pickNewerDraft,
  startNeedsConfirm,
  toggleComponent,
  type FoundingDraft,
} from "~/app/builder/_founding/lib/founding-draft";
import { readInfobox } from "~/app/builder/_founding/lib/founding-import";
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
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

function namedDraft(): FoundingDraft {
  const draft = applyStart(emptyFoundingDraft(), "nordic");
  return { ...draft, identity: { ...draft.identity, name: "Valoria", capitalCity: "Port Val" } };
}

describe("the founding draft: starting points", () => {
  it("asks before switching archetype, and the switch keeps identity", () => {
    const draft = namedDraft();
    expect(startNeedsConfirm(draft, "nordic")).toBe(false);
    expect(startNeedsConfirm(draft, "soviet-command")).toBe(true);
    expect(startNeedsConfirm(draft, null)).toBe(true);
    expect(startNeedsConfirm(emptyFoundingDraft(), "nordic")).toBe(false);

    const customised = {
      ...draft,
      government: toggleComponent(draft.government, "SURVEILLANCE_SYSTEM"),
    };
    const switched = applyStart(customised, "soviet-command");
    expect(switched.identity).toEqual(draft.identity);
    expect(switched.government.components).toBeNull();
    expect(switched.government.formId).toBe(
      getArchetypeDisplay("soviet-command")!.startingGovernmentForm
    );
  });
});

describe("the founding draft: stored drafts", () => {
  it("reads only founding drafts and repairs broken fields", () => {
    expect(parseFoundingDraft({ step: 2, economicInputs: {} })).toBeNull();
    const parsed = parseFoundingDraft({
      kind: "founding",
      version: 1,
      step: "economy",
      identity: { name: "Valoria", motto: 42 },
      start: { selection: "not-an-archetype", applied: true, archetypeKey: "nordic" },
      economy: { populationBand: "huge", exactPopulation: -5 },
    })!;
    expect(parsed.step).toBe("economy");
    expect(parsed.identity.name).toBe("Valoria");
    expect(parsed.identity.motto).toBe("");
    expect(parsed.start).toEqual({ selection: null, applied: true, archetypeKey: "nordic" });
    expect(parsed.economy.populationBand).toBeNull();
    expect(parsed.economy.exactPopulation).toBeNull();
  });

  it("lets the local crash copy win only when it is newer", () => {
    const server = { ...namedDraft(), updatedAt: 200 };
    const local = { ...namedDraft(), updatedAt: 100 };
    expect(pickNewerDraft(server, local)).toBe(server);
    expect(pickNewerDraft(server, { ...local, updatedAt: 300 })!.updatedAt).toBe(300);
    expect(pickNewerDraft(null, local)).toBe(local);
  });
});
describe("the founding draft: wiki import", () => {
  const infobox = {
    name: "Valoria",
    common_name: "[[Valoria]]",
    flagUrl: "https://iiwiki.com/images/flag.png",
    capital: "[[Port Val]]",
    population: "12.5 million",
    GDP_nominal_per_capita: "$61,000",
    government_type: "[[Federal republic|Federal]] parliamentary constitutional monarchy",
    official_languages: "Valorian",
    currency: "Valorian crown",
    motto: "''Onward''",
  };
  it("keeps only the ticked fields and suggests the closest archetype", () => {
    const nation = readInfobox(infobox, "iiwiki", "Valoria");
    const draft = applyImport(
      emptyFoundingDraft(),
      nation,
      new Set(["name", "gdpPerCapita", "government", "population"])
    );
    expect(draft.identity.name).toBe("Valoria");
    expect(draft.identity.capitalCity).toBe("");
    expect(draft.imported).toMatchObject({
      title: "Valoria",
      governmentRaw: "Federal parliamentary constitutional monarchy",
      formId: "constitutional-monarchy",
      population: 12_500_000,
      gdpPerCapita: 61_000,
    });
    // Very wealthy and a constitutional monarchy: the Nordic model.
    expect(draft.imported?.suggestedArchetype).toBe("nordic");
    expect(draft.start.selection).toBe("nordic");

    // The first start keeps the imported size, wealth and form over the archetype's.
    const started = applyStart(draft, "nordic");
    expect(started.economy.exactPopulation).toBe(12_500_000);
    expect(started.economy.exactGdpPerCapita).toBe(61_000);
    expect(started.government.formId).toBe("constitutional-monarchy");
  });
});
