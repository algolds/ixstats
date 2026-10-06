/**
 * The `(profile)` layout: the bare country URL renders its page (the Factbook overview brings its
 * own hero, tabs and section pills), while the deep-dives (`/factbook/<section>`, `/dossier`,
 * `/activity`) render their own route pages under the country header and tabs. The Factbook
 * sections keep the Factbook tab current. There is no layout switcher any more.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { Suspense } from "react";
import { act, render, screen } from "@testing-library/react";
import CountryProfileLayout from "~/app/countries/[slug]/(profile)/layout";

let mockSegment: string | null = null;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  usePathname: () => (mockSegment ? `/countries/testland/${mockSegment}` : "/countries/testland"),
  useSelectedLayoutSegment: () => mockSegment,
}));

jest.mock("~/components/mycountry/primitives", () => ({
  CountryDataProvider: ({ children }: { children: React.ReactNode }) => children,
  useCountryData: () => ({
    country: {
      id: "c1",
      name: "Testland",
      slug: "testland",
      flag: null,
      economicTier: "Developed",
      populationTier: "3",
      currentPopulation: 1_000_000,
      nationalIdentity: { motto: "Onward" },
    },
    isLoading: false,
    error: null,
    currentIxTime: 0,
  }),
}));
jest.mock("~/hooks/useUserCountry", () => ({
  useUserCountry: () => ({ user: null, userProfile: null }),
}));
jest.mock("~/hooks/useUnifiedFlags", () => ({
  useFlag: () => ({ flagUrl: null, isLoading: false }),
}));
jest.mock("~/hooks/usePageTitle", () => ({ usePageTitle: () => {} }));
jest.mock("~/components/mycountry/dossier/CountryActionsMenu", () => ({
  CountryActionsMenu: () => null,
}));
jest.mock("~/lib/media", () => ({
  unsplashService: { getCountryHeaderImage: () => new Promise(() => {}) },
}));

async function renderAt(segment: string | null) {
  mockSegment = segment;
  const params = Promise.resolve({ slug: "testland" });
  await act(async () => {
    render(
      <Suspense fallback={null}>
        <CountryProfileLayout params={params}>
          <p>route page</p>
        </CountryProfileLayout>
      </Suspense>
    );
    await params;
  });
}

beforeEach(() => {
  localStorage.clear();
});

describe("(profile) layout", () => {
  it("renders the Factbook overview page without the deep-dive header", async () => {
    await renderAt(null);
    expect(await screen.findByText("route page")).toBeTruthy();
    // The Command profile renders its own hero and tabs.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Country sections" })).toBeNull();
    expect(screen.queryByText(/Prototype/)).toBeNull();
  });

  it.each([
    ["factbook", "Factbook", "/countries/testland"],
    ["dossier", "Dossier", "/countries/testland/dossier"],
    ["activity", "Activity", "/countries/testland/activity"],
  ])(
    "renders the %s route page under the country header with the %s tab current",
    async (segment, label, href) => {
      await renderAt(segment);
      expect(await screen.findByText("route page")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeTruthy();
      const tabs = screen.getByRole("navigation", { name: "Country sections" });
      const current = tabs.querySelector('[aria-current="page"]');
      expect(current?.textContent).toBe(label);
      expect(current?.getAttribute("href")).toMatch(new RegExp(`${href}$`));
    }
  );

  it("has no Profile tab", async () => {
    await renderAt("dossier");
    const tabs = await screen.findByRole("navigation", { name: "Country sections" });
    expect(tabs.textContent).not.toMatch(/Profile/);
  });
});
