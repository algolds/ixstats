// src/lib/activity-hooks.ts
// Comprehensive activity generation hooks for all user/country interactions

import { db } from "~/server/db";
import { ActivityGenerator } from "./activity-generator";
import { formatCurrency, formatPopulation } from "./chart-utils";
import { notificationHooks } from "./notification-hooks";

/**
 * Activity hooks for diplomatic operations
 */
export class DiplomaticActivityHooks {
  /**
   * Embassy established between two countries
   */
  static async onEmbassyEstablished(
    country1Id: string,
    country2Id: string,
    embassyTier: string,
    userId?: string
  ): Promise<void> {
    try {
      const [country1, country2] = await Promise.all([
        db.country.findUnique({ where: { id: country1Id }, select: { name: true } }),
        db.country.findUnique({ where: { id: country2Id }, select: { name: true } }),
      ]);

      if (!country1 || !country2) return;

      await db.activityFeed.create({
        data: {
          type: "diplomatic",
          category: "game",
          userId: userId || null,
          countryId: country1Id,
          title: `${country1.name} Establishes Embassy in ${country2.name}`,
          description: `${country1.name} has opened a ${embassyTier} embassy in ${country2.name}, strengthening diplomatic ties between the two nations.`,
          metadata: JSON.stringify({
            eventType: "embassy_established",
            country1: country1.name,
            country2: country2.name,
            embassyTier,
          }),
          priority: "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([country1Id, country2Id]),
        },
      });

      // 🔔 Notify diplomatic event
      await notificationHooks
        .onDiplomaticEvent({
          eventType: "agreement",
          title: `Embassy Established with ${country2.name}`,
          countries: [country1Id, country2Id],
          description: `${embassyTier} embassy established`,
        })
        .catch((err) => console.error("[Activity] Failed to send embassy notification:", err));
    } catch (error) {
      console.error("Error creating embassy established activity:", error);
    }
  }

  /**
   * Diplomatic mission completed
   */
  static async onMissionCompleted(
    countryId: string,
    targetCountryId: string,
    missionType: string,
    success: boolean,
    userId?: string
  ): Promise<void> {
    try {
      const [country, targetCountry] = await Promise.all([
        db.country.findUnique({ where: { id: countryId }, select: { name: true } }),
        db.country.findUnique({ where: { id: targetCountryId }, select: { name: true } }),
      ]);

      if (!country || !targetCountry) return;

      await db.activityFeed.create({
        data: {
          type: "diplomatic",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} ${success ? "Completes" : "Fails"} ${missionType} Mission`,
          description: `${country.name} has ${success ? "successfully completed" : "failed to complete"} a ${missionType} mission with ${targetCountry.name}.`,
          metadata: JSON.stringify({
            eventType: "mission_completed",
            missionType,
            success,
            country: country.name,
            targetCountry: targetCountry.name,
          }),
          priority: success ? "medium" : "low",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId, targetCountryId]),
        },
      });
    } catch (error) {
      console.error("Error creating mission completed activity:", error);
    }
  }

  /**
   * Alliance formed between countries
   */
  static async onAllianceFormed(
    country1Id: string,
    country2Id: string,
    allianceName: string,
    userId?: string
  ): Promise<void> {
    try {
      const [country1, country2] = await Promise.all([
        db.country.findUnique({ where: { id: country1Id }, select: { name: true } }),
        db.country.findUnique({ where: { id: country2Id }, select: { name: true } }),
      ]);

      if (!country1 || !country2) return;

      await db.activityFeed.create({
        data: {
          type: "diplomatic",
          category: "game",
          userId: userId || null,
          title: `${country1.name} and ${country2.name} Form Alliance`,
          description: `${country1.name} and ${country2.name} have formed the ${allianceName || "bilateral alliance"}, pledging mutual cooperation and support.`,
          metadata: JSON.stringify({
            eventType: "alliance_formed",
            countries: [country1.name, country2.name],
            allianceName,
          }),
          priority: "high",
          visibility: "public",
          relatedCountries: JSON.stringify([country1Id, country2Id]),
        },
      });
    } catch (error) {
      console.error("Error creating alliance formed activity:", error);
    }
  }

  /**
   * Trade agreement signed
   */
  static async onTradeAgreement(
    country1Id: string,
    country2Id: string,
    tradeValue?: number,
    userId?: string
  ): Promise<void> {
    try {
      const [country1, country2] = await Promise.all([
        db.country.findUnique({ where: { id: country1Id }, select: { name: true } }),
        db.country.findUnique({ where: { id: country2Id }, select: { name: true } }),
      ]);

      if (!country1 || !country2) return;

      const priority = tradeValue && tradeValue > 50000000000 ? "high" : "medium";

      await db.activityFeed.create({
        data: {
          type: "diplomatic",
          category: "game",
          userId: userId || null,
          title: `${country1.name} and ${country2.name} Sign Trade Agreement`,
          description: `${country1.name} and ${country2.name} have signed a comprehensive trade agreement${tradeValue ? ` valued at ${formatCurrency(tradeValue)}` : ""}.`,
          metadata: JSON.stringify({
            eventType: "trade_agreement",
            countries: [country1.name, country2.name],
            tradeValue,
          }),
          priority,
          visibility: "public",
          relatedCountries: JSON.stringify([country1Id, country2Id]),
        },
      });
    } catch (error) {
      console.error("Error creating trade agreement activity:", error);
    }
  }
}

/**
 * Activity hooks for government operations
 */
export class GovernmentActivityHooks {
  /**
   * Government component added to country
   */
  static async onComponentAdded(
    countryId: string,
    componentName: string,
    componentType: string,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "achievement",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Implements ${componentName}`,
          description: `${country.name} has implemented ${componentName}, a ${componentType} component in their governmental system.`,
          metadata: JSON.stringify({
            eventType: "component_added",
            componentName,
            componentType,
            country: country.name,
          }),
          priority: "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating component added activity:", error);
    }
  }

  /**
   * Government effectiveness change
   */
  static async onEffectivenessChange(
    countryId: string,
    oldEffectiveness: number,
    newEffectiveness: number,
    userId?: string
  ): Promise<void> {
    try {
      if (Math.abs(newEffectiveness - oldEffectiveness) < 10) return; // Only significant changes

      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      const isImprovement = newEffectiveness > oldEffectiveness;
      const priority = Math.abs(newEffectiveness - oldEffectiveness) > 20 ? "high" : "medium";

      await db.activityFeed.create({
        data: {
          type: "achievement",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Government Effectiveness ${isImprovement ? "Increases" : "Decreases"}`,
          description: `${country.name}'s governmental effectiveness has ${isImprovement ? "improved" : "declined"} to ${newEffectiveness.toFixed(1)}%, ${isImprovement ? "strengthening" : "weakening"} administrative capacity.`,
          metadata: JSON.stringify({
            eventType: "effectiveness_change",
            oldEffectiveness,
            newEffectiveness,
            isImprovement,
          }),
          priority,
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating effectiveness change activity:", error);
    }
  }

  /**
   * Constitutional reform enacted
   */
  static async onConstitutionalReform(
    countryId: string,
    reformType: string,
    reformDescription: string,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "achievement",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Enacts Constitutional Reform`,
          description: `${country.name} has enacted major ${reformType} reforms: ${reformDescription}`,
          metadata: JSON.stringify({
            eventType: "constitutional_reform",
            reformType,
            reformDescription,
          }),
          priority: "high",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating constitutional reform activity:", error);
    }
  }
}

/**
 * Activity hooks for economic operations
 */
export class EconomicActivityHooks {
  /**
   * Budget approved/changed
   */
  static async onBudgetApproved(
    countryId: string,
    totalBudget: number,
    majorChanges: string[],
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "economic",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Approves ${formatCurrency(totalBudget)} Budget`,
          description: `${country.name} has approved a ${formatCurrency(totalBudget)} national budget${majorChanges.length ? ` with major changes in ${majorChanges.join(", ")}` : ""}.`,
          metadata: JSON.stringify({
            eventType: "budget_approved",
            totalBudget,
            majorChanges,
          }),
          priority: totalBudget > 1000000000000 ? "high" : "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating budget approved activity:", error);
    }
  }

  /**
   * Tax policy change
   */
  static async onTaxPolicyChange(
    countryId: string,
    policyType: string,
    policyDescription: string,
    impactedPopulation: number,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "economic",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Reforms Tax Policy`,
          description: `${country.name} has implemented ${policyType} tax reforms affecting ${formatPopulation(impactedPopulation)} citizens: ${policyDescription}`,
          metadata: JSON.stringify({
            eventType: "tax_policy_change",
            policyType,
            policyDescription,
            impactedPopulation,
          }),
          priority: "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating tax policy change activity:", error);
    }
  }

  /**
   * Major infrastructure project announced
   */
  static async onInfrastructureProject(
    countryId: string,
    projectName: string,
    projectValue: number,
    projectType: string,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      const priority = projectValue > 10000000000 ? "high" : "medium";

      await db.activityFeed.create({
        data: {
          type: "economic",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} Announces Major Infrastructure Project`,
          description: `${country.name} has announced the ${projectName}, a ${formatCurrency(projectValue)} ${projectType} infrastructure initiative.`,
          metadata: JSON.stringify({
            eventType: "infrastructure_project",
            projectName,
            projectValue,
            projectType,
          }),
          priority,
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating infrastructure project activity:", error);
    }
  }
}

/**
 * Activity hooks for defense/security operations
 */
export class SecurityActivityHooks {
  /**
   * Military branch created/upgraded
   */
  static async onMilitaryBranchChange(
    countryId: string,
    branchName: string,
    action: "created" | "upgraded",
    newLevel?: string,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "achievement",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} ${action === "created" ? "Establishes" : "Upgrades"} ${branchName}`,
          description: `${country.name} has ${action} the ${branchName}${newLevel ? ` to ${newLevel} level` : ""}, enhancing national defense capabilities.`,
          metadata: JSON.stringify({
            eventType: "military_branch_change",
            branchName,
            action,
            newLevel,
          }),
          priority: "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating military branch change activity:", error);
    }
  }

  /**
   * Security threat detected/resolved
   */
  static async onSecurityThreat(
    countryId: string,
    threatType: string,
    severity: string,
    status: "detected" | "resolved",
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      const priority =
        severity === "critical" ? "critical" : severity === "high" ? "high" : "medium";

      await db.activityFeed.create({
        data: {
          type: "meta",
          category: "game",
          userId: userId || null,
          countryId,
          title: `${country.name} ${status === "detected" ? "Faces" : "Resolves"} Security Threat`,
          description: `${country.name} has ${status} a ${severity} severity ${threatType} threat to national security.`,
          metadata: JSON.stringify({
            eventType: "security_threat",
            threatType,
            severity,
            status,
          }),
          priority,
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating security threat activity:", error);
    }
  }
}

/**
 * Activity hooks for social/ThinkPages operations
 */
export class SocialActivityHooks {
  /**
   * ThinkPage post created
   */
  static async onThinkPagePost(
    userId: string,
    countryId: string,
    postTitle: string,
    postType: string,
    visibility: "public" | "followers" | "friends"
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "social",
          category: "social",
          userId,
          countryId,
          title: `New ${postType} from ${country.name}`,
          description: postTitle,
          metadata: JSON.stringify({
            eventType: "thinkpage_post",
            postType,
          }),
          priority: "low",
          visibility,
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating ThinkPage post activity:", error);
    }
  }

  /**
   * User follows country
   */
  static async onFollowCountry(
    userId: string,
    countryId: string,
    userCountryId?: string
  ): Promise<void> {
    try {
      const [country, userCountry] = await Promise.all([
        db.country.findUnique({ where: { id: countryId }, select: { name: true } }),
        userCountryId
          ? db.country.findUnique({ where: { id: userCountryId }, select: { name: true } })
          : null,
      ]);

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "social",
          category: "social",
          userId,
          countryId: userCountryId || null,
          title: `${userCountry?.name || "User"} Follows ${country.name}`,
          description: `${userCountry?.name || "A user"} is now following ${country.name} for updates and activities.`,
          metadata: JSON.stringify({
            eventType: "follow_country",
            followedCountry: country.name,
          }),
          priority: "low",
          visibility: "friends",
          relatedCountries: JSON.stringify([countryId, ...(userCountryId ? [userCountryId] : [])]),
        },
      });
    } catch (error) {
      console.error("Error creating follow country activity:", error);
    }
  }

  /**
   * User joins platform
   */
  static async onUserJoined(userId: string, countryId?: string): Promise<void> {
    try {
      const country = countryId
        ? await db.country.findUnique({
            where: { id: countryId },
            select: { name: true },
          })
        : null;

      await db.activityFeed.create({
        data: {
          type: "social",
          category: "platform",
          userId,
          countryId: countryId || null,
          title: `New Leader Joins IxStats`,
          description: `A new leader has joined IxStats${country ? ` representing ${country.name}` : ""}!`,
          metadata: JSON.stringify({
            eventType: "user_joined",
            countryName: country?.name,
          }),
          priority: "low",
          visibility: "public",
          relatedCountries: countryId ? JSON.stringify([countryId]) : null,
        },
      });
    } catch (error) {
      console.error("Error creating user joined activity:", error);
    }
  }
}

/**
 * Activity hooks for user operations
 */
export class UserActivityHooks {
  /**
   * User links to country
   */
  static async onCountryLink(
    userId: string,
    countryId: string,
    isNewCountry: boolean
  ): Promise<void> {
    await ActivityGenerator.createCountryLinkActivity(userId, countryId, isNewCountry);
  }

  /**
   * User achievement unlocked
   */
  static async onAchievementUnlocked(
    userId: string,
    countryId: string,
    achievementName: string,
    achievementDescription: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      await db.activityFeed.create({
        data: {
          type: "achievement",
          category: "game",
          userId,
          countryId,
          title: `${country.name} Unlocks Achievement: ${achievementName}`,
          description: achievementDescription,
          metadata: JSON.stringify({
            eventType: "achievement_unlocked",
            achievementName,
          }),
          priority: "medium",
          visibility: "public",
          relatedCountries: JSON.stringify([countryId]),
        },
      });
    } catch (error) {
      console.error("Error creating achievement unlocked activity:", error);
    }
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
