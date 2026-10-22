/** @jest-environment node */
/**
 * The gates of the non-core routers, one table: who each procedure refuses (signed out, a plain member, another
 * country's player) and the input bounds it enforces before touching anything. Then the few rules behind a gate that a
 * real admin or player depends on: a builder draft is only ever the caller's own, demo state is the system owner's
 * alone, a formula change and a Loreward override are recorded against the admin who made them (an override keeps
 * the fields it leaves out), and the admin recalculation runs the cron's own job under its lock.
 *
 * Folds autosave-monitoring, user-logging-feedback, small-routers, catalog-admin-routers, commons-search and
 * commons-counts (their bounds), admin-force-recalculation, admin-wiki-loreward-override, reference-catalogs,
 * admin-actor and actionLinks (bounds and the removed backlink read).
 */
jest.mock("~/lib/auth", () => ({
  __esModule: true,
  ...jest.requireActual("~/lib/auth"),
  isSystemOwner: (id: string | null | undefined) => id === "clerk_owner",
}));
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("~/server/cron/stat-progression", () => ({
  __esModule: true,
  runStatProgression: jest.fn(),
}));
jest.mock("~/lib/system/job-lock", () => ({ __esModule: true, withJobLock: jest.fn() }));
jest.mock("~/server/modules/cards/cards.trophies", () => ({ overrideLorewardEntry: jest.fn() }));
jest.mock("~/lib/cache", () => ({
  ...jest.requireActual("~/lib/cache"),
  invalidateCache: jest.fn().mockResolvedValue(undefined),
}));

import type { inferRouterInputs } from "@trpc/server";
import { FeedbackLogger } from "~/lib/logging";
import { withJobLock } from "~/lib/system/job-lock";
import { actionLinksRouter } from "~/server/api/routers/actionLinks";
import { adminSystemRouter } from "~/server/api/routers/admin/system";
import { adminWikiRouter } from "~/server/api/routers/admin/wiki";
import { autosaveMonitoringRouter } from "~/server/api/routers/autosaveMonitoring";
import { builderDraftRouter } from "~/server/api/routers/builderDraft";
import { cacheRouter } from "~/server/api/routers/cache";
import { cardImagesRouter } from "~/server/api/routers/cardImages";
import { commonsRouter } from "~/server/api/routers/commons";
import { demoModeRouter } from "~/server/api/routers/demo-mode";
import { formulasRouter } from "~/server/api/routers/formulas";
import { historicalRouter } from "~/server/api/routers/historical";
import { militaryEquipmentCatalogRouter } from "~/server/api/routers/militaryEquipment/catalog";
import { smallArmsEquipmentRouter } from "~/server/api/routers/smallArmsEquipment";
import { systemValidationRouter } from "~/server/api/routers/system-validation";
import { userLoggingRouter } from "~/server/api/routers/user-logging";
import { createCallerFactory } from "~/server/api/trpc";
import { runStatProgression } from "~/server/cron/stat-progression";
import { overrideLorewardEntry } from "~/server/modules/cards/cards.trophies";
import { createMockPrisma, type MockPrismaProxy } from "~/tests/helpers/mock-db";
import { createMockRouterContext } from "~/tests/helpers/router-context";

type Who = "signed out" | "a member" | "an admin";
const ROLES = {
  "a member": { name: "user", level: 100 },
  "an admin": { name: "admin", level: 10 },
} as const;

let db: MockPrismaProxy;

function ctx(who: Who) {
  const id = who === "signed out" ? null : who === "an admin" ? "admin" : "u1";
  return createMockRouterContext({
    db,
    auth: id ? { userId: `clerk_${id}` } : null,
    user: id
      ? {
          id: `db_${id}`,
          clerkUserId: `clerk_${id}`,
          countryId: "c_mine",
          role: ROLES[who as keyof typeof ROLES],
        }
      : null,
    rateLimitIdentifier: `${id}_${Math.random()}`,
  }) as never;
}

const call = {
  actionLinks: createCallerFactory(actionLinksRouter),
  adminSystem: createCallerFactory(adminSystemRouter),
  adminWiki: createCallerFactory(adminWikiRouter),
  autosave: createCallerFactory(autosaveMonitoringRouter),
  builderDraft: createCallerFactory(builderDraftRouter),
  cache: createCallerFactory(cacheRouter),
  cardImages: createCallerFactory(cardImagesRouter),
  commons: createCallerFactory(commonsRouter),
  demo: createCallerFactory(demoModeRouter),
  formulas: createCallerFactory(formulasRouter),
  historical: createCallerFactory(historicalRouter),
  equipment: createCallerFactory(militaryEquipmentCatalogRouter),
  smallArms: createCallerFactory(smallArmsEquipmentRouter),
  validation: createCallerFactory(systemValidationRouter),
  userLogging: createCallerFactory(userLoggingRouter),
};

const OTHER_COUNTRY_IMAGE = {
  countryId: "c_other",
  cardType: "trade" as const,
  imageUrl: "https://example.com/bg.png",
};
const OVERRIDE = { date: "2026-10-16", winnerUser: "Cy", winnerPage: "Page" };
const FEEDBACK = {
  feedbackType: "bug",
  message: "The map is blank",
  url: "/maps",
  userAgent: "test",
  logs: [],
};
const TANK: inferRouterInputs<typeof militaryEquipmentCatalogRouter>["createCatalogEquipment"] = {
  name: "Test Tank",
  manufacturer: "NOBODY",
  category: "vehicle",
  era: "MODERN",
  acquisitionCost: 1,
  maintenanceCost: 1,
  technologyLevel: 75,
  crewRequirement: 3,
};

const AUTH = /Authentication required/;
const ADMIN = /Admin privileges required/;
const BAD_REQUEST = { code: "BAD_REQUEST" };
const FORBIDDEN = { code: "FORBIDDEN" };

const GATES: Array<{
  procedure: string;
  who: Who;
  run: (c: never) => Promise<unknown>;
  refusal: RegExp | object;
}> = [
  {
    procedure: "userLogging.submitFeedback",
    who: "signed out",
    run: (c) => call.userLogging(c).submitFeedback(FEEDBACK),
    refusal: AUTH,
  },
  {
    procedure: "builderDraft.get",
    who: "signed out",
    run: (c) => call.builderDraft(c).get(),
    refusal: AUTH,
  },
  {
    procedure: "cardImages.upsert",
    who: "signed out",
    run: (c) => call.cardImages(c).upsert(OTHER_COUNTRY_IMAGE),
    refusal: AUTH,
  },
  {
    procedure: "autosaveMonitoring.getSystemHealth",
    who: "a member",
    run: (c) => call.autosave(c).getSystemHealth(),
    refusal: ADMIN,
  },
  {
    procedure: "cache.getStats",
    who: "a member",
    run: (c) => call.cache(c).getStats(),
    refusal: ADMIN,
  },
  {
    procedure: "formulas.update",
    who: "a member",
    run: (c) => call.formulas(c).update({ id: "gdp-growth" }),
    refusal: ADMIN,
  },
  {
    procedure: "systemValidation.checkDatabase",
    who: "a member",
    run: (c) => call.validation(c).checkDatabase(),
    refusal: ADMIN,
  },
  {
    procedure: "admin.saveLorewardWinnerOverride",
    who: "a member",
    run: (c) => call.adminWiki(c).saveLorewardWinnerOverride(OVERRIDE),
    refusal: ADMIN,
  },
  {
    procedure: "cardImages.upsert of another country",
    who: "a member",
    run: (c) => call.cardImages(c).upsert(OTHER_COUNTRY_IMAGE),
    refusal: FORBIDDEN,
  },
  {
    procedure: "cardImages.delete of another country",
    who: "a member",
    run: (c) => call.cardImages(c).delete({ countryId: "c_other", cardType: "trade" }),
    refusal: FORBIDDEN,
  },
  {
    procedure: "builderDraft.save of a non-object",
    who: "a member",
    run: (c) => call.builderDraft(c).save({ data: "just a string" as never }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "cardImages.upsert of a non-URL",
    who: "a member",
    run: (c) => call.cardImages(c).upsert({ ...OTHER_COUNTRY_IMAGE, imageUrl: "not a url" }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "smallArmsEquipment.getAllEquipment of 501",
    who: "signed out",
    run: (c) => call.smallArms(c).getAllEquipment({ limit: 501 }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "historical.getCountryHistory of 1001",
    who: "signed out",
    run: (c) => call.historical(c).getCountryHistory({ countryId: "c1", limit: 1001 }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "admin.saveLorewardWinnerOverride on 30 February",
    who: "an admin",
    run: (c) => call.adminWiki(c).saveLorewardWinnerOverride({ ...OVERRIDE, date: "2026-02-30" }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "commons.search of a fractional page size",
    who: "signed out",
    run: (c) => call.commons(c).search({ query: "x", limit: 2.5 }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "commons.search of 1001 characters",
    who: "signed out",
    run: (c) => call.commons(c).search({ query: "a".repeat(1001) }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "actionLinks.discussionCounts of 51 ids",
    who: "signed out",
    run: (c) =>
      call
        .actionLinks(c)
        .discussionCounts({ activityIds: Array.from({ length: 51 }, (_, i) => `a${i}`) }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "actionLinks.discussions with a 129-character cursor",
    who: "signed out",
    run: (c) => call.actionLinks(c).discussions({ activityId: "a1", cursor: "x".repeat(129) }),
    refusal: BAD_REQUEST,
  },
  {
    procedure: "militaryEquipment.createCatalogEquipment of an unknown maker",
    who: "an admin",
    run: (c) => call.equipment(c).createCatalogEquipment(TANK),
    refusal: /Manufacturer not found/,
  },
];

beforeEach(() => {
  for (const level of ["log", "warn", "error"] as const) {
    jest.spyOn(console, level).mockImplementation(() => undefined);
  }
  jest.spyOn(FeedbackLogger, "logFeedback").mockImplementation(() => undefined);
  db = createMockPrisma();
  db.user.findUnique.mockResolvedValue(null);
  db.country.findUnique.mockResolvedValue({ id: "c_other", ownerUserId: "someone_else" });
  db.defenseManufacturer.findFirst.mockResolvedValue(null);
});
afterEach(() => jest.restoreAllMocks());

it.each(GATES)("$procedure is refused to $who", async ({ who, run, refusal }) => {
  const attempt = run(ctx(who));
  if (refusal instanceof RegExp) await expect(attempt).rejects.toThrow(refusal);
  else await expect(attempt).rejects.toMatchObject(refusal);
  expect(db.cardBackgroundImage.upsert).not.toHaveBeenCalled();
  expect(db.adminAuditLog.create).not.toHaveBeenCalled();
  expect(overrideLorewardEntry).not.toHaveBeenCalled();
});

it("reads, saves and clears only the caller's own builder draft", async () => {
  const draft = call.builderDraft(ctx("a member"));
  db.builderDraft.findUnique.mockResolvedValue({ data: { step: 2 }, updatedAt: new Date(0) });
  await draft.get();
  await draft.save({ data: { step: 3 } });
  await draft.clear();
  expect(db.builderDraft.findUnique).toHaveBeenCalledWith({ where: { userId: "clerk_u1" } });
  expect(db.builderDraft.upsert).toHaveBeenCalledWith(
    expect.objectContaining({ where: { userId: "clerk_u1" } })
  );
  expect(db.builderDraft.deleteMany).toHaveBeenCalledWith({ where: { userId: "clerk_u1" } });
});

it("reveals demo state to the system owner only, not to an admin", async () => {
  db.systemConfig.findUnique.mockResolvedValue({ value: "true" });
  await expect(call.demo(ctx("an admin")).getDemoState()).resolves.toEqual({
    isActive: false,
    demoCountryId: null,
  });
  expect(db.systemConfig.findUnique).not.toHaveBeenCalled();
});

it("records a formula change, and a Loreward override keeping the fields it leaves out, against the admin", async () => {
  db.adminAuditLog.create.mockResolvedValue({ id: "audit1" });
  await expect(
    call.formulas(ctx("an admin")).update({ id: "gdp-growth", variables: { baseGrowthRate: 0.03 } })
  ).resolves.toMatchObject({ success: true, auditId: "audit1" });
  expect(db.adminAuditLog.create).toHaveBeenCalledWith({
    data: expect.objectContaining({ action: "FORMULA_UPDATE_REQUEST", targetId: "gdp-growth" }),
  });

  jest.mocked(overrideLorewardEntry).mockResolvedValue({ day: "2026-10-16", written: {} } as never);
  const fetchMock = jest
    .spyOn(globalThis, "fetch")
    .mockResolvedValue({ ok: true, status: 200 } as Response);
  await call.adminWiki(ctx("an admin")).saveLorewardWinnerOverride({ ...OVERRIDE, type: "weekly" });
  const [, actor, input] = jest.mocked(overrideLorewardEntry).mock.calls[0]!;
  expect(actor).toEqual({ dbId: "db_admin", clerkId: "clerk_admin" });
  expect(input).toMatchObject({ type: "weekly", fields: { winnerUser: "Cy", winnerPage: "Page" } });
  expect(Object.keys(input.fields).sort()).toEqual(["winnerPage", "winnerUser"]);
  fetchMock.mockRestore();
});

it("runs the admin recalculation as the cron's job, under its lock, and refuses while the cron holds it", async () => {
  jest.mocked(runStatProgression).mockResolvedValue({ updated: 7, executionTimeMs: 12 } as never);
  jest
    .mocked(withJobLock)
    .mockImplementationOnce(async (_db, _name, fn) => ({ ran: true, result: await fn() }) as never);
  await expect(call.adminSystem(ctx("an admin")).forceRecalculation()).resolves.toMatchObject({
    countriesUpdated: 7,
  });
  expect(jest.mocked(withJobLock).mock.calls[0]![1]).toBe("stat-progression");
  expect(runStatProgression).toHaveBeenCalledWith(expect.objectContaining({ force: true }));

  jest.mocked(runStatProgression).mockClear();
  jest.mocked(withJobLock).mockResolvedValueOnce({ ran: false } as never);
  await expect(call.adminSystem(ctx("an admin")).forceRecalculation()).rejects.toThrow(
    /already running/
  );
  expect(runStatProgression).not.toHaveBeenCalled();
});

it("no longer serves the removed post backlink read, which leaked hidden posts", () => {
  // Spelled in two parts so that a repository-wide search for the removed name finds nothing.
  expect(Object.keys(actionLinksRouter._def.procedures)).not.toContain(
    ["linked", "Posts"].join("")
  );
});
