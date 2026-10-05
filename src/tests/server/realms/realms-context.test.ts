import { DEFAULT_REALM_ID, resolveViewerRealmId } from "~/server/modules/realms";

const db = (row: { id: string; status?: string; ownerId?: string } | null) =>
  ({ realm: { findUnique: jest.fn().mockResolvedValue(row) } }) as any;

describe("resolveViewerRealmId", () => {
  it("prefers an explicit slug", async () => {
    await expect(
      resolveViewerRealmId(db({ id: "r_eurth" }), { realmSlug: "eurth", activeRealmId: "default" })
    ).resolves.toBe("r_eurth");
  });
  it("falls back to IxWorld for an unknown slug", async () => {
    await expect(resolveViewerRealmId(db(null), { realmSlug: "nope" })).resolves.toBe(
      DEFAULT_REALM_ID
    );
  });
  it("uses the active nation's realm, else IxWorld, without a query", async () => {
    const d = db(null);
    await expect(resolveViewerRealmId(d, { activeRealmId: "r_eurth" })).resolves.toBe("r_eurth");
    await expect(resolveViewerRealmId(d, {})).resolves.toBe(DEFAULT_REALM_ID);
    expect(d.realm.findUnique).not.toHaveBeenCalled();
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
