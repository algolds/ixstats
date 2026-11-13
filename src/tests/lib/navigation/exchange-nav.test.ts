/** The Exchange lives under Labs in the sidebar, with its own in-app ribbon for section navigation. */
import { getActiveSectionId, getApp, getAppForPath, getVisibleApps } from "~/lib/navigation/app-sections";

describe("the Exchange in the sidebar", () => {
  it("is listed as a section inside Labs and not as a separate top-level app", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: true });
    expect(apps.map((a) => a.id)).not.toContain("exchange");

    const labs = apps.find((a) => a.id === "labs");
    expect(labs).toBeDefined();
    const exchangeSection = labs?.sections.find((s) => s.id === "exchange");
    expect(exchangeSection).toBeDefined();
    expect(exchangeSection?.href).toBe("/exchange");
  });

  it("matches all /exchange sub-routes to Labs and highlights the Exchange section", () => {
    const labs = getApp("labs");
    expect(getAppForPath("/exchange")?.id).toBe("labs");
    expect(getAppForPath("/exchange/markets")?.id).toBe("labs");
    expect(getAppForPath("/exchange/c/c1")?.id).toBe("labs");
    expect(getAppForPath("/exchange/treasury")?.id).toBe("labs");

    expect(getActiveSectionId(labs, "/exchange", null)).toBe("exchange");
    expect(getActiveSectionId(labs, "/exchange/markets", null)).toBe("exchange");
    expect(getActiveSectionId(labs, "/exchange/c/c1", null)).toBe("exchange");
    expect(getActiveSectionId(labs, "/exchange/treasury", null)).toBe("exchange");
  });
});
