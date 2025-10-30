// src/lib/activity-generator.ts
// Activity generator service for automatic activity creation

import { db } from "~/server/db";
import { formatCurrency, formatPopulation } from "./chart-utils";
import { IxTime } from "./ixtime";

export interface ActivityData {
  type: "achievement" | "diplomatic" | "economic" | "social" | "meta";
  category?: "game" | "platform" | "social";
  userId?: string;
  countryId?: string;
  title: string;
  description: string;
  metadata?: Record<string, any>;
  priority?: "low" | "medium" | "high" | "critical" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  visibility?: "public" | "followers" | "friends";
  relatedCountries?: string[];
}

// Helper to convert priority to lowercase
function normalizePriority(priority?: string): "low" | "medium" | "high" | "critical" {
  if (!priority) return "medium";
  const lower = priority.toLowerCase();
  if (lower === "low" || lower === "medium" || lower === "high" || lower === "critical") {
    return lower as "low" | "medium" | "high" | "critical";
  }
  return "medium";
}

export class ActivityGenerator {
  /**
   * Create an economic milestone activity
   */
  static async createEconomicMilestone(
    countryId: string,
    milestone: string,
    value: number,
    userId?: string
  ): Promise<void> {
    try {
      // Get country details
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true, economicTier: true, leader: true },
      });

      if (!country) {
        console.warn(`Country ${countryId} not found for economic milestone`);
        return;
      }

      const priority =
        value > 1000000000000
          ? "CRITICAL" // 1T+
          : value > 100000000000
            ? "HIGH" // 100B+
            : value > 10000000000
              ? "MEDIUM"
              : "LOW"; // 10B+

      const activity: ActivityData = {
        type: "achievement",
        category: "game",
        userId,
        countryId,
        title: `${country.name} Achieves ${milestone}`,
        description: `${country.name} has reached a major economic milestone with ${milestone} of ${formatCurrency(value)}, entering the ${country.economicTier} tier!`,
        metadata: {
          milestone,
          value,
          tier: country.economicTier,
          countryName: country.name,
        },
        priority,
        visibility: "public",
        relatedCountries: [countryId],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating economic milestone activity:", error);
    }
  }

  /**
   * Create a population milestone activity
   */
  static async createPopulationMilestone(
    countryId: string,
    population: number,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true, populationTier: true, leader: true },
      });

      if (!country) return;

      const priority =
        population > 100000000
          ? "CRITICAL" // 100M+
          : population > 50000000
            ? "HIGH" // 50M+
            : population > 10000000
              ? "MEDIUM"
              : "LOW"; // 10M+

      const activity: ActivityData = {
        type: "achievement",
        category: "game",
        userId,
        countryId,
        title: `${country.name} Reaches Population Milestone`,
        description: `${country.name} has achieved a population of ${formatPopulation(population)}, classified as ${country.populationTier} tier!`,
        metadata: {
          population,
          tier: country.populationTier,
          countryName: country.name,
        },
        priority,
        visibility: "public",
        relatedCountries: [countryId],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating population milestone activity:", error);
    }
  }

  /**
   * Create a diplomatic event activity
   */
  static async createDiplomaticEvent(
    country1Id: string,
    country2Id: string,
    eventType: string,
    title: string,
    description: string,
    tradeValue?: number
  ): Promise<void> {
    try {
      const [country1, country2] = await Promise.all([
        db.country.findUnique({ where: { id: country1Id }, select: { name: true } }),
        db.country.findUnique({ where: { id: country2Id }, select: { name: true } }),
      ]);

      if (!country1 || !country2) return;

      // Create diplomatic event record
      await db.diplomaticEvent.create({
        data: {
          country1Id,
          country2Id,
          eventType,
          title,
          description,
          tradeValue,
          status: "active",
        },
      });

      // Create activity feed entry
      const activity: ActivityData = {
        type: "diplomatic",
        category: "game",
        title: `${title}`,
        description: `${country1.name} and ${country2.name} ${description}`,
        metadata: {
          eventType,
          countries: [country1.name, country2.name],
          tradeValue,
        },
        priority: tradeValue && tradeValue > 50000000000 ? "HIGH" : "MEDIUM",
        visibility: "public",
        relatedCountries: [country1Id, country2Id],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating diplomatic event activity:", error);
    }
  }

  /**
   * Create a tier change activity
   */
  static async createTierChange(
    countryId: string,
    tierType: "economic" | "population",
    oldTier: string,
    newTier: string,
    userId?: string
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: {
          name: true,
          currentTotalGdp: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
        },
      });

      if (!country) return;

      // Determine if this is a promotion or demotion
      const tierHierarchy = [
        "Impoverished",
        "Developing",
        "Developed",
        "Healthy",
        "Strong",
        "Very Strong",
        "Extravagant",
      ];

      const oldIndex = tierHierarchy.indexOf(oldTier);
      const newIndex = tierHierarchy.indexOf(newTier);
      const isPromotion = newIndex > oldIndex;

      const activity: ActivityData = {
        type: "achievement",
        category: "game",
        userId,
        countryId,
        title: `${country.name} ${isPromotion ? "Promoted" : "Changed"} to ${newTier} Tier`,
        description: `${country.name} has ${isPromotion ? "advanced" : "moved"} from ${oldTier} to ${newTier} tier in ${tierType} classification!`,
        metadata: {
          tierType,
          oldTier,
          newTier,
          isPromotion,
          currentGdp: country.currentTotalGdp,
          currentPopulation: country.currentPopulation,
          currentGdpPerCapita: country.currentGdpPerCapita,
        },
        priority:
          isPromotion && (newTier === "Extravagant" || newTier === "Very Strong")
            ? "HIGH"
            : "MEDIUM",
        visibility: "public",
        relatedCountries: [countryId],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating tier change activity:", error);
    }
  }

  /**
   * Create a user country link activity
   */
  static async createCountryLinkActivity(
    userId: string,
    countryId: string,
    isNewCountry: boolean = false
  ): Promise<void> {
    try {
      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true },
      });

      if (!country) return;

      const activity: ActivityData = {
        type: "social",
        category: "game",
        userId,
        countryId,
        title: isNewCountry ? "New Nation Founded" : "Leadership Established",
        description: isNewCountry
          ? `A new nation, ${country.name}, has been founded and joins the world community!`
          : `New leadership has been established in ${country.name}.`,
        metadata: {
          isNewCountry,
          countryName: country.name,
        },
        priority: "MEDIUM",
        visibility: "public",
        relatedCountries: [countryId],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating country link activity:", error);
    }
  }

  /**
   * Create a platform announcement activity
   */
  static async createPlatformAnnouncement(
    title: string,
    description: string,
    version?: string,
    features?: string[]
  ): Promise<void> {
    try {
      const activity: ActivityData = {
        type: "meta",
        category: "platform",
        title,
        description,
        metadata: {
          version,
          features,
          timestamp: new Date().toISOString(),
        },
        priority: "MEDIUM",
        visibility: "public",
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating platform announcement activity:", error);
    }
  }

  /**
   * Create a high economic growth activity
   */
  static async createHighGrowthActivity(
    countryId: string,
    growthRate: number,
    userId?: string
  ): Promise<void> {
    try {
      if (growthRate < 0.04) return; // Only for 4%+ growth

      const country = await db.country.findUnique({
        where: { id: countryId },
        select: { name: true, currentTotalGdp: true },
      });

      if (!country) return;

      const activity: ActivityData = {
        type: "economic",
        category: "game",
        userId,
        countryId,
        title: `${country.name} Shows Strong Economic Growth`,
        description: `${country.name} is experiencing robust economic growth at ${(growthRate * 100).toFixed(1)}% annually, with GDP of ${formatCurrency(country.currentTotalGdp || 0)}`,
        metadata: {
          growthRate,
          gdp: country.currentTotalGdp,
          countryName: country.name,
        },
        priority: growthRate > 0.08 ? "HIGH" : "MEDIUM", // 8%+ is high priority
        visibility: "public",
        relatedCountries: [countryId],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating high growth activity:", error);
    }
  }

  /**
   * Core method to create activity in database
   */
  private static async createActivity(activityData: ActivityData): Promise<void> {
    try {
      await db.activityFeed.create({
        data: {
          type: activityData.type,
          category: activityData.category || "game",
          userId: activityData.userId || null,
          countryId: activityData.countryId || null,
          title: activityData.title,
          description: activityData.description,
          metadata: activityData.metadata ? JSON.stringify(activityData.metadata) : null,
          priority: normalizePriority(activityData.priority),
          visibility: activityData.visibility || "public",
          relatedCountries: activityData.relatedCountries
            ? JSON.stringify(activityData.relatedCountries)
            : null,
        },
      });
    } catch (error) {
      console.error("Error saving activity to database:", error);
      throw error;
    }
  }

  /**
   * Generate sample activities for testing
   */
  static async generateSampleActivities(): Promise<void> {
    try {
      // Get some countries for sample data
      const countries = await db.country.findMany({
        take: 5,
        select: { id: true, name: true, currentTotalGdp: true, economicTier: true },
      });

      if (countries.length === 0) {
        console.log("No countries found for sample activities");
        return;
      }

      // Create sample activities
      const sampleActivities: ActivityData[] = [
        {
          type: "meta",
          category: "platform",
          title: "Activity Feed System Launch",
          description:
            "Introducing the new live activity feed system with real-time updates, social interactions, and comprehensive engagement tracking!",
          metadata: {
            version: "2.1.0",
            features: ["Live Activity Feed", "Real-time Updates", "Social Engagement"],
          },
          priority: "HIGH",
          visibility: "public",
        },
      ];

      // Add country-specific activities
      for (const country of countries.slice(0, 3)) {
        sampleActivities.push({
          type: "achievement",
          category: "game",
          countryId: country.id,
          title: `${country.name} Economic Update`,
          description: `${country.name} maintains strong economic performance with current GDP of ${formatCurrency(country.currentTotalGdp || 0)} in the ${country.economicTier} tier.`,
          metadata: {
            gdp: country.currentTotalGdp,
            tier: country.economicTier,
          },
          priority: "MEDIUM",
          visibility: "public",
          relatedCountries: [country.id],
        });
      }

      // Create diplomatic activity if we have at least 2 countries
      if (countries.length >= 2) {
        sampleActivities.push({
          type: "diplomatic",
          category: "game",
          title: "Trade Partnership Established",
          description: `${countries[0]!.name} and ${countries[1]!.name} have established a comprehensive trade partnership to boost bilateral economic cooperation.`,
          metadata: {
            countries: [countries[0]!.name, countries[1]!.name],
            eventType: "trade_agreement",
            tradeValue: 25000000000,
          },
          priority: "MEDIUM",
          visibility: "public",
          relatedCountries: [countries[0]!.id, countries[1]!.id],
        });
      }

      // Save all sample activities
      for (const activity of sampleActivities) {
        await this.createActivity(activity);
      }

      console.log(`Created ${sampleActivities.length} sample activities`);
    } catch (error) {
      console.error("Error generating sample activities:", error);
    }
  }
}
