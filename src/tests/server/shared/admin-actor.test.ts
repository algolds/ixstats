/** @jest-environment node */
/** The signed-in admin the card, Loreward and wiki admin routers hand to their modules. */
import { adminActor } from "~/server/shared/admin-actor";

describe("adminActor", () => {
  it("takes the DB id for the rows the admin changes and the Clerk id for the audit row", () => {
    expect(adminActor({ user: { id: "db_admin" }, auth: { userId: "clerk_admin" } })).toEqual({
      dbId: "db_admin",
      clerkId: "clerk_admin",
    });
  });

  it("refuses a context with no signed-in user or Clerk id", () => {
    expect(() => adminActor({ user: null, auth: { userId: "clerk_admin" } })).toThrow(
      "Sign in as an admin."
    );
    expect(() => adminActor({ user: { id: "db_admin" }, auth: { userId: null } })).toThrow(
      "Sign in as an admin."
    );
    expect(() => adminActor({ user: { id: "db_admin" }, auth: null })).toThrow(
      "Sign in as an admin."
    );
  });
});
