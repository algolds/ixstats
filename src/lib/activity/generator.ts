// src/lib/activity-generator.ts
// Activity generator service for automatic activity creation

import { db } from "~/server/db";

interface ActivityData {
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
   * Core method to create activity in database
   */
  static async createActivity(activityData: ActivityData): Promise<void> {
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
   * Create an Onoma generation activity
   */
  static async createOnomaGeneration(
    userId: string,
    countryId: string | null | undefined,
    count: number,
    category: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { country: { select: { name: true } } },
      });

      const nameSource = user?.country?.name || "A citizen";

      const activity: ActivityData = {
        type: "social",
        category: "game",
        userId,
        countryId: countryId || undefined,
        title: "Names Generated in Onoma Lab",
        description: `${nameSource} generated ${count} ${category} names using Onoma Lab.`,
        metadata: {
          count,
          category,
          timestamp: new Date().toISOString(),
        },
        priority: "LOW",
        visibility: "public",
        relatedCountries: countryId ? [countryId] : [],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating Onoma generation activity:", error);
    }
  }

  /**
   * Create an Onoma dictionary share activity
   */
  static async createOnomaShare(
    userId: string,
    countryId: string | null | undefined,
    title: string
  ): Promise<void> {
    try {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { country: { select: { name: true } } },
      });

      const nameSource = user?.country?.name || "A citizen";

      const activity: ActivityData = {
        type: "social",
        category: "game",
        userId,
        countryId: countryId || undefined,
        title: "Naming Dictionary Shared",
        description: `${nameSource} shared a naming dictionary: ${title}`,
        metadata: {
          title,
          timestamp: new Date().toISOString(),
        },
        priority: "MEDIUM",
        visibility: "public",
        relatedCountries: countryId ? [countryId] : [],
      };

      await this.createActivity(activity);
    } catch (error) {
      console.error("Error creating Onoma share activity:", error);
    }
  }
}
