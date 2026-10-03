import type { Priority } from "@prisma/client";
import { db } from "~/server/db";
import { ActivityGenerator } from "./generator";
import { formatCurrency, formatPopulation } from "~/lib/utils";
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

  /** Diplomatic mission completed */
  static onMissionCompleted(
    countryId: string,
    targetCountryId: string,
    missionType: string,
    success: boolean,
    userId?: string
  ): Promise<void> {
    return guarded("mission completed", async () => {
      queueAchievementChecks("diplomacy:updated", [countryId], userId);
      const [country, targetCountry] = await findCountries(countryId, targetCountryId);
      if (!country || !targetCountry) return;

      await recordActivity({
        type: "diplomatic",
        userId,
        countryId,
        title: `${country.name} ${success ? "Completes" : "Fails"} ${missionType} Mission`,
        description: `${country.name} has ${success ? "successfully completed" : "failed to complete"} a ${missionType} mission with ${targetCountry.name}.`,
        eventType: "mission_completed",
        meta: {
          missionType,
          success,
          country: country.name,
          targetCountry: targetCountry.name,
        },
        priority: success ? "medium" : "low",
        related: [countryId, targetCountryId],
      });
    });
  }

  /** Alliance formed between countries */
  static onAllianceFormed(
    country1Id: string,
    country2Id: string,
    allianceName: string,
    userId?: string
  ): Promise<void> {
    return guarded("alliance formed", async () => {
      queueAchievementChecks("diplomacy:updated", [country1Id, country2Id], userId);
      const [country1, country2] = await findCountries(country1Id, country2Id);
      if (!country1 || !country2) return;

      await recordActivity({
        type: "diplomatic",
        userId,
        title: `${country1.name} and ${country2.name} Form Alliance`,
        description: `${country1.name} and ${country2.name} have formed the ${allianceName || "bilateral alliance"}, pledging mutual cooperation and support.`,
        eventType: "alliance_formed",
        meta: { countries: [country1.name, country2.name], allianceName },
        priority: "high",
        related: [country1Id, country2Id],
      });
    });
  }

  /** Trade agreement signed */
  static onTradeAgreement(
    country1Id: string,
    country2Id: string,
    tradeValue?: number,
    userId?: string
  ): Promise<void> {
    return guarded("trade agreement", async () => {
      queueAchievementChecks("diplomacy:updated", [country1Id, country2Id], userId);
      const [country1, country2] = await findCountries(country1Id, country2Id);
      if (!country1 || !country2) return;

      await recordActivity({
        type: "diplomatic",
        userId,
        title: `${country1.name} and ${country2.name} Sign Trade Agreement`,
        description: `${country1.name} and ${country2.name} have signed a comprehensive trade agreement${tradeValue ? ` valued at ${formatCurrency(tradeValue)}` : ""}.`,
        eventType: "trade_agreement",
        meta: { countries: [country1.name, country2.name], tradeValue },
        priority: tradeValue && tradeValue > 50000000000 ? "high" : "medium",
        related: [country1Id, country2Id],
      });
    });
  }
}

/**
 * One single-country "achievement/economic/meta" activity: queues the achievement check, looks up
 * the country and records the entry built from its name.
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
  /** Government component added to country */
  static onComponentAdded(
    countryId: string,
    componentName: string,
    componentType: string,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "component added",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "achievement",
        title: `${name} Implements ${componentName}`,
        description: `${name} has implemented ${componentName}, a ${componentType} component in their governmental system.`,
        eventType: "component_added",
        meta: { componentName, componentType, country: name },
        priority: "medium",
      })
    );
  }

  /** Government effectiveness change (only significant swings are recorded) */
  static onEffectivenessChange(
    countryId: string,
    oldEffectiveness: number,
    newEffectiveness: number,
    userId?: string
  ): Promise<void> {
    const change = Math.abs(newEffectiveness - oldEffectiveness);
    if (change < 10) return Promise.resolve();

    const isImprovement = newEffectiveness > oldEffectiveness;
    return recordCountryActivity(
      "effectiveness change",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "achievement",
        title: `${name} Government Effectiveness ${isImprovement ? "Increases" : "Decreases"}`,
        description: `${name}'s governmental effectiveness has ${isImprovement ? "improved" : "declined"} to ${newEffectiveness.toFixed(1)}%, ${isImprovement ? "strengthening" : "weakening"} administrative capacity.`,
        eventType: "effectiveness_change",
        meta: { oldEffectiveness, newEffectiveness, isImprovement },
        priority: change > 20 ? "high" : "medium",
      })
    );
  }

  /** Constitutional reform enacted */
  static onConstitutionalReform(
    countryId: string,
    reformType: string,
    reformDescription: string,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "constitutional reform",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "achievement",
        title: `${name} Enacts Constitutional Reform`,
        description: `${name} has enacted major ${reformType} reforms: ${reformDescription}`,
        eventType: "constitutional_reform",
        meta: { reformType, reformDescription },
        priority: "high",
      })
    );
  }
}

/**
 * Activity hooks for economic operations
 */
class EconomicActivityHooks {
  /** Budget approved/changed */
  static onBudgetApproved(
    countryId: string,
    totalBudget: number,
    majorChanges: string[],
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "budget approved",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "economic",
        title: `${name} Approves ${formatCurrency(totalBudget)} Budget`,
        description: `${name} has approved a ${formatCurrency(totalBudget)} national budget${majorChanges.length ? ` with major changes in ${majorChanges.join(", ")}` : ""}.`,
        eventType: "budget_approved",
        meta: { totalBudget, majorChanges },
        priority: totalBudget > 1000000000000 ? "high" : "medium",
      })
    );
  }

  /** Tax policy change */
  static onTaxPolicyChange(
    countryId: string,
    policyType: string,
    policyDescription: string,
    impactedPopulation: number,
    userId?: string
  ): Promise<void> {
    if (!db || typeof (db as any).country?.findUnique !== "function") {
      return Promise.resolve();
    }
    return recordCountryActivity(
      "tax policy change",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "economic",
        title: `${name} Reforms Tax Policy`,
        description: `${name} has implemented ${policyType} tax reforms affecting ${formatPopulation(impactedPopulation)} citizens: ${policyDescription}`,
        eventType: "tax_policy_change",
        meta: { policyType, policyDescription, impactedPopulation },
        priority: "medium",
      })
    );
  }

  /** Major infrastructure project announced */
  static onInfrastructureProject(
    countryId: string,
    projectName: string,
    projectValue: number,
    projectType: string,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "infrastructure project",
      "country:updated",
      countryId,
      userId,
      (name) => ({
        type: "economic",
        title: `${name} Announces Major Infrastructure Project`,
        description: `${name} has announced the ${projectName}, a ${formatCurrency(projectValue)} ${projectType} infrastructure initiative.`,
        eventType: "infrastructure_project",
        meta: { projectName, projectValue, projectType },
        priority: projectValue > 10000000000 ? "high" : "medium",
      })
    );
  }
}

/**
 * Activity hooks for defense/security operations
 */
class SecurityActivityHooks {
  /** Military branch created/upgraded */
  static onMilitaryBranchChange(
    countryId: string,
    branchName: string,
    action: "created" | "upgraded",
    newLevel?: string,
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "military branch change",
      "military:updated",
      countryId,
      userId,
      (name) => ({
        type: "achievement",
        title: `${name} ${action === "created" ? "Establishes" : "Upgrades"} ${branchName}`,
        description: `${name} has ${action} the ${branchName}${newLevel ? ` to ${newLevel} level` : ""}, enhancing national defense capabilities.`,
        eventType: "military_branch_change",
        meta: { branchName, action, newLevel },
        priority: "medium",
      })
    );
  }

  /** Security threat detected/resolved */
  static onSecurityThreat(
    countryId: string,
    threatType: string,
    severity: string,
    status: "detected" | "resolved",
    userId?: string
  ): Promise<void> {
    return recordCountryActivity(
      "security threat",
      "military:updated",
      countryId,
      userId,
      (name) => ({
        type: "meta",
        title: `${name} ${status === "detected" ? "Faces" : "Resolves"} Security Threat`,
        description: `${name} has ${status} a ${severity} severity ${threatType} threat to national security.`,
        eventType: "security_threat",
        meta: { threatType, severity, status },
        priority: severity === "critical" ? "critical" : severity === "high" ? "high" : "medium",
      })
    );
  }
}

/**
 * Activity hooks for social/ThinkPages operations
 */
class SocialActivityHooks {
  /** ThinkPage post created */
  static async onThinkPagePost(
    userId: string,
    countryId: string,
    postTitle: string,
    postType: string,
    visibility: "public" | "followers" | "friends"
  ): Promise<void> {
    await guarded("ThinkPage post", async () => {
      queueAchievementChecks("thinkpages:updated", [countryId], userId);
      const [country] = await findCountries(countryId);
      if (!country) return;

      await recordActivity({
        type: "social",
        category: "social",
        userId,
        countryId,
        title: `New ${postType} from ${country.name}`,
        description: postTitle,
        eventType: "thinkpage_post",
        meta: { postType },
        priority: "low",
        visibility,
        related: [countryId],
      });
    });
  }

  /** User follows country */
  static async onFollowCountry(
    userId: string,
    countryId: string,
    userCountryId?: string
  ): Promise<void> {
    await guarded("follow country", async () => {
      triggerAchievementCheck(userCountryId || countryId, "thinkpages:updated", userId).catch(
        console.error
      );
      triggerAchievementCheck(countryId, "thinkpages:updated").catch(console.error);

      const [country, userCountry] = await Promise.all([
        findCountries(countryId).then(([c]) => c),
        userCountryId ? findCountries(userCountryId).then(([c]) => c) : null,
      ]);
      if (!country) return;

      await recordActivity({
        type: "social",
        category: "social",
        userId,
        countryId: userCountryId || null,
        title: `${userCountry?.name || "User"} Follows ${country.name}`,
        description: `${userCountry?.name || "A user"} is now following ${country.name} for updates and activities.`,
        eventType: "follow_country",
        meta: { followedCountry: country.name },
        priority: "low",
        visibility: "friends",
        related: [countryId, ...(userCountryId ? [userCountryId] : [])],
      });
    });
  }

  /** User joins platform */
  static async onUserJoined(userId: string, countryId?: string): Promise<void> {
    await guarded("user joined", async () => {
      if (countryId) queueAchievementChecks("user:signup", [countryId], userId);
      const country = countryId ? (await findCountries(countryId))[0] : null;

      await recordActivity({
        type: "social",
        category: "platform",
        userId,
        countryId: countryId || null,
        title: `New Leader Joins IxStats`,
        description: `A new leader has joined IxStats${country ? ` representing ${country.name}` : ""}!`,
        eventType: "user_joined",
        meta: { countryName: country?.name },
        priority: "low",
        related: countryId ? [countryId] : null,
      });
    });
  }
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
  Security: SecurityActivityHooks,
  Social: SocialActivityHooks,
  User: UserActivityHooks,
};
