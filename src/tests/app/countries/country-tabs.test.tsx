/**
 * The country tabs after the Profile tab merged into the Factbook: the Factbook is the country's
 * own URL (it opens on the overview the Profile used to show), every `/factbook/<section>` keeps
 * the Factbook tab current, and the old `/factbook` index redirects to the country's URL.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { render, screen, within } from "@testing-library/react";
import {
  COUNTRY_TABS,
  CountryTabs,
  activeCountryTab,
} from "~/app/countries/[slug]/_components/CountryTabs";
import FactbookIndexRedirect from "~/app/countries/[slug]/(profile)/factbook/page";

const mockRedirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
let mockPathname = "/countries/testland";

jest.mock("next/navigation", () => ({
  redirect: (url: string) => mockRedirect(url),
  usePathname: () => mockPathname,
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

beforeEach(() => {
  mockRedirect.mockClear();
  mockPathname = "/countries/testland";
});

describe("COUNTRY_TABS", () => {
  it("lists the Factbook, Dossier and Activity, with no Profile tab", () => {
    expect(COUNTRY_TABS.map((t) => t.id)).toEqual(["factbook", "dossier", "activity"]);
    expect(COUNTRY_TABS.map((t) => t.label)).toEqual(["Factbook", "Dossier", "Activity"]);
  });

  it("puts the Factbook at the country's own URL", () => {
    expect(COUNTRY_TABS.find((t) => t.id === "factbook")?.path).toBe("");
  });
});

describe("activeCountryTab", () => {
  it.each([
    ["/countries/testland", "factbook"],
    ["/countries/testland/", "factbook"],
    ["/countries/testland/factbook", "factbook"],
    ["/countries/testland/factbook/economy", "factbook"],
    ["/countries/testland/factbook/geography", "factbook"],
    ["/countries/testland/dossier", "dossier"],
    ["/countries/testland/activity", "activity"],
    ["/ixstats/countries/testland/activity", "activity"],
    ["/countries/testland/unknown", "factbook"],
    [null, "factbook"],
  ])("maps %s to the %s tab", (pathname, tab) => {
    expect(activeCountryTab(pathname, "testland")).toBe(tab);
  });
});

describe("CountryTabs", () => {
  it.each([
    ["/countries/testland", "Factbook"],
    ["/countries/testland/factbook/labor", "Factbook"],
    ["/countries/testland/dossier", "Dossier"],
  ])("on %s marks %s current", (pathname, label) => {
    mockPathname = pathname;
    render(<CountryTabs countrySlug="testland" />);
    const tabs = screen.getByRole("navigation", { name: "Country sections" });
    const links = within(tabs).getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Factbook", "Dossier", "Activity"]);
    expect(links[0]!.getAttribute("href")).toMatch(/\/countries\/testland$/);
    const current = links.filter((l) => l.getAttribute("aria-current") === "page");
    expect(current.map((l) => l.textContent)).toEqual([label]);
  });
});

describe("/countries/[slug]/factbook", () => {
  it("redirects to the country's own URL, where the Factbook now opens", async () => {
    await expect(
      FactbookIndexRedirect({ params: Promise.resolve({ slug: "testland" }) })
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(mockRedirect).toHaveBeenCalledWith("/countries/testland");
  });
});
