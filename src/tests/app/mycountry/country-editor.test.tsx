/**
 * Country Editor Facet Studio:
 * - Two-column master-detail workspace across 6 studio panes (`#identity`, `#constitution`,
 *   `#cabinet`, `#scale`, `#taxes`, `#budget`);
 * - Every section saves explicitly via its own `SaveButton` without slider padlocks;
 * - Visited panes stay mounted when switching panes so unsaved drafts and `LeaveGuard` persist;
 * - Conflict reload updates only the conflicted section.
 */
import "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

interface SaveCall {
  name: string;
  input: Record<string, unknown>;
  opts: {
    onSuccess: (result: unknown, variables: Record<string, unknown>) => void;
    onError: (error: { message: string; data?: { code?: string } }) => void;
  };
}

const mockCalls: SaveCall[] = [];
function mockMutation(name: string, opts: SaveCall["opts"]) {
  return {
    mutate: (input: Record<string, unknown>) => mockCalls.push({ name, input, opts }),
    isPending: false,
  };
}
const lastSave = () => mockCalls[mockCalls.length - 1]!;

const mockLoaded: { current: Record<string, unknown> | null } = { current: null };
const mockFresh: { current: Record<string, unknown> | null } = { current: null };
const mockInvalidate = {
  countries: jest.fn(),
  dashboard: jest.fn(),
  firstSteps: jest.fn(),
  government: jest.fn(),
  governmentFull: jest.fn(),
  governmentById: jest.fn(),
  profile: jest.fn(),
};

const mockEmptyList: never[] = [];
const mockLegislature = {
  name: "Parliament",
  chamberType: "unicameral",
  totalSeats: 100,
  electoralSystem: "proportional",
  termLength: 4,
  electionCycle: "fixed",
  seats: [],
};
const mockState = {
  id: "c1",
  name: "Testland",
  slug: "testland",
  flag: null,
  coatOfArms: null,
  realmId: "realm_1",
  governmentType: "Parliamentary Republic",
  currentPopulation: 12_000_000,
  currentGdpPerCapita: 30_000,
  currentTotalGdp: 360_000_000_000,
  governmentRevenueTotal: null,
  baselinePopulation: 11_000_000,
  baselineGdpPerCapita: 28_000,
  inflationRate: null,
  unemploymentRate: 6.1,
  totalDebtGDPRatio: null,
  figureEstimates: { inflationRate: 2.4, unemploymentRate: 5.6, totalDebtGDPRatio: 58.2 },
  nationalIdentity: { demonym: "Testish", capitalCity: "Port Test", drivingSide: "right" },
  governmentStructure: {
    governmentType: "Parliamentary Republic",
    headOfState: "President",
    headOfGovernment: "Prime Minister",
    legislatureName: "Parliament",
    executiveName: "Cabinet",
    judicialName: "Supreme Court",
    governmentEffectiveness: 62,
  },
  effectiveness: { score: 62, breakdown: [] },
  governmentComponents: [
    { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 60 },
    { componentType: "RULE_OF_LAW", effectivenessScore: 60 },
  ],
  fiscalSystem: {
    corporateTaxRates: null,
    personalIncomeTaxRates: JSON.stringify({ incomeRate: 20 }),
    salesTaxRate: null,
    exciseTaxRates: null,
    wealthTaxRate: null,
    taxEfficiency: 0.9,
  },
  economicProfile: {
    sectorBreakdown: JSON.stringify([
      { name: "Manufacturing", share: 40 },
      { name: "Services", share: 60 },
    ]),
    exportsGDPPercent: 25,
    importsGDPPercent: 20,
  },
};

const mockGovFull = {
  id: "gov_1",
  governmentName: "Government of Testland",
  totalBudget: 72_000_000_000,
  budgetCurrency: "USD",
  departments: [
    {
      id: "dept_1",
      name: "Ministry of Education",
      category: "Education",
      ministerTitle: "Minister",
      minister: "Ada Lovelace",
    },
    {
      id: "dept_2",
      name: "Ministry of Defense",
      category: "Defense",
      ministerTitle: "Minister",
      minister: null,
    },
  ],
  budgetAllocations: [
    {
      id: "alloc_1",
      departmentId: "dept_1",
      budgetYear: 2026,
      allocatedPercent: 30,
      allocatedAmount: 21.6e9,
    },
    {
      id: "alloc_2",
      departmentId: "dept_2",
      budgetYear: 2026,
      allocatedPercent: 25,
      allocatedAmount: 18e9,
    },
  ],
};

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      countries: { invalidate: mockInvalidate.countries },
      mycountry: {
        getCountryDashboard: { invalidate: mockInvalidate.dashboard },
        getFirstSteps: { invalidate: mockInvalidate.firstSteps },
      },
      government: {
        invalidate: mockInvalidate.government,
        getFullByCountryId: { invalidate: mockInvalidate.governmentFull },
        getByCountryId: { invalidate: mockInvalidate.governmentById },
        getOfficials: { invalidate: jest.fn() },
      },
      elections: {
        getLegislature: { invalidate: jest.fn() },
        getParties: { invalidate: jest.fn() },
        getCurrentParliament: { invalidate: jest.fn() },
        getElectionStatus: { invalidate: jest.fn() },
        getElections: { invalidate: jest.fn() },
      },
      users: { getProfile: { invalidate: mockInvalidate.profile } },
    }),
    users: {
      getProfile: { useQuery: () => ({ data: { countryId: "c1" }, isSuccess: true }) },
    },
    countries: {
      getEditorState: {
        useQuery: () => ({
          data: mockLoaded.current ?? mockState,
          isError: false,
          refetch: async () => ({ data: mockFresh.current ?? mockState }),
        }),
      },
      checkNameAvailable: {
        useQuery: () => ({ data: { available: true, reason: null }, isFetching: false }),
      },
      rename: { useMutation: (opts: SaveCall["opts"]) => mockMutation("rename", opts) },
      saveIdentity: { useMutation: (opts: SaveCall["opts"]) => mockMutation("saveIdentity", opts) },
      saveGovernmentForm: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("saveGovernmentForm", opts),
      },
      saveGovernmentComponents: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("saveGovernmentComponents", opts),
      },
      saveSize: { useMutation: (opts: SaveCall["opts"]) => mockMutation("saveSize", opts) },
      saveEconomicFigures: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("saveEconomicFigures", opts),
      },
    },
    economics: {
      updateFiscalSystem: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("updateFiscalSystem", opts),
      },
    },
    government: {
      getFullByCountryId: {
        useQuery: () => ({ data: mockGovFull, isLoading: false, isSuccess: true }),
      },
      getByCountryId: {
        useQuery: () => ({ data: mockGovFull, isLoading: false }),
      },
      getOfficials: {
        useQuery: () => ({ data: mockEmptyList, isLoading: false }),
      },
      appointOfficial: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("appointOfficial", opts),
      },
      removeOfficial: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("removeOfficial", opts),
      },
      setAllocations: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("setAllocations", opts),
      },
      addDepartment: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("addDepartment", opts),
      },
      removeDepartment: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("removeDepartment", opts),
      },
      startBudgetYear: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("startBudgetYear", opts),
      },
    },
    elections: {
      getLegislature: {
        useQuery: () => ({
          data: mockLegislature,
          refetch: jest.fn(),
        }),
      },
      configureLegislature: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("configureLegislature", opts),
      },
      getParties: {
        useQuery: () => ({ data: mockEmptyList, refetch: jest.fn() }),
      },
      createParty: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("createParty", opts),
      },
      updateParty: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("updateParty", opts),
      },
      deleteParty: {
        useMutation: (opts: SaveCall["opts"]) => mockMutation("deleteParty", opts),
      },
    },
  },
}));

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  usePathname: () => "/mycountry/editor",
}));
jest.mock("~/context/auth-context", () => ({
  useUser: () => ({ user: { id: "user_1" }, isLoaded: true }),
}));
jest.mock("~/hooks/useNationClock", () => ({
  useNationClock: () => ({
    now: () => Date.UTC(2026, 5, 1),
    epochYear: 2000,
    multiplier: 1,
    calendar: { calendarOffsetMs: 0 },
  }),
}));
jest.mock("~/hooks/useRealmClock", () => ({
  useRealmClock: () => null,
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
jest.mock("~/components/ui/value-select", () =>
  jest.requireActual("~/tests/helpers/native-value-select")
);
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/components/shell/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
jest.mock("~/components/shared/flags/UnifiedCountryFlag", () => ({
  UnifiedCountryFlag: () => null,
}));
jest.mock("~/app/r/[realm]/_components/manage/RealmImageField", () => ({
  RealmImageField: ({ id, label }: { id: string; label: string }) => (
    <label htmlFor={id}>
      {label}
      <input id={id} />
    </label>
  ),
}));

import MyCountryEditorPage from "~/app/mycountry/editor/page";

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
  window.scrollTo = jest.fn();
});
beforeEach(() => {
  mockCalls.length = 0;
  mockFresh.current = null;
  mockLoaded.current = null;
  mockPush.mockClear();
  window.history.replaceState(null, "", "#");
  Object.values(mockInvalidate).forEach((fn) => fn.mockClear());
});

describe("the country editor studio", () => {
  it("keeps a section's save disabled until it changes, then sends only what changed", () => {
    render(<MyCountryEditorPage />);
    const save = screen.getByRole("button", { name: "Save culture" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    expect(lastSave()).toMatchObject({
      name: "saveIdentity",
      input: {
        countryId: "c1",
        section: "culture",
        identity: { demonym: "Testian" },
        expected: { identity: { demonym: "Testish" } },
      },
    });
    expect(screen.getByRole("button", { name: "Save capital and language" })).toBeDisabled();

    act(() => lastSave().opts.onSuccess({ identity: { demonym: "Testian" } }, lastSave().input));
    expect(screen.getByLabelText("Demonym")).toHaveValue("Testian");
    expect(screen.getByRole("button", { name: "Save culture" })).toBeDisabled();
    expect(mockInvalidate.countries).toHaveBeenCalledTimes(1);
    expect(mockInvalidate.dashboard).toHaveBeenCalledTimes(1);
    expect(mockInvalidate.government).toHaveBeenCalledTimes(1);
  });

  it("shows a capital placed on the map read-only, with the way to the map editor", () => {
    mockLoaded.current = {
      ...mockState,
      nationalIdentity: {
        ...mockState.nationalIdentity,
        capitalCity: "Port Test",
        capitalCityRef: { name: "Port Test" },
      },
    };
    render(<MyCountryEditorPage />);
    expect(screen.queryByRole("textbox", { name: "Capital city" })).toBeNull();
    expect(screen.getByText("Port Test")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Rename or move it in the map editor" })
    ).toHaveAttribute("href", "/mycountry/map-editor");
    fireEvent.change(screen.getByLabelText("Largest city"), { target: { value: "Big Town" } });
    fireEvent.click(screen.getByRole("button", { name: "Save capital and language" }));
    expect(lastSave().input).toMatchObject({ identity: { largestCity: "Big Town" } });
    expect(lastSave().input.identity).not.toHaveProperty("capitalCity");
  });

  it("opens Population and baselines (#scale) and saves size and economic figures", () => {
    render(<MyCountryEditorPage />);
    fireEvent.click(screen.getByRole("link", { name: /Population and baselines/i }));

    fireEvent.change(screen.getByLabelText("Population"), { target: { value: "20000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Save size" }));
    expect(lastSave()).toMatchObject({
      name: "saveSize",
      input: {
        population: 20_000_000,
        gdpPerCapita: 30_000,
        expected: { baselinePopulation: 11_000_000, baselineGdpPerCapita: 28_000 },
      },
    });

    const inflation = screen.getByLabelText("Inflation (% a year)");
    const unemployment = screen.getByLabelText("Unemployment (% of the workforce)");
    expect(inflation).toHaveValue("");
    expect(inflation).toHaveAttribute("placeholder", "2.4");
    expect(screen.getByText(/Estimated from your economy: 2.4%/)).toBeInTheDocument();
    expect(unemployment).toHaveValue("6.1");
    const saveFigures = screen.getByRole("button", { name: "Save economic figures" });
    expect(saveFigures).toBeDisabled();

    fireEvent.change(inflation, { target: { value: "0" } });
    expect(screen.getByText(/0 counts as no figure here/)).toBeInTheDocument();
    fireEvent.click(saveFigures);
    expect(mockCalls).toHaveLength(1);

    fireEvent.change(inflation, { target: { value: "3.5" } });
    fireEvent.change(unemployment, { target: { value: "" } });
    fireEvent.click(saveFigures);
    expect(lastSave()).toMatchObject({
      name: "saveEconomicFigures",
      input: {
        countryId: "c1",
        figures: { inflationRate: 3.5, unemploymentRate: null },
        expected: { inflationRate: null, unemploymentRate: 6.1 },
      },
    });
  });

  it("edits tax rates without padlocks and saves explicitly, including flattening brackets", () => {
    mockLoaded.current = {
      ...mockState,
      fiscalSystem: {
        ...mockState.fiscalSystem,
        personalIncomeTaxRates: JSON.stringify([
          { bracket: 0, rate: 10 },
          { bracket: 50_000, rate: 35 },
        ]),
      },
    };
    render(<MyCountryEditorPage />);
    fireEvent.click(screen.getByRole("link", { name: /Taxes and tariffs/i }));

    const saveTaxes = screen.getByRole("button", { name: "Save tax rates" });
    expect(saveTaxes).toBeDisabled();

    // Unlocked by default: type a VAT rate and confirm no mutation fires before clicking Save.
    const vatInput = screen.getByLabelText("VAT and sales tax rate, percent");
    fireEvent.change(vatInput, { target: { value: "12" } });
    fireEvent.blur(vatInput);
    expect(mockCalls).toHaveLength(0);
    expect(saveTaxes).toBeEnabled();

    // Flatten bracketed income tax to one rate via confirmation dialog.
    fireEvent.click(screen.getByRole("button", { name: "Use one rate" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/becomes a flat 35%/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Use one rate" }));

    fireEvent.click(saveTaxes);
    expect(lastSave()).toMatchObject({
      name: "updateFiscalSystem",
      input: {
        countryId: "c1",
        salesTaxRate: 12,
        personalIncomeTaxRates: JSON.stringify({ incomeRate: 35 }),
      },
    });
  });

  it("batch-saves department budget shares in one transaction and blocks totals over 100%", () => {
    render(<MyCountryEditorPage />);
    fireEvent.click(screen.getByRole("link", { name: /Departments and budget/i }));

    const saveBudget = screen.getByRole("button", { name: "Save budget allocations" });
    expect(saveBudget).toBeDisabled();

    const eduInput = screen.getByLabelText("Ministry of Education share of the budget, in percent");
    const defInput = screen.getByLabelText("Ministry of Defense share of the budget, in percent");

    // Push total past 100% (80% + 30% = 110%): Save is blocked with alert.
    fireEvent.change(eduInput, { target: { value: "80" } });
    fireEvent.blur(eduInput);
    fireEvent.change(defInput, { target: { value: "30" } });
    fireEvent.blur(defInput);
    expect(screen.getByRole("alert")).toHaveTextContent(/exceeds 100% of the budget/i);
    expect(saveBudget).toBeDisabled();

    // Bring total to 75% (45% + 30%) and batch-save both departments at once.
    fireEvent.change(eduInput, { target: { value: "45" } });
    fireEvent.blur(eduInput);
    expect(saveBudget).toBeEnabled();
    fireEvent.click(saveBudget);
    expect(lastSave()).toMatchObject({
      name: "setAllocations",
      input: {
        countryId: "c1",
        allocations: [
          { departmentId: "dept_1", allocatedPercent: 45 },
          { departmentId: "dept_2", allocatedPercent: 30 },
        ],
      },
    });
  });

  it("on a conflict, reloads only the section in conflict and keeps other unsaved edits", async () => {
    render(<MyCountryEditorPage />);
    fireEvent.change(screen.getByLabelText("Capital city"), { target: { value: "New Port" } });
    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    fireEvent.click(screen.getByRole("button", { name: "Save culture" }));

    act(() =>
      lastSave().opts.onError({
        message: "Culture changed since you opened it",
        data: { code: "CONFLICT" },
      })
    );
    expect(screen.getByText("Culture changed since you opened it")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save culture" })).toBeDisabled();

    mockFresh.current = {
      ...mockState,
      nationalIdentity: { demonym: "Testese", capitalCity: "Other Port", drivingSide: "right" },
    };
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Reload culture" }));
    });

    expect(screen.queryByText("Culture changed since you opened it")).toBeNull();
    expect(screen.getByLabelText("Demonym")).toHaveValue("Testese");
    expect(screen.getByLabelText("Capital city")).toHaveValue("New Port");
    expect(screen.getByRole("button", { name: "Save capital and language" })).toBeEnabled();
  });

  it("preserves unsaved drafts across studio panes and lists them in LeaveGuard", () => {
    render(<MyCountryEditorPage />);
    fireEvent.click(screen.getByRole("link", { name: /Map editor/i }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();

    // Dirty Culture on Identity pane, then switch to Taxes pane and dirty Tax rates too.
    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    fireEvent.click(screen.getByRole("link", { name: /Taxes and tariffs/i }));
    const vatInput = screen.getByLabelText("VAT and sales tax rate, percent");
    fireEvent.change(vatInput, { target: { value: "14" } });
    fireEvent.blur(vatInput);

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: /Map editor/i }));
    });
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Leave without saving?")).toBeInTheDocument();
    const listed = within(within(dialog).getByRole("list")).getAllByRole("listitem");
    expect(listed.map((li) => li.textContent).sort()).toEqual(["Culture", "Tax rates"]);
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Leave" }));
    expect(mockPush).toHaveBeenCalledWith("/mycountry/map-editor");
  });

  describe("the current studio pane", () => {
    const paneLinks = () =>
      screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.startsWith("#"));
    const current = () =>
      paneLinks()
        .filter((link) => link.getAttribute("aria-current") === "location")
        .map((link) => link.getAttribute("href"));

    it("starts on #identity by default, or resolves a deep-linked sub-section hash", () => {
      const first = render(<MyCountryEditorPage />);
      expect(current()).toEqual(["#identity"]);
      first.unmount();

      window.history.replaceState(null, "", "#tariffs");
      render(<MyCountryEditorPage />);
      expect(current()).toEqual(["#taxes"]);
    });

    it("follows a sidebar click and external hashchange events", () => {
      render(<MyCountryEditorPage />);
      const [, second, third] = paneLinks();
      fireEvent.click(second!);
      expect(current()).toEqual([second!.getAttribute("href")]);

      act(() => {
        window.history.replaceState(null, "", third!.getAttribute("href")!);
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      });
      expect(current()).toEqual([third!.getAttribute("href")]);
    });
  });
});
