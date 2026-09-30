import { DEFAULT_REALM_ID, resolveViewerRealmId } from "~/server/modules/realms";

const db = (row: { id: string } | null) => ({ realm: { findUnique: jest.fn().mockResolvedValue(row) } }) as any;

describe("resolveViewerRealmId", () => {
  it("prefers an explicit slug", async () => {
    await expect(resolveViewerRealmId(db({ id: "r_eurth" }), { realmSlug: "eurth", activeRealmId: "default" })).resolves.toBe("r_eurth");
  });
  it("falls back to IxWorld for an unknown slug", async () => {
    await expect(resolveViewerRealmId(db(null), { realmSlug: "nope" })).resolves.toBe(DEFAULT_REALM_ID);
  });
  it("uses the active nation's realm, else IxWorld, without a query", async () => {
    const d = db(null);
    await expect(resolveViewerRealmId(d, { activeRealmId: "r_eurth" })).resolves.toBe("r_eurth");
    await expect(resolveViewerRealmId(d, {})).resolves.toBe(DEFAULT_REALM_ID);
    expect(d.realm.findUnique).not.toHaveBeenCalled();
  });
});
