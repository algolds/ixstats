/** The country page's old addresses each send the visitor to the tab or sheet that holds their content now. */
import ActivityPage from "~/app/countries/[slug]/(profile)/activity/page";
import DossierPage from "~/app/countries/[slug]/(profile)/dossier/page";
import FactbookPage from "~/app/countries/[slug]/(profile)/factbook/page";
import EconomyPage from "~/app/countries/[slug]/(profile)/factbook/economy/page";
import LaborPage from "~/app/countries/[slug]/(profile)/factbook/labor/page";
import GovernmentPage from "~/app/countries/[slug]/(profile)/factbook/government/page";
import GeographyPage from "~/app/countries/[slug]/(profile)/factbook/geography/page";

const redirect = jest.fn();
jest.mock("next/navigation", () => ({ redirect: (href: string) => redirect(href) }));

const params = Promise.resolve({ slug: "caphiria" });

describe("legacy country addresses", () => {
  it.each([
    ["activity", ActivityPage, "/countries/caphiria/history"],
    ["dossier", DossierPage, "/countries/caphiria/lore"],
    ["factbook", FactbookPage, "/countries/caphiria?sheet=economy"],
    ["factbook/economy", EconomyPage, "/countries/caphiria?sheet=economy"],
    ["factbook/labor", LaborPage, "/countries/caphiria?sheet=economy&segment=labor"],
    ["factbook/government", GovernmentPage, "/countries/caphiria?sheet=state"],
    ["factbook/geography", GeographyPage, "/countries/caphiria/map"],
  ])("/%s redirects to %s", async (_path, Page, href) => {
    await Page({ params });
    expect(redirect).toHaveBeenLastCalledWith(href);
  });
});
