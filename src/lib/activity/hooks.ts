import type { Priority } from "@prisma/client";
import { db } from "~/server/db";
import { ActivityGenerator } from "./generator";
import { EconomicTier } from "~/types/ixstats";
import { notificationHooks } from "~/lib/notifications";
import { eventBus } from "~/lib/event-bus";

// Helper to asynchronously queue achievement evaluation from activity hooks
async function triggerAchievementCheck(countryId: string, eventName: string, userId?: string) {
  if (!db || typeof (db as any).user?.findFirst !== "function") {
    return;
  }
  try {
    let activeUserId = userId;
    if (!activeUserId && countryId) {
      const user = await db.user.findFirst({
        where: { ownedCountries: { some: { id: countryId } } },
        select: { clerkUserId: true },
      });
      if (user) activeUserId = user.clerkUserId;
    }
    if (activeUserId && countryId) {
      eventBus.publish(eventName, { userId: activeUserId, countryId });
    }
  } catch (err) {
    console.error(`[Activity Hooks] Failed to trigger achievement check for ${eventName}:`, err);
  }
}

/** Fire-and-forget achievement evaluation for each (country, event) pair; `userId` applies to the first. */
function queueAchievementChecks(eventName: string, countryIds: string[], userId?: string) {
  countryIds.forEach((countryId, i) => {
    triggerAchievementCheck(countryId, eventName, i === 0 ? userId : undefined).catch(
      console.error
    );
  });
}

const findCountries = (...ids: string[]) =>
  Promise.all(ids.map((id) => db.country.findUnique({ where: { id }, select: { name: true } })));

/** Runs an activity hook, logging (never throwing) any failure. */
async function guarded(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    console.error(`Error creating ${label} activity:`, error);
  }
}

interface ActivityRecord {
  type: string;
  category?: string;
  userId?: string | null;
  countryId?: string | null;
  title: string;
  description: string;
  eventType: string;
  /** Extra metadata fields, stored after `eventType`. */
  meta?: Record<string, unknown>;
  priority: Priority;
  visibility?: string;
  /** Countries the entry relates to (stored as JSON); null for none. */
  related: string[] | null;
}

function recordActivity({ meta, eventType, related, userId, ...rest }: ActivityRecord) {
  return db.activityFeed.create({
    data: {
      category: "game",
      visibility: "public",
      ...rest,
      userId: userId || null,
      metadata: JSON.stringify({ eventType, ...meta }),
      relatedCountries: related ? JSON.stringify(related) : null,
    },
  });
}

/**
 * Activity hooks for diplomatic operations
 */
class DiplomaticActivityHooks {
  /** Embassy established between two countries */
  static onEmbassyEstablished(
    country1Id: string,
    country2Id: string,
    embassyTier: string,
    userId?: string
  ): Promise<void> {
    return guarded("embassy established", async () => {
      queueAchievementChecks("diplomacy:updated", [country1Id, country2Id], userId);
      const [country1, country2] = await findCountries(country1Id, country2Id);
      if (!country1 || !country2) return;

      await recordActivity({
        type: "diplomatic",
        userId,
        countryId: country1Id,
        title: `${country1.name} Establishes Embassy in ${country2.name}`,
        description: `${country1.name} has opened a ${embassyTier} embassy in ${country2.name}, strengthening diplomatic ties between the two nations.`,
        eventType: "embassy_established",
        meta: { country1: country1.name, country2: country2.name, embassyTier },
        priority: "medium",
        related: [country1Id, country2Id],
      });

      await notificationHooks
        .onDiplomaticEvent({
          eventType: "agreement",
          title: `Embassy Established with ${country2.name}`,
          countries: [country1Id, country2Id],
          description: `${embassyTier} embassy established`,
        })
        .catch((err) => console.error("[Activity] Failed to send embassy notification:", err));
    });
  }

  /** A country founds a public alliance. */
  static onAllianceFormed(
    countryId: string,
    allianceName: string,
    allianceType: string,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "alliance formed",
      "diplomacy:updated",
      countryId,
      userId,
      (name) => ({
        type: "diplomatic",
        title: `${name} Founds the ${allianceName}`,
        description: `${name} has founded the ${allianceName}, a new ${allianceType} alliance.`,
        eventType: "alliance_formed",
        meta: { allianceName, allianceType, country: name },
        priority: "high",
      })
    );
  }

  /** A country accepts an invitation and joins a public alliance. */
  static onAllianceJoined(countryId: string, allianceName: string, userId?: string): Promise<void> {
    return recordCountryActivity(
      "alliance joined",
      "diplomacy:updated",
      countryId,
      userId,
      (name) => ({
        type: "diplomatic",
        title: `${name} Joins the ${allianceName}`,
        description: `${name} has joined the ${allianceName}, pledging cooperation with its members.`,
        eventType: "alliance_joined",
        meta: { allianceName, country: name },
        priority: "medium",
      })
    );
  }
}

/**
 * One single-country activity: queues the achievement check, looks up the country and records
 * the entry built from its name.
 */
async function recordCountryActivity(
  label: string,
  achievementEvent: string,
  countryId: string,
  userId: string | undefined,
  build: (countryName: string) => Omit<ActivityRecord, "userId" | "countryId" | "related">
) {
  await guarded(label, async () => {
    queueAchievementChecks(achievementEvent, [countryId], userId);
    const [country] = await findCountries(countryId);
    if (!country) return;
    await recordActivity({ userId, countryId, related: [countryId], ...build(country.name) });
  });
}

/**
 * Activity hooks for government operations
 */
class GovernmentActivityHooks {
  /**
   * A bill passes the legislature and becomes law. Bills with an economic effect file under
   * Economic; the rest under Achievements.
   */
  static onLawPassed(
    countryId: string,
    billName: string,
    gdpEffect: number,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity("law passed", "country:updated", countryId, userId, (name) => ({
      type: gdpEffect !== 0 ? "economic" : "achievement",
      title: `${name} Passes ${billName}`,
      description: `The legislature of ${name} has passed "${billName}" into law.`,
      eventType: "law_passed",
      meta: { billName, gdpEffect },
      priority: "medium",
    }));
  }
}

/**
 * Activity hooks for economic operations
 */
class EconomicActivityHooks {
  /**
   * Economic milestone: the nightly stat progression moved a country to a new economic tier
   * (tiers follow GDP per capita, so this fires only when a threshold is crossed).
   */
  static onEconomicTierChange(countryId: string, oldTier: string, newTier: string): Promise<void> {
    const rose = economicTierRank(newTier) > economicTierRank(oldTier);
    return recordCountryActivity(
      "economic tier change",
      "country:updated",
      countryId,
      undefined,
      (name) => ({
        type: "economic",
        title: `${name} ${rose ? "Rises" : "Falls"} to ${newTier} Status`,
        description: rose
          ? `${name} has grown into a ${newTier} economy, up from ${oldTier}.`
          : `${name} has slipped to a ${newTier} economy, down from ${oldTier}.`,
        eventType: "economic_tier_change",
        meta: { oldTier, newTier, rose },
        priority: rose ? "high" : "medium",
      })
    );
  }
}

/** Rank of an economic tier, lowest first (`EconomicTier` declaration order); unknown names rank -1. */
export function economicTierRank(tier: string): number {
  return (Object.values(EconomicTier) as string[]).indexOf(tier);
}

/**
 * Activity hooks for user operations
 */
class UserActivityHooks {
  /** User links to country */
  static async onCountryLink(
    userId: string,
    countryId: string,
    isNewCountry: boolean
  ): Promise<void> {
    triggerAchievementCheck(countryId, "country:updated", userId).catch(console.error);
    await ActivityGenerator.createCountryLinkActivity(userId, countryId, isNewCountry);
  }

  /** User achievement unlocked */
  static async onAchievementUnlocked(
    userId: string,
    countryId: string,
    achievementName: string,
    achievementDescription: string
  ): Promise<void> {
    await guarded("achievement unlocked", async () => {
      const [country] = await findCountries(countryId);
      if (!country) return;

      await recordActivity({
        type: "achievement",
        userId,
        countryId,
        title: `${country.name} Unlocks Achievement: ${achievementName}`,
        description: achievementDescription,
        eventType: "achievement_unlocked",
        meta: { achievementName },
        priority: "medium",
        related: [countryId],
      });
    });
  }
}

/**
 * Comprehensive activity hooks export
 */
export const ActivityHooks = {
  Diplomatic: DiplomaticActivityHooks,
  Government: GovernmentActivityHooks,
  Economic: EconomicActivityHooks,
  User: UserActivityHooks,
};
