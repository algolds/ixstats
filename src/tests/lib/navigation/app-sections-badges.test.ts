import { getActiveSectionId, getVisibleApps } from "~/lib/navigation/app-sections";

const apps = getVisibleApps({
  signedIn: true,
  isAdmin: true,
  hasLabsAccess: true,
  navigationSettings: undefined,
});
const app = (id: string) => apps.find((a) => a.id === id)!;

describe("section map badges", () => {
  it("MyCountry shows the flag and Diplomacy carries the inbox count", () => {
    expect(app("mycountry").badge).toBe("mycountry-flag");
    expect(app("mycountry").sections.find((s) => s.id === "diplomacy")?.badge).toBe(
      "diplomacy-inbox"
    );
  });

  it("Vault shows the balance and a daily reward action row", () => {
    expect(app("vault").badge).toBe("vault-balance");
    const reward = app("vault").sections.find((s) => s.id === "daily-reward");
    expect(reward).toMatchObject({
      action: "daily-reward",
      badge: "daily-reward",
      label: "Daily reward",
    });
  });

  it("never marks the action row as the current section", () => {
    expect(getActiveSectionId(app("vault"), "/vault", null)).toBe("dashboard");
  });
});
