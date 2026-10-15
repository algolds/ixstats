/**
 * The country editor page: one list drives the grouped nav and the sections, each section saves
 * on its own button (disabled until something changed) and sends only what changed with the values
 * it loaded for them, a conflict reloads only that section, and the leave guard names the sections
 * with unsaved changes.
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

interface SaveCall {
  name: string;
  input: Record<string, unknown>;
  opts: {
    onSuccess: (result: unknown) => void;
    onError: (error: { message: string; data?: { code?: string } }) => void;
  };
}
/** Each `mutate` call with the options of the section that made it. */
const mockCalls: SaveCall[] = [];
function mockMutation(name: string, opts: SaveCall["opts"]) {
  return {
    mutate: (input: Record<string, unknown>) => mockCalls.push({ name, input, opts }),
    isPending: false,
  };
}
const lastSave = () => mockCalls[mockCalls.length - 1]!;
/** What a refetch returns (Reload); null means the state as first loaded. */
const mockFresh: { current: Record<string, unknown> | null } = { current: null };
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
  baselinePopulation: 11_000_000,
  baselineGdpPerCapita: 28_000,
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
  governmentComponents: [
    { componentType: "DEMOCRATIC_PROCESS", effectivenessScore: 60 },
    { componentType: "RULE_OF_LAW", effectivenessScore: 60 },
  ],
};

jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ countries: { getEditorState: { invalidate: jest.fn() } } }),
    users: {
      getProfile: { useQuery: () => ({ data: { countryId: "c1" }, isSuccess: true }) },
    },
    countries: {
      getEditorState: {
        useQuery: () => ({
          data: mockState,
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
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: jest.fn() }));
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
import { editorGroups } from "~/app/mycountry/editor/_components/CountryEditor";

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});
beforeEach(() => {
  mockCalls.length = 0;
  mockFresh.current = null;
  mockPush.mockClear();
});

describe("the country editor", () => {
  it("renders every group and section from one list, with one h1 and h2 sections", () => {
    render(<MyCountryEditorPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeInTheDocument();

    const groups = editorGroups(mockState as never);
    expect(groups.map((g) => g.label)).toEqual([
      "Identity",
      "Government",
      "Size",
      "Managed elsewhere",
    ]);
    const nav = screen.getByRole("navigation", { name: "Editor sections" });
    const links = within(nav).getAllByRole("link");
    const sectionIds = groups.flatMap((g) => g.sections.map((s) => s.id));
    expect(links.map((a) => a.getAttribute("href"))).toEqual(sectionIds.map((id) => `#${id}`));
    for (const group of groups) {
      expect(document.getElementById(group.id)).not.toBeNull();
      for (const section of group.sections) {
        expect(document.getElementById(section.id)?.tagName).toBe("SECTION");
      }
    }
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Name",
      "Flag and symbols",
      "Capital and language",
      "Culture",
      "Civic standards",
      "Form and institutions",
      "Institutions",
      "Population and wealth",
      "Managed elsewhere",
    ]);
  });

  it("keeps a section's save disabled until it changes, then sends only what changed", () => {
    render(<MyCountryEditorPage />);
    const save = screen.getByRole("button", { name: "Save culture" });
    expect(save).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    // Only the changed field, with the value the page loaded for it.
    expect(lastSave()).toMatchObject({
      name: "saveIdentity",
      input: {
        countryId: "c1",
        section: "culture",
        identity: { demonym: "Testian" },
        expected: { identity: { demonym: "Testish" } },
      },
    });
    // Other sections did not change.
    expect(screen.getByRole("button", { name: "Save capital and language" })).toBeDisabled();

    // The saved values come back and the section starts over from them.
    act(() => lastSave().opts.onSuccess({ identity: { demonym: "Testian" } }));
    expect(screen.getByLabelText("Demonym")).toHaveValue("Testian");
    expect(screen.getByRole("button", { name: "Save culture" })).toBeDisabled();
  });

  it("sends the loaded baseline with a new size", () => {
    render(<MyCountryEditorPage />);
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

    // Another tab saved both sections; only Culture is in conflict.
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

  it("moves focus to the first field to fix instead of saving", () => {
    render(<MyCountryEditorPage />);
    const iso = screen.getByLabelText("Country code");
    fireEvent.change(iso, { target: { value: "E1" } });
    expect(iso).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save civic standards" }));
    expect(iso).toHaveFocus();
    expect(mockCalls).toHaveLength(0);
  });

  it("shows what saving institutions does to government effectiveness", () => {
    render(<MyCountryEditorPage />);
    expect(screen.queryByText(/Government effectiveness:/)).toBeNull();
    fireEvent.click(screen.getByRole("checkbox", { name: /Rule of law/i }));
    expect(screen.getByText(/Government effectiveness: 62 → \d+/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save institutions" })).toBeEnabled();
  });

  it("warns that saving the size rescales the economy", () => {
    render(<MyCountryEditorPage />);
    expect(screen.getByText("Saving rescales the economy")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save size" })).toBeDisabled();
  });

  it("asks before leaving with unsaved changes and names the sections", () => {
    render(<MyCountryEditorPage />);
    // Nothing unsaved: links leave freely.
    fireEvent.click(screen.getByRole("link", { name: /Budget/ }));
    expect(screen.queryByText("Leave without saving?")).toBeNull();

    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    fireEvent.change(screen.getByLabelText("Capital city"), { target: { value: "New Port" } });
    act(() => {
      fireEvent.click(screen.getByRole("link", { name: /Budget/ }));
    });
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Leave without saving?")).toBeInTheDocument();
    const listed = within(within(dialog).getByRole("list")).getAllByRole("listitem");
    expect(listed.map((li) => li.textContent).sort()).toEqual(["Capital and language", "Culture"]);
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Leave" }));
    expect(mockPush).toHaveBeenCalledWith("/mycountry/economy?tab=fiscal");
  });

  it("does not ask for the section nav", () => {
    render(<MyCountryEditorPage />);
    fireEvent.change(screen.getByLabelText("Demonym"), { target: { value: "Testian" } });
    const nav = screen.getByRole("navigation", { name: "Editor sections" });
    fireEvent.click(within(nav).getByRole("link", { name: "Population and wealth" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
