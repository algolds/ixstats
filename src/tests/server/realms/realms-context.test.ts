import { DEFAULT_REALM_ID, resolveViewerRealmId } from "~/server/modules/realms";

const db = (row: { id: string; status?: string; ownerId?: string } | null) =>
  ({ realm: { findUnique: jest.fn().mockResolvedValue(row) } }) as any;

describe("resolveViewerRealmId", () => {
  it("finds Ixnay's row by id for its slugs, so a row still slugged ixworld resolves", async () => {
    const d = db({ id: "default", status: "active", ownerId: "system" });
    await expect(resolveViewerRealmId(d, { realmSlug: "ixnay" })).resolves.toBe(DEFAULT_REALM_ID);
    expect(d.realm.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "default" } })
    );
  });
  it("hides a draft or generating realm's slug from everyone but its staff (AT-6)", async () => {
    const draft = { id: "r_draft", status: "draft", ownerId: "clerk_founder" };
    const founder = { id: "u_f", clerkUserId: "clerk_founder", role: null };
    const admin = { id: "u_a", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };
    const player = { id: "u_p", clerkUserId: "clerk_player", role: null };
    await expect(resolveViewerRealmId(db(draft), { realmSlug: "d" })).resolves.toBe(
      DEFAULT_REALM_ID
    );
    await expect(resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: player })).resolves.toBe(
      DEFAULT_REALM_ID
    );
    await expect(
      resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: founder })
    ).resolves.toBe("r_draft");
    await expect(resolveViewerRealmId(db(draft), { realmSlug: "d", viewer: admin })).resolves.toBe(
      "r_draft"
    );
    const generating = { ...draft, status: "generating" };
    await expect(resolveViewerRealmId(db(generating), { realmSlug: "d" })).resolves.toBe(
      DEFAULT_REALM_ID
    );
  });

  it("resolves unlisted and archived realms by slug for anyone (reachable by link)", async () => {
    for (const status of ["active", "archived"]) {
      const row = { id: "r_hidden", status, ownerId: "system", visibility: "unlisted" };
      await expect(resolveViewerRealmId(db(row as never), { realmSlug: "h" })).resolves.toBe(
        "r_hidden"
      );
    }
  });
});
