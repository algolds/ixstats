/** @jest-environment node */
// MC-17: a breached threshold raises one IntelligenceAlert and a notification that links to the
// MyCountry overview's alerts card (not /mycountry/intelligence, which renders Defense).
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn() },
}));
// Realm time D2a: the threat picture reads the defense model's combat power through the defense module.
jest.mock("~/server/modules/defense", () => ({
  threatPictureFor: jest.fn(async () => ({ militaryStrength: 12, activeThreatCount: 3 })),
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { notificationAPI } from "~/lib/notifications/api";
import { threatPictureFor as loadThreatPicture } from "~/server/modules/defense";
import {
  evaluateCountryThresholds,
  evaluateThresholds,
  INTELLIGENCE_ALERTS_HREF,
} from "~/server/shared/intelligence-alert-thresholds";

const create = notificationAPI.create as unknown as jest.Mock;

function makeDb(existingAlert: object | null = null, metricName = "publicApproval") {
  return {
    intelligenceAlertThreshold: {
      findMany: jest.fn(async () => [
        {
          id: "t1",
          metricName,
          alertType: "governance",
          criticalMin: 20,
          criticalMax: null,
          highMin: null,
          highMax: null,
          mediumMin: null,
          mediumMax: null,
          notifyOnCritical: true,
          notifyOnHigh: true,
          notifyOnMedium: false,
        },
      ]),
    },
    country: {
      findUnique: jest.fn(async () => ({
        id: "c1",
        publicApproval: 10,
        economicTier: "Developed",
      })),
    },
    diplomaticRelation: { count: jest.fn(async () => 0) },
    embassy: { count: jest.fn(async () => 0) },
    policy: { findMany: jest.fn(async () => []) },
    intelligenceAlert: {
      findMany: jest.fn(async () => []),
      findFirst: jest.fn(async (_args: object) => existingAlert),
      create: jest.fn(async (_args: object) => ({ id: "alert_1" })),
    },
  };
}

describe("evaluateThresholds", () => {
  beforeEach(() => {
    create.mockClear();
  });

  it("raises an alert without emoji and links the notification to the overview alerts card", async () => {
    const db = makeDb();
    await evaluateThresholds(db, "c1", "u1");

    expect(db.intelligenceAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Public approval breached its critical threshold",
          severity: "CRITICAL",
          category: "GOVERNANCE",
        }),
      })
    );
    expect(INTELLIGENCE_ALERTS_HREF).toBe("/mycountry?focus=alerts");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ href: INTELLIGENCE_ALERTS_HREF, countryId: "c1" })
    );
  });

  it("skips a breach that already has an open alert, including legacy emoji titles", async () => {
    const db = makeDb({ id: "old" });
    await evaluateThresholds(db, "c1", "u1");

    expect(db.intelligenceAlert.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        title: {
          in: [
            "Public approval breached its critical threshold",
            "publicApproval breached critical threshold",
            "\u{1F6A8} publicApproval breached critical threshold",
          ],
        },
        isResolved: false,
      }),
    });
    expect(db.intelligenceAlert.create).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  // P1-21: militaryStrength and threatLevel read the threat picture derived on read (the old
  // assessment table nothing wrote is dropped).
  it("reads militaryStrength from the derived threat picture", async () => {
    const db = makeDb(null, "militaryStrength");
    await evaluateThresholds(db, "c1", "u1");
    expect(loadThreatPicture as jest.Mock).toHaveBeenCalledWith(db, "c1");
    expect(db.intelligenceAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Military strength breached its critical threshold",
          currentValue: 12,
        }),
      })
    );
  });

  it("does not derive the threat picture for other metrics", async () => {
    (loadThreatPicture as jest.Mock).mockClear();
    await evaluateThresholds(makeDb(), "c1", "u1");
    expect(loadThreatPicture).not.toHaveBeenCalled();
  });

  // P1-08: gdpGrowthRate is the realised rate (the projection's effectiveGdpGrowth), not the
  // founding adjustedGdpGrowth input. Here the founding input is 5% but growth now is 1%.
  it("reads gdpGrowthRate from the effective growth the caller projected", async () => {
    const db = makeDb(null, "gdpGrowthRate");
    db.country.findUnique.mockResolvedValue({ id: "c1", adjustedGdpGrowth: 0.05 } as never);
    await evaluateThresholds(db, "c1", "u1", { effectiveGdpGrowth: 0.01 });
    expect(db.intelligenceAlert.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ currentValue: 1 }) })
    );
  });
});

describe("evaluateCountryThresholds", () => {
  it("evaluates each user's thresholds on the country", async () => {
    const db = makeDb();
    const findMany = db.intelligenceAlertThreshold.findMany as jest.Mock;
    findMany.mockImplementationOnce(async () => [{ userId: "u1" }, { userId: "u2" }]);
    await evaluateCountryThresholds(db as never, "c1");
    expect(findMany).toHaveBeenNthCalledWith(1, {
      where: { countryId: "c1", isActive: true },
      select: { userId: true },
      distinct: ["userId"],
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { countryId: "c1", userId: "u2", isActive: true },
    });
  });
});
