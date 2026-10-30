/** Halo search offers the Admin panel to admins only. */
import { commandsFor } from "~/components/halo/halo-registry";

const hasAdminPanel = (isAdmin: boolean) =>
  commandsFor(isAdmin).some((command) => command.path === "/admin");

describe("commandsFor", () => {
  it("leaves the Admin panel out for non-admins", () => {
    expect(hasAdminPanel(false)).toBe(false);
  });

  it("lists the Admin panel for admins", () => {
    expect(hasAdminPanel(true)).toBe(true);
  });

  it("keeps the other commands for everyone", () => {
    expect(commandsFor(false).map((command) => command.name)).toContain("Account settings");
  });
});
