/** @jest-environment node */
/** System realms (Realm.isSystem): shelves for cards, never listed, claimable, mapped or deleted (spec §5.1). */
jest.mock("~/server/db", () => ({ db: {} }));
jest.mock("~/lib/auth", () => ({ isSystemOwner: () => false }));

import { REALM_SLUG_PATTERN } from "~/lib/realms/realm-slug";
import { SYSTEM_REALM_IDS } from "~/lib/realms/realm-ids";
import {
  findRealmIdBySlug,
  getRealmHub,
  isRealmOpen,
  isRealmPublished,
  isSystemRealm,
} from "~/server/modules/realms";
import { deleteRealm } from "~/server/modules/realms/realms.admin";
import { DIRECTORY_REALM_WHERE } from "~/server/shared/realm-directory";
import { createMockPrisma } from "~/tests/helpers/mock-db";

const admin = { id: "u_admin", clerkUserId: "clerk_admin", role: { name: "admin", level: 10 } };
const systemRow = (id: string) => ({
  id,
  slug: id,
  name: id,
  description: null,
  thumbnail: null,
  ownerId: "system",
  status: "active",
  visibility: "public",
  countries: [],
  pages: [],
  _count: { pages: 0, countries: 0 },
});

describe("system realms", () => {
  it("are known by id, and Ixnay is not one", () => {
    for (const id of SYSTEM_REALM_IDS) expect(isSystemRealm({ id })).toBe(true);
    expect(isSystemRealm({ id: "default" })).toBe(false);
    expect(isSystemRealm({ id: "eurth" })).toBe(false);
  });

  it("are never open to claims or new nations, nor published, though their rows say active", () => {
    for (const id of SYSTEM_REALM_IDS) {
      expect(isRealmOpen(id, "active")).toBe(false);
      expect(isRealmPublished(id, "active")).toBe(false);
    }
    expect(isRealmOpen("eurth", "active")).toBe(true);
    expect(isRealmOpen("default", "draft")).toBe(true);
  });

  it("are left out of the directory", () => {
    expect(DIRECTORY_REALM_WHERE).toMatchObject({ isSystem: false });
  });

  it("have no hub, even for a site admin", async () => {
    const db = createMockPrisma();
    db.realm.findUnique.mockResolvedValue(systemRow("nationstates"));
    await expect(getRealmHub(db, "nationstates", admin)).resolves.toBeNull();
    expect(db.realmPage.findFirst).not.toHaveBeenCalled();
  });

  it("never become the viewer's realm: their slug resolves like an unknown one", async () => {
    const db = createMockPrisma();
    db.realm.findUnique.mockResolvedValue({ id: "iiwiki", status: "active", ownerId: "system" });
    await expect(findRealmIdBySlug(db, "iiwiki", admin)).resolves.toBeNull();
  });

  it("can't be deleted, and nor can a realm that still has cards", async () => {
    const db = createMockPrisma();
    await expect(
      deleteRealm(db, admin, { realmId: "althistory", confirmSlug: "althistory" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "System realms can't be deleted" });
    expect(db.realm.findUnique).not.toHaveBeenCalled();

    db.realm.findUnique.mockResolvedValue({
      id: "eurth",
      slug: "eurth",
      name: "Eurth",
      _count: { countries: 0 },
    });
    db.mapLayer.count.mockResolvedValue(0);
    db.card.count.mockResolvedValue(3);
    await expect(
      deleteRealm(db, admin, { realmId: "eurth", confirmSlug: "eurth" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(db.card.count).toHaveBeenCalledWith({ where: { realmId: "eurth" } });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("keep their slugs: no new realm may take one", () => {
    for (const slug of SYSTEM_REALM_IDS) expect(REALM_SLUG_PATTERN.test(slug)).toBe(false);
    expect(REALM_SLUG_PATTERN.test("mine")).toBe(false);
    expect(REALM_SLUG_PATTERN.test("iiwiki-fans")).toBe(true);
  });
});
