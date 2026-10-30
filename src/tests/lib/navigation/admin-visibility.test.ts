/**
 * The ways into /admin (the Admin app and the Realms app's "Realm admin" row) follow `canOpenAdmin`, the one admin
 * rule. The Labs bypass of `showLabsTab` still follows `isAdmin` (level 10 or less), matching the Labs server gate.
 */
import { getVisibleApps } from "~/lib/navigation/app-sections";

const ids = (apps: ReturnType<typeof getVisibleApps>) => apps.map((app) => app.id);
const realmSections = (apps: ReturnType<typeof getVisibleApps>) =>
  apps
    .find((app) => app.sections.some((section) => section.href === "/realms"))
    ?.sections.map((s) => s.id) ?? [];
const labsOff = { showLabsTab: false };

describe("getVisibleApps and the admin rule", () => {
  it("shows the Admin app and Realm admin to a user who can open /admin, not the Labs bypass", () => {
    const apps = getVisibleApps({
      signedIn: true,
      isAdmin: false,
      canOpenAdmin: true,
      navigationSettings: labsOff,
    });
    expect(ids(apps)).toContain("admin");
    expect(realmSections(apps)).toContain("realm-admin");
    expect(ids(apps)).not.toContain("labs");
  });

  it("hides both from a user who cannot open /admin", () => {
    const apps = getVisibleApps({ signedIn: true, isAdmin: false, canOpenAdmin: false });
    expect(ids(apps)).not.toContain("admin");
    expect(realmSections(apps)).not.toContain("realm-admin");
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
