/**
 * The Admin app follows `canOpenAdmin` (the single admin entry in the shell, without duplicating
 * `realm-admin` inside Realms). The Labs bypass of `showLabsTab` still follows `isAdmin`.
 */
import { getVisibleApps } from "~/lib/navigation/app-sections";

const ids = (apps: ReturnType<typeof getVisibleApps>) => apps.map((app) => app.id);
const realmSections = (apps: ReturnType<typeof getVisibleApps>) =>
  apps.find((app) => app.id === "countries")?.sections.map((s) => s.id) ?? [];
const labsOff = { showLabsTab: false };

describe("getVisibleApps and the admin rule", () => {
  it("shows the Admin app to a user who can open /admin, without duplicating realm-admin in Realms or bypassing Labs", () => {
    const apps = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      canOpenAdmin: true,
      navigationSettings: labsOff,
    });
    expect(ids(apps)).toContain("admin");
    expect(realmSections(apps)).toEqual(["my-realm", "explore"]);
    expect(ids(apps)).not.toContain("labs");
  });

  it("hides the Admin app from a user who cannot open /admin", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: false, canOpenAdmin: false });
    expect(ids(apps)).not.toContain("admin");
  });

  it("keeps the Labs bypass for a level-10 admin", () => {
    const apps = getVisibleApps({
      signedIn: true,
      isAdmin: true,
      canOpenAdmin: true,
      navigationSettings: labsOff,
    });
    expect(ids(apps)).toContain("labs");
  });
});
