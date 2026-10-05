/** @jest-environment node */
// MC-17: a breached threshold raises one IntelligenceAlert and a notification that links to the
// MyCountry overview's alerts card (not /mycountry/intelligence, which renders Defense).
jest.mock("~/lib/notifications/api", () => ({
  __esModule: true,
  notificationAPI: { create: jest.fn() },
}));

import { describe, it, expect, beforeEach } from "@jest/globals";
import { notificationAPI } from "~/lib/notifications/api";
import {
  evaluateThresholds,
  INTELLIGENCE_ALERTS_HREF,
} from "~/server/shared/intelligence-alert-thresholds";

const create = notificationAPI.create as unknown as jest.Mock;

function makeDb(existingAlert: object | null = null) {
  return {
    intelligenceAlertThreshold: {
      findMany: jest.fn(async () => [
        {
          id: "t1",
          metricName: "publicApproval",
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
          title: "publicApproval breached critical threshold",
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
});
