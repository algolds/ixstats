/** @jest-environment node */
/**
 * cardImages, smallArmsEquipment, formulas and systemValidation routers.
 *
 * Card images: public reads; changing them needs write access to the country (FORBIDDEN, not a
 * server error, for anyone else). Small arms: public, paginated catalog reads. Formulas and
 * system validation: admin only.
 */
import { describe, it, expect, beforeEach } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { cardImagesRouter } from "~/server/api/routers/cardImages";
import { smallArmsEquipmentRouter } from "~/server/api/routers/smallArmsEquipment";
import { formulasRouter } from "~/server/api/routers/formulas";
import { systemValidationRouter } from "~/server/api/routers/system-validation";
import { createMockRouterContext } from "~/tests/helpers/router-context";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";

const USER = { name: "user", level: 100 };
const ADMIN = { name: "admin", level: 10 };

function ctx(db: MockPrismaProxy, id: string | null, role = USER, countryId = "c_mine") {
  return createMockRouterContext({
    db,
    auth: id ? { userId: `clerk_${id}` } : null,
    user: id ? { id, clerkUserId: `clerk_${id}`, countryId, role } : null,
    rateLimitIdentifier: `${id}_${Math.random()}`,
  }) as never;
}

let db: MockPrismaProxy;

beforeEach(() => {
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockResolvedValue({ id: "c_other", ownerUserId: "someone_else" });
});

describe("cardImages", () => {
  const images = createCallerFactory(cardImagesRouter);
  const image = {
    countryId: "c_other",
    cardType: "trade" as const,
    imageUrl: "https://example.com/bg.png",
  };

  it("refuses to change another country's card images", async () => {
    const caller = images(ctx(db, "u1"));
    await expect(caller.upsert(image)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.delete({ countryId: "c_other", cardType: "trade" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(db.cardBackgroundImage.upsert).not.toHaveBeenCalled();
    expect(db.cardBackgroundImage.delete).not.toHaveBeenCalled();
  });

  it("rejects signed-out callers", async () => {
    await expect(images(ctx(db, null)).upsert(image)).rejects.toThrow(/Authentication required/);
  });
  it("lets the country's owner reset an image even when it is not their active nation", async () => {
    db.country.findUnique.mockResolvedValue({ id: "c_other", ownerUserId: "u1" });
    await expect(
      images(ctx(db, "u1")).delete({ countryId: "c_other", cardType: "trade" })
    ).resolves.toEqual({ success: true });
  });

  it("validates the card type and URL", async () => {
    const caller = images(ctx(db, "u1"));
    await expect(caller.upsert({ ...image, imageUrl: "not a url" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(caller.upsert({ ...image, cardType: "weather" as never })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("smallArmsEquipment", () => {
  const arms = createCallerFactory(smallArmsEquipmentRouter);
  it("caps the page size", async () => {
    await expect(arms(ctx(db, null)).getAllEquipment({ limit: 501 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });
});

describe("formulas", () => {
  const formulas = createCallerFactory(formulasRouter);

  it("is admin only", async () => {
    const player = formulas(ctx(db, "u1"));
    await expect(player.getAll()).rejects.toThrow(/Admin privileges required/);
    await expect(player.update({ id: "gdp-growth" })).rejects.toThrow(/Admin privileges required/);
    await expect(player.testFormula({ formulaId: "gdp-growth", testInputs: {} })).rejects.toThrow(
      /Admin privileges required/
    );
    expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  });

  it("records an update request in the admin audit log", async () => {
    db.adminAuditLog.create.mockResolvedValue({ id: "audit1" });
    const result = await formulas(ctx(db, "admin", ADMIN)).update({
      id: "gdp-growth",
      variables: { baseGrowthRate: 0.03 },
    });
    expect(result).toMatchObject({ success: true, auditId: "audit1" });
    expect(db.adminAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "FORMULA_UPDATE_REQUEST", targetId: "gdp-growth" }),
    });
  });
});

describe("systemValidation", () => {
  const validation = createCallerFactory(systemValidationRouter);

  it("is admin only", async () => {
    await expect(validation(ctx(db, "u1")).checkDatabase()).rejects.toThrow(
      /Admin privileges required/
    );
    await expect(validation(ctx(db, "u1")).checkSubsystems()).rejects.toThrow(
      /Admin privileges required/
    );
  });
});
