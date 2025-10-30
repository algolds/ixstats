import type {
  AchievementConstellation,
  DiplomaticAchievement,
  ConstellationLayout,
  ConstellationPosition,
  AchievementCategory,
  ConstellationTheme,
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
} from "~/types/achievement-constellation";

export class ConstellationBuilder {
  private width: number;
  private height: number;
  private centerX: number;
  private centerY: number;

  constructor(width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
    this.centerX = width / 2;
    this.centerY = height / 2;
  }

  /**
   * Build a complete constellation layout from achievements
   */
  buildConstellation(
    achievements: DiplomaticAchievement[],
    theme: ConstellationTheme = "classic_gold"
  ): ConstellationLayout {
    const layout: ConstellationLayout = {
      centerX: this.centerX,
      centerY: this.centerY,
      radius: Math.min(this.width, this.height) * 0.35,
      rotation: 0,
      theme,
      customPositions: {},
    };

    // Group achievements by category for better organization
    const groupedAchievements = this.groupAchievementsByCategory(achievements);

    // Calculate positions for each category group
    const categoryPositions = this.calculateCategoryPositions(
      Object.keys(groupedAchievements),
      layout.radius
    );

    // Position achievements within their categories
    Object.entries(groupedAchievements).forEach(
      ([category, categoryAchievements], categoryIndex) => {
        const categoryCenter = categoryPositions[category as AchievementCategory];
        const positions = this.positionAchievementsInCategory(
          categoryAchievements,
          categoryCenter,
          layout.radius * 0.3
        );

        positions.forEach((position, index) => {
          const achievement = categoryAchievements[index];
          if (achievement) {
            layout.customPositions![achievement.id] = {
              ...position,
              connections: this.calculateConnections(achievement, achievements),
            };
          }
        });
      }
    );

    return layout;
  }

  /**
   * Group achievements by category
   */
  private groupAchievementsByCategory(
    achievements: DiplomaticAchievement[]
  ): Record<AchievementCategory, DiplomaticAchievement[]> {
    const groups: Record<string, DiplomaticAchievement[]> = {};

    achievements.forEach((achievement) => {
      if (!groups[achievement.category]) {
        groups[achievement.category] = [];
      }
      groups[achievement.category]?.push(achievement);
    });

    // Sort achievements within each category by tier and rarity
    Object.values(groups).forEach((group) => {
      group.sort((a, b) => {
        const tierOrder = { bronze: 1, silver: 2, gold: 3, diamond: 4, legendary: 5 };
        const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };

        if (tierOrder[a.tier] !== tierOrder[b.tier]) {
          return tierOrder[b.tier] - tierOrder[a.tier]; // Higher tiers first
        }

        return rarityOrder[b.rarity] - rarityOrder[a.rarity]; // Rarer first
      });
    });

    return groups as Record<AchievementCategory, DiplomaticAchievement[]>;
  }

  /**
   * Calculate positions for each category around the constellation center
   */
  private calculateCategoryPositions(
    categories: string[],
    radius: number
  ): Record<AchievementCategory, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    const angleStep = (2 * Math.PI) / categories.length;

    categories.forEach((category, index) => {
      const angle = index * angleStep;
      positions[category] = {
        x: this.centerX + Math.cos(angle) * radius,
        y: this.centerY + Math.sin(angle) * radius,
      };
    });

    return positions as Record<AchievementCategory, { x: number; y: number }>;
  }

  /**
   * Position achievements within a category using constellation patterns
   */
  private positionAchievementsInCategory(
    achievements: DiplomaticAchievement[],
    categoryCenter: { x: number; y: number },
    maxRadius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];

    if (achievements.length === 1) {
      // Single achievement at category center
      const achievement = achievements[0];
      if (achievement) {
        positions.push({
          x: categoryCenter.x,
          y: categoryCenter.y,
          brightness: this.calculateBrightness(achievement),
          size: this.calculateSize(achievement),
          layer: this.calculateLayer(achievement),
        });
      }
    } else {
      // Multiple achievements in constellation pattern
      const firstAchievement = achievements[0];
      if (firstAchievement) {
        const shape = ACHIEVEMENT_CATEGORY_CONFIG[firstAchievement.category].constellationShape;
        positions.push(
          ...this.createConstellationShape(achievements, categoryCenter, maxRadius, shape)
        );
      }
    }

    return positions;
  }

  /**
   * Create constellation shapes (circle, star, diamond, etc.)
   */
  private createConstellationShape(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number,
    shape: "circle" | "star" | "diamond" | "triangle" | "hexagon"
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];

    switch (shape) {
      case "circle":
        positions.push(...this.createCirclePattern(achievements, center, radius));
        break;
      case "star":
        positions.push(...this.createStarPattern(achievements, center, radius));
        break;
      case "diamond":
        positions.push(...this.createDiamondPattern(achievements, center, radius));
        break;
      case "triangle":
        positions.push(...this.createTrianglePattern(achievements, center, radius));
        break;
      case "hexagon":
        positions.push(...this.createHexagonPattern(achievements, center, radius));
        break;
    }

    return positions;
  }

  /**
   * Create circular constellation pattern
   */
  private createCirclePattern(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];
    const angleStep = (2 * Math.PI) / achievements.length;

    achievements.forEach((achievement, index) => {
      const angle = index * angleStep;
      const distanceVariation = 0.8 + Math.random() * 0.4; // Add some organic variation
      const actualRadius = radius * distanceVariation;

      positions.push({
        x: center.x + Math.cos(angle) * actualRadius,
        y: center.y + Math.sin(angle) * actualRadius,
        brightness: this.calculateBrightness(achievement),
        size: this.calculateSize(achievement),
        layer: this.calculateLayer(achievement),
      });
    });

    return positions;
  }

  /**
   * Create star constellation pattern
   */
  private createStarPattern(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];
    const points = Math.max(5, achievements.length); // At least 5 points for a star
    const angleStep = (2 * Math.PI) / points;

    achievements.forEach((achievement, index) => {
      const pointIndex = index % points;
      const angle = pointIndex * angleStep;

      // Alternate between outer and inner points
      const isOuterPoint = pointIndex % 2 === 0;
      const actualRadius = isOuterPoint ? radius : radius * 0.4;

      positions.push({
        x: center.x + Math.cos(angle) * actualRadius,
        y: center.y + Math.sin(angle) * actualRadius,
        brightness: this.calculateBrightness(achievement),
        size: this.calculateSize(achievement),
        layer: this.calculateLayer(achievement),
      });
    });

    return positions;
  }

  /**
   * Create diamond constellation pattern
   */
  private createDiamondPattern(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];
    const diamondPoints = [
      { x: 0, y: -radius }, // Top
      { x: radius, y: 0 }, // Right
      { x: 0, y: radius }, // Bottom
      { x: -radius, y: 0 }, // Left
    ];

    achievements.forEach((achievement, index) => {
      const pointIndex = index % 4;
      const point = diamondPoints[pointIndex];

      if (point) {
        // Add some variation for multiple achievements at same point
        const variation = Math.floor(index / 4) * 0.3;
        const xOffset = (Math.random() - 0.5) * variation * radius;
        const yOffset = (Math.random() - 0.5) * variation * radius;

        positions.push({
          x: center.x + point.x + xOffset,
          y: center.y + point.y + yOffset,
          brightness: this.calculateBrightness(achievement),
          size: this.calculateSize(achievement),
          layer: this.calculateLayer(achievement),
        });
      }
    });

    return positions;
  }

  /**
   * Create triangle constellation pattern
   */
  private createTrianglePattern(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];
    const trianglePoints = [
      { x: 0, y: -radius }, // Top
      { x: radius * 0.866, y: radius * 0.5 }, // Bottom right
      { x: -radius * 0.866, y: radius * 0.5 }, // Bottom left
    ];

    achievements.forEach((achievement, index) => {
      const pointIndex = index % 3;
      const point = trianglePoints[pointIndex];

      if (point) {
        // Add variation for multiple achievements
        const variation = Math.floor(index / 3) * 0.4;
        const xOffset = (Math.random() - 0.5) * variation * radius;
        const yOffset = (Math.random() - 0.5) * variation * radius;

        positions.push({
          x: center.x + point.x + xOffset,
          y: center.y + point.y + yOffset,
          brightness: this.calculateBrightness(achievement),
          size: this.calculateSize(achievement),
          layer: this.calculateLayer(achievement),
        });
      }
    });

    return positions;
  }

  /**
   * Create hexagon constellation pattern
   */
  private createHexagonPattern(
    achievements: DiplomaticAchievement[],
    center: { x: number; y: number },
    radius: number
  ): ConstellationPosition[] {
    const positions: ConstellationPosition[] = [];
    const angleStep = Math.PI / 3; // 60 degrees

    achievements.forEach((achievement, index) => {
      const pointIndex = index % 6;
      const angle = pointIndex * angleStep;

      // Add rings for more achievements
      const ring = Math.floor(index / 6);
      const actualRadius = radius * (0.7 + ring * 0.3);

      positions.push({
        x: center.x + Math.cos(angle) * actualRadius,
        y: center.y + Math.sin(angle) * actualRadius,
        brightness: this.calculateBrightness(achievement),
        size: this.calculateSize(achievement),
        layer: this.calculateLayer(achievement),
      });
    });

    return positions;
  }

  /**
   * Calculate brightness based on achievement importance
   */
  private calculateBrightness(achievement: DiplomaticAchievement): number {
    const tierMultiplier = {
      bronze: 0.6,
      silver: 0.75,
      gold: 0.9,
      diamond: 1.0,
      legendary: 1.2,
    };

    const rarityMultiplier = {
      common: 1.0,
      uncommon: 1.1,
      rare: 1.25,
      epic: 1.5,
      legendary: 2.0,
    };

    const baseBrightness = 0.5;
    return Math.min(
      1.0,
      baseBrightness * tierMultiplier[achievement.tier] * rarityMultiplier[achievement.rarity]
    );
  }

  /**
   * Calculate size based on achievement tier
   */
  private calculateSize(achievement: DiplomaticAchievement): number {
    return ACHIEVEMENT_TIER_CONFIG[achievement.tier].size;
  }

  /**
   * Calculate layer (z-index) for overlapping
   */
  private calculateLayer(achievement: DiplomaticAchievement): number {
    const tierLayer = {
      bronze: 1,
      silver: 2,
      gold: 3,
      diamond: 4,
      legendary: 5,
    };

    return tierLayer[achievement.tier];
  }

  /**
   * Calculate connections between related achievements
   */
  private calculateConnections(
    achievement: DiplomaticAchievement,
    allAchievements: DiplomaticAchievement[]
  ): string[] {
    const connections: string[] = [];

    // Connect to dependencies
    if (achievement.dependsOn) {
      connections.push(...achievement.dependsOn);
    }

    // Connect achievements that depend on this one
    allAchievements.forEach((other) => {
      if (other.dependsOn?.includes(achievement.id)) {
        connections.push(other.id);
      }
    });

    // Connect achievements in the same category (limited to avoid clutter)
    const sameCategory = allAchievements
      .filter((other) => other.category === achievement.category && other.id !== achievement.id)
      .slice(0, 2); // Limit to 2 connections per category

    connections.push(...sameCategory.map((a) => a.id));

    return connections;
  }

  /**
   * Generate smooth animation paths for constellation transitions
   */
  generateAnimationPath(
    fromPosition: ConstellationPosition,
    toPosition: ConstellationPosition,
    steps: number = 60
  ): ConstellationPosition[] {
    const path: ConstellationPosition[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const easeT = this.easeInOutCubic(t);

      path.push({
        x: fromPosition.x + (toPosition.x - fromPosition.x) * easeT,
        y: fromPosition.y + (toPosition.y - fromPosition.y) * easeT,
        brightness:
          fromPosition.brightness + (toPosition.brightness - fromPosition.brightness) * easeT,
        size: fromPosition.size + (toPosition.size - fromPosition.size) * easeT,
        layer: Math.round(fromPosition.layer + (toPosition.layer - fromPosition.layer) * easeT),
        connections: toPosition.connections,
      });
    }

    return path;
  }

  /**
   * Easing function for smooth animations
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Optimize constellation layout to reduce overlapping
   */
  optimizeLayout(
    layout: ConstellationLayout,
    achievements: DiplomaticAchievement[]
  ): ConstellationLayout {
    if (!layout.customPositions) return layout;

    const optimizedPositions = { ...layout.customPositions };
    const minDistance = 30; // Minimum distance between stars

    // Simple force-based separation
    achievements.forEach((achievement) => {
      const currentPos = optimizedPositions[achievement.id];
      if (!currentPos) return;

      achievements.forEach((otherAchievement) => {
        if (achievement.id === otherAchievement.id) return;

        const otherPos = optimizedPositions[otherAchievement.id];
        if (!otherPos) return;

        const dx = currentPos.x - otherPos.x;
        const dy = currentPos.y - otherPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          const force = (minDistance - distance) / minDistance;
          const angle = Math.atan2(dy, dx);

          currentPos.x += Math.cos(angle) * force * 5;
          currentPos.y += Math.sin(angle) * force * 5;
        }
      });
    });

    return {
      ...layout,
      customPositions: optimizedPositions,
    };
  }
}
