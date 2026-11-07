/** The Exchange is its own app: public sections for everyone, Portfolio and My companies when signed in, Treasury for nation owners. */
import { getVisibleApps } from "~/lib/navigation/app-sections";

const exchangeSections = (apps: ReturnType<typeof getVisibleApps>) =>
  apps.find((a) => a.id === "exchange")?.sections.map((s) => s.id) ?? null;

describe("the Exchange in the sidebar", () => {
  it("is visible signed out, with the watching sections only", () => {
    expect(exchangeSections(getVisibleApps({ signedIn: false, isAdmin: false }))).toEqual([
      "front",
      "markets",
      "tenders",
      "leaderboards",
    ]);
  });

  it("adds Portfolio and My companies when signed in, and Treasury for a nation owner", () => {
    expect(exchangeSections(getVisibleApps({ signedIn: true, isAdmin: false }))).toEqual([
      "front",
      "markets",
      "tenders",
      "leaderboards",
      "portfolio",
      "companies",
    ]);
    expect(exchangeSections(getVisibleApps({ signedIn: true, isAdmin: false, ownsNation: true }))).toContain(
      "treasury"
    );
  });

  it("is no longer a Labs section", () => {
    const labs = getVisibleApps({ signedIn: true, isAdmin: true }).find((a) => a.id === "labs");
    expect(labs?.sections.map((s) => s.id)).not.toContain("exchange");
  });
});
