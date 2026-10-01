/**
 * The `(profile)` layout: the bare profile URL renders its page (the Command profile brings its
 * own hero), while the deep-dives (`/factbook/**`, `/dossier`, `/activity`) render their own
 * route pages under the country header and tabs. There is no layout switcher any more.
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
  it("renders the profile page without the deep-dive header", async () => {
    await renderAt(null);
    expect(await screen.findByText("route page")).toBeTruthy();
    // The Command profile renders its own hero and tabs.
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Country sections" })).toBeNull();
    expect(screen.queryByText(/Prototype/)).toBeNull();
  });

  it.each(["factbook", "dossier", "activity"])(
    "renders the %s route page under the country header and tabs",
    async (segment) => {
      await renderAt(segment);
      expect(await screen.findByText("route page")).toBeTruthy();
      expect(screen.getByRole("heading", { level: 1, name: "Testland" })).toBeTruthy();
      const tabs = screen.getByRole("navigation", { name: "Country sections" });
      const current = tabs.querySelector('[aria-current="page"]');
      expect(current?.getAttribute("href")).toMatch(new RegExp(`/countries/testland/${segment}$`));
    }
  );
});
