/**
 * The country editor page: one list drives the grouped nav and the sections, each section saves
 * on its own button (disabled until something changed) and sends only what changed, and the
 * leave guard names the sections with unsaved changes.
 */
import React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";

const mockMutations: Record<string, { mutate: jest.Mock; isPending: boolean }> = {};
function mockMutation(name: string) {
  mockMutations[name] ??= { mutate: jest.fn(), isPending: false };
  return mockMutations[name];
}
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
  updatedAt: new Date("2026-10-20T10:00:00.000Z"),
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
        useQuery: () => ({ data: mockState, isError: false, refetch: jest.fn() }),
      },
      checkNameAvailable: {
        useQuery: () => ({ data: { available: true, reason: null }, isFetching: false }),
      },
      rename: { useMutation: () => mockMutation("rename") },
      saveIdentity: { useMutation: () => mockMutation("saveIdentity") },
      saveGovernmentForm: { useMutation: () => mockMutation("saveGovernmentForm") },
      saveGovernmentComponents: { useMutation: () => mockMutation("saveGovernmentComponents") },
      saveSize: { useMutation: () => mockMutation("saveSize") },
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
  for (const m of Object.values(mockMutations)) m.mutate.mockClear();
  mockPush.mockClear();
});

describe("the country editor", () => {
  it("renders every group and section from one list, with one h1 and h2 sections", () => {
    render(<MyCountryEditorPage />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeInTheDocument();

    const groups = editorGroups(mockState as never, 0);
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
    expect(mockMutations.saveIdentity!.mutate).toHaveBeenCalledWith({
      countryId: "c1",
      expectedUpdatedAt: mockState.updatedAt,
      identity: { demonym: "Testian" },
    });
    // Other sections did not change.
    expect(screen.getByRole("button", { name: "Save capital and language" })).toBeDisabled();
  });

  it("moves focus to the first field to fix instead of saving", () => {
    render(<MyCountryEditorPage />);
    const iso = screen.getByLabelText("Country code");
    fireEvent.change(iso, { target: { value: "E1" } });
    expect(iso).toHaveAttribute("aria-invalid", "true");
    fireEvent.click(screen.getByRole("button", { name: "Save civic standards" }));
    expect(iso).toHaveFocus();
    expect(mockMutations.saveIdentity!.mutate).not.toHaveBeenCalled();
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
