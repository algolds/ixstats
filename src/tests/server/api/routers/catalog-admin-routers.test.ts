/** @jest-environment node */
/**
 * cardImages, smallArmsEquipment, formulas and systemValidation routers.
 *
 * Card images: public reads; changing them needs write access to the country (FORBIDDEN, not a
 * server error, for anyone else). Small arms: public, paginated catalog reads. Formulas and
 * system validation: admin only.
 */
import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import { createCallerFactory } from "~/server/api/trpc";
import { cardImagesRouter } from "~/server/api/routers/cardImages";
import { smallArmsEquipmentRouter } from "~/server/api/routers/smallArmsEquipment";
import { formulasRouter } from "~/server/api/routers/formulas";
import { systemValidationRouter } from "~/server/api/routers/system-validation";
import { calculateEffectiveGrowthRate } from "~/lib/config-service";
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

  it("lets the player set their own country's image", async () => {
    await images(ctx(db, "u1")).upsert({ ...image, countryId: "c_mine", presetKey: "harbour" });
    expect(db.cardBackgroundImage.upsert).toHaveBeenCalledWith({
      where: { countryId_cardType: { countryId: "c_mine", cardType: "trade" } },
      update: expect.objectContaining({ imageUrl: image.imageUrl, presetKey: "harbour" }),
      create: expect.objectContaining({ countryId: "c_mine", cardType: "trade" }),
    });
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

  it("returns a country's images keyed by card type", async () => {
    db.cardBackgroundImage.findMany.mockResolvedValue([
      { cardType: "trade", imageUrl: "a" },
      { cardType: "fiscal", imageUrl: "b" },
    ]);
    const map = await images(ctx(db, null)).getAllByCountry({ countryId: "c1" });
    expect(Object.keys(map).sort()).toEqual(["fiscal", "trade"]);
  });
});

describe("smallArmsEquipment", () => {
  const arms = createCallerFactory(smallArmsEquipmentRouter);

  it("filters and pages the catalog publicly", async () => {
    db.smallArmsEquipment.findMany.mockResolvedValue([{ id: "e1" }, { id: "e2" }]);
    db.smallArmsEquipment.count.mockResolvedValue(5);

    const result = await arms(ctx(db, null)).getAllEquipment({
      equipmentType: "rifle",
      isActive: true,
      limit: 2,
      offset: 2,
    });

    expect(db.smallArmsEquipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { equipmentType: "rifle", isActive: true },
        take: 2,
        skip: 2,
      })
    );
    expect(result.pagination).toEqual({ total: 5, limit: 2, offset: 2, hasMore: true });
  });

  it("caps the page size", async () => {
    await expect(arms(ctx(db, null)).getAllEquipment({ limit: 501 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("summarises the catalog", async () => {
    db.smallArmsEquipment.count.mockResolvedValue(3);
    db.smallArmsEquipment.groupBy
      .mockResolvedValueOnce([{ equipmentType: "rifle", _count: 2 }])
      .mockResolvedValueOnce([{ eraKey: "modern", _count: 3 }]);
    db.smallArmsManufacturer.count.mockResolvedValue(1);

    const stats = await arms(ctx(db, null)).getStatistics();

    expect(stats).toMatchObject({
      totalEquipment: 3,
      equipmentByType: [{ type: "rifle", count: 2 }],
      equipmentByEra: [{ era: "modern", count: 3 }],
      totalManufacturers: 1,
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

  it("runs the GDP growth formula and checks the expected output", async () => {
    const expected = calculateEffectiveGrowthRate(0.03, 15000, 1.0321, 1);
    const result = await formulas(ctx(db, "admin", ADMIN)).testFormula({
      formulaId: "gdp-growth",
      testInputs: { baseGrowthRate: 0.03, gdpPerCapita: 15000 },
      expectedOutput: expected,
    });
    expect(result).toMatchObject({ success: true, result: expected, passed: true });
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

  it("passes populated models, warns on empty ones and fails broken ones", async () => {
    db.$queryRaw = jest.fn(async () => [{ "?column?": 1 }]);
    db.country.count.mockResolvedValue(10);
    db.user.count.mockResolvedValue(0);
    db.card.count.mockRejectedValue(new Error("relation missing"));

    const { checks } = await validation(ctx(db, "admin", ADMIN)).checkDatabase();
    const status = (name: string) => checks.find((c) => c.name === name)?.status;

    expect(status("Database Connection")).toBe("pass");
    expect(status("Model: Country")).toBe("pass");
    expect(status("Model: User")).toBe("warn");
    expect(status("Model: Card")).toBe("fail");
  });

  it("flags a stale calculation run and countries with invalid data", async () => {
    db.calculationLog.findFirst.mockResolvedValue({
      timestamp: new Date(Date.now() - 48 * 3600 * 1000),
      countriesUpdated: 5,
      executionTimeMs: 100,
    });
    db.country.count.mockResolvedValue(2);
    db.storytellerEffect.count.mockResolvedValue(0);

    const { checks } = await validation(ctx(db, "admin", ADMIN)).checkEconomicEngine();

    expect(checks.find((c) => c.name === "Last Calculation")?.status).toBe("warn");
    expect(checks.find((c) => c.name === "Country Data Integrity")?.details).toMatch(/2 countries/);
  });
});
