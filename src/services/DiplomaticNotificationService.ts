/**
 * Diplomatic Notification Service
 * Specialized service for diplomatic events and relationship changes
 */

"use client";

import { EventEmitter } from "events";
import { globalNotificationBridge } from "./GlobalNotificationBridge";
import type { NotificationPriority } from "~/types/unified-notifications";

interface DiplomaticEvent {
  id: string;
  type:
    | "agreement"
    | "treaty"
    | "conflict"
    | "trade"
    | "alliance"
    | "sanction"
    | "embassy"
    | "meeting";
  title: string;
  description: string;
  countries: string[];
  significance: "minor" | "moderate" | "major" | "historic";
  timestamp: number;
  relatedData?: any;
}

interface RelationshipChange {
  fromCountry: string;
  toCountry: string;
  oldRelationship: number;
  newRelationship: number;
  changeReason: string;
  timestamp: number;
}

class DiplomaticNotificationService extends EventEmitter {
  private static instance: DiplomaticNotificationService;
  private recentEvents = new Map<string, number>();
  private relationshipThresholds = {
    major: 25, // Changes >= 25 points
    moderate: 15, // Changes >= 15 points
    minor: 5, // Changes >= 5 points
  };

  static getInstance(): DiplomaticNotificationService {
    if (!DiplomaticNotificationService.instance) {
      DiplomaticNotificationService.instance = new DiplomaticNotificationService();
    }
    return DiplomaticNotificationService.instance;
  }

  constructor() {
    super();
    this.setupEventTypes();
  }

  private setupEventTypes() {
    // Event type configurations
    this.eventTypeConfigs = {
      agreement: {
        priority: "medium" as NotificationPriority,
        emoji: "🤝",
        category: "diplomatic" as const,
        titleTemplate: "New Agreement: {title}",
        messageTemplate: "{description}",
      },
      treaty: {
        priority: "high" as NotificationPriority,
        emoji: "📜",
        category: "diplomatic" as const,
        titleTemplate: "Treaty Signed: {title}",
        messageTemplate: "Historic treaty established: {description}",
      },
      conflict: {
        priority: "critical" as NotificationPriority,
        emoji: "⚔️",
        category: "crisis" as const,
        titleTemplate: "Diplomatic Crisis: {title}",
        messageTemplate: "URGENT: {description}",
      },
      trade: {
        priority: "medium" as NotificationPriority,
        emoji: "💼",
        category: "economic" as const,
        titleTemplate: "Trade Update: {title}",
        messageTemplate: "{description}",
      },
      alliance: {
        priority: "high" as NotificationPriority,
        emoji: "🛡️",
        category: "diplomatic" as const,
        titleTemplate: "Alliance Formed: {title}",
        messageTemplate: "Strategic alliance established: {description}",
      },
      sanction: {
        priority: "high" as NotificationPriority,
        emoji: "🚫",
        category: "economic" as const,
        titleTemplate: "Sanctions Imposed: {title}",
        messageTemplate: "Economic sanctions: {description}",
      },
      embassy: {
        priority: "low" as NotificationPriority,
        emoji: "🏛️",
        category: "diplomatic" as const,
        titleTemplate: "Embassy News: {title}",
        messageTemplate: "{description}",
      },
      meeting: {
        priority: "low" as NotificationPriority,
        emoji: "👥",
        category: "diplomatic" as const,
        titleTemplate: "Diplomatic Meeting: {title}",
        messageTemplate: "{description}",
      },
      // Gracefully handle generic update events from streams
      update: {
        priority: "low" as NotificationPriority,
        emoji: "🔔",
        category: "diplomatic" as const,
        titleTemplate: "Diplomatic Update: {title}",
        messageTemplate: "{description}",
      },
    };
  }

  private eventTypeConfigs: Record<
    string,
    {
      priority: NotificationPriority;
      emoji: string;
      category: "diplomatic" | "economic" | "crisis";
      titleTemplate: string;
      messageTemplate: string;
    }
  > = {};

  /**
   * Process a diplomatic event and create notifications
   */
  async processDiplomaticEvent(event: DiplomaticEvent) {
    const eventKey = `${event.type}-${event.id}`;

    // Prevent duplicate notifications within 10 minutes
    const lastNotification = this.recentEvents.get(eventKey);
    if (lastNotification && Date.now() - lastNotification < 600000) {
      return;
    }

    const config = this.eventTypeConfigs[event.type];
    if (!config) {
      console.warn(`[DiplomaticNotificationService] Unknown event type: ${event.type}`);
      return;
    }

    // Adjust priority based on significance
    let adjustedPriority = config.priority;
    if (event.significance === "historic") {
      adjustedPriority = "critical";
    } else if (event.significance === "major") {
      adjustedPriority = adjustedPriority === "low" ? "medium" : "high";
    }

    const notification = {
      eventType: event.type,
      title: this.formatTemplate(config.titleTemplate, event),
      description: this.formatTemplate(config.messageTemplate, event),
      countries: event.countries,
    };

    try {
      globalNotificationBridge.wireDiplomaticStream(notification);
      this.recentEvents.set(eventKey, Date.now());

      console.log(`[DiplomaticNotificationService] Processed ${event.type} event: ${event.title}`);
      this.emit("eventProcessed", { event, notification });
    } catch (error) {
      console.error("[DiplomaticNotificationService] Failed to process event:", error);
    }
  }

  /**
   * Process relationship changes
   */
  async processRelationshipChange(change: RelationshipChange) {
    const changeAmount = Math.abs(change.newRelationship - change.oldRelationship);

    if (changeAmount < this.relationshipThresholds.minor) {
      return; // Too small to notify
    }

    const isImproving = change.newRelationship > change.oldRelationship;
    const significance = this.getRelationshipChangeSignificance(changeAmount);

    let priority: NotificationPriority = "low";
    let emoji = isImproving ? "📈" : "📉";

    if (significance === "major") {
      priority = "high";
      emoji = isImproving ? "🎉" : "⚠️";
    } else if (significance === "moderate") {
      priority = "medium";
      emoji = isImproving ? "👍" : "👎";
    }

    const notification = {
      eventType: "relationship-change",
      title: `${emoji} Diplomatic Relations ${isImproving ? "Improved" : "Deteriorated"}`,
      description: `Relations between countries changed by ${changeAmount.toFixed(1)} points: ${change.changeReason}`,
      countries: [change.fromCountry, change.toCountry],
    };

    try {
      globalNotificationBridge.wireDiplomaticStream(notification);

      console.log(
        `[DiplomaticNotificationService] Relationship change: ${change.fromCountry} -> ${change.toCountry} (${changeAmount.toFixed(1)} points)`
      );
      this.emit("relationshipChanged", { change, notification });
    } catch (error) {
      console.error(
        "[DiplomaticNotificationService] Failed to process relationship change:",
        error
      );
    }
  }

  private formatTemplate(template: string, event: DiplomaticEvent): string {
    return template
      .replace("{title}", event.title)
      .replace("{description}", event.description)
      .replace("{countries}", event.countries.join(", "));
  }

  private getRelationshipChangeSignificance(changeAmount: number): "minor" | "moderate" | "major" {
    if (changeAmount >= this.relationshipThresholds.major) return "major";
    if (changeAmount >= this.relationshipThresholds.moderate) return "moderate";
    return "minor";
  }

  /**
   * Batch process multiple diplomatic events
   */
  async batchProcessEvents(events: DiplomaticEvent[]) {
    console.log(
      `[DiplomaticNotificationService] Batch processing ${events.length} diplomatic events`
    );

    const results = await Promise.allSettled(
      events.map((event) => this.processDiplomaticEvent(event))
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - successful;

    console.log(
      `[DiplomaticNotificationService] Batch complete: ${successful} successful, ${failed} failed`
    );

    this.emit("batchProcessed", { total: events.length, successful, failed });
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      recentEvents: this.recentEvents.size,
      eventTypes: Object.keys(this.eventTypeConfigs).length,
      relationshipThresholds: this.relationshipThresholds,
    };
  }

  /**
   * Clear old events from cache
   */
  cleanup() {
    const now = Date.now();
    const cutoff = 600000; // 10 minutes

    for (const [key, timestamp] of this.recentEvents.entries()) {
      if (now - timestamp > cutoff) {
        this.recentEvents.delete(key);
      }
    }
  }
}

// Export singleton
export const diplomaticNotificationService = DiplomaticNotificationService.getInstance();

// Achievement System Integration
interface Achievement {
  id: string;
  name: string;
  description: string;
  category: "economic" | "diplomatic" | "social" | "military" | "cultural";
  rarity: "common" | "uncommon" | "rare" | "epic" | "legendary";
  unlocked: boolean;
  unlockedAt?: number;
  progress?: number;
  maxProgress?: number;
  rewards?: any[];
}

class AchievementNotificationService {
  private static instance: AchievementNotificationService;
  private unlockedAchievements = new Set<string>();

  static getInstance(): AchievementNotificationService {
    if (!AchievementNotificationService.instance) {
      AchievementNotificationService.instance = new AchievementNotificationService();
    }
    return AchievementNotificationService.instance;
  }

  async processAchievementUnlock(achievement: Achievement) {
    if (!achievement.unlocked || this.unlockedAchievements.has(achievement.id)) {
      return;
    }

    const rarityConfig = {
      common: { emoji: "🏅", priority: "low" as NotificationPriority },
      uncommon: { emoji: "🥉", priority: "low" as NotificationPriority },
      rare: { emoji: "🥈", priority: "medium" as NotificationPriority },
      epic: { emoji: "🥇", priority: "medium" as NotificationPriority },
      legendary: { emoji: "👑", priority: "high" as NotificationPriority },
    };

    const config = rarityConfig[achievement.rarity] || rarityConfig.common;

    const notification = {
      name: `${config.emoji} ${achievement.name}`,
      description: achievement.description,
      unlocked: true,
      category: achievement.category,
    };

    try {
      globalNotificationBridge.wireAchievementStream(notification);
      this.unlockedAchievements.add(achievement.id);

      console.log(
        `[AchievementNotificationService] Achievement unlocked: ${achievement.name} (${achievement.rarity})`
      );
    } catch (error) {
      console.error("[AchievementNotificationService] Failed to process achievement:", error);
    }
  }

  processProgressUpdate(achievement: Achievement) {
    // For progress-based achievements, could show milestone notifications
    if (achievement.progress && achievement.maxProgress) {
      const progressPercent = (achievement.progress / achievement.maxProgress) * 100;

      // Notify at 25%, 50%, 75% milestones
      if ([25, 50, 75].includes(Math.floor(progressPercent))) {
        console.log(
          `[AchievementNotificationService] Achievement progress: ${achievement.name} - ${progressPercent.toFixed(0)}%`
        );
      }
    }
  }
}

export const achievementNotificationService = AchievementNotificationService.getInstance();

export default diplomaticNotificationService;
