import type { Priority, Category, Trend } from '@prisma/client';
import type { StandardPriority, StandardCategory, StandardTrend } from '~/types/base';

/**
 * Database Schema Alignment Adapters
 * Transforms Prisma enum types to TypeScript union types and vice versa
 */

// Prisma to TypeScript transformations
export const prismaToTypescript = {
  priority: (priority: Priority): StandardPriority => {
    const mapping: Record<Priority, StandardPriority> = {
      CRITICAL: 'critical',
      HIGH: 'high',
      MEDIUM: 'medium',
      LOW: 'low'
    };
    return mapping[priority];
  },

  category: (category: Category): StandardCategory => {
    const mapping: Record<Category, StandardCategory> = {
      ECONOMIC: 'economic',
      DIPLOMATIC: 'diplomatic',
      SOCIAL: 'social',
      GOVERNANCE: 'governance',
      SECURITY: 'security',
      INFRASTRUCTURE: 'infrastructure'
    };
    return mapping[category];
  },

  trend: (trend: Trend): StandardTrend => {
    const mapping: Record<Trend, StandardTrend> = {
      UP: 'up',
      DOWN: 'down',
      STABLE: 'stable'
    };
    return mapping[trend];
  }
};

// TypeScript to Prisma transformations
export const typescriptToPrisma = {
  priority: (priority: StandardPriority): Priority => {
    const mapping: Record<StandardPriority, Priority> = {
      'critical': 'CRITICAL',
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return mapping[priority];
  },

  category: (category: StandardCategory): Category => {
    const mapping: Record<StandardCategory, Category> = {
      'economic': 'ECONOMIC',
      'diplomatic': 'DIPLOMATIC',
      'social': 'SOCIAL',
      'governance': 'GOVERNANCE',
      'security': 'SECURITY',
      'infrastructure': 'INFRASTRUCTURE',
      'crisis': 'ECONOMIC' // Map crisis to economic as fallback
    };
    return mapping[category];
  },

  trend: (trend: StandardTrend): Trend => {
    const mapping: Record<StandardTrend, Trend> = {
      'up': 'UP',
      'down': 'DOWN',
      'stable': 'STABLE'
    };
    return mapping[trend];
  }
};

// Enhanced database entity adapter with enum conversion
export const adaptDatabaseEntityWithEnums = <T>(dbEntity: Record<string, unknown>): T => {
  const adapted = { ...dbEntity };

  // Convert Prisma enums to TypeScript union types
  if (adapted.priority && typeof adapted.priority === 'string') {
    adapted.priority = prismaToTypescript.priority(adapted.priority as Priority);
  }
  if (adapted.severity && typeof adapted.severity === 'string') {
    adapted.severity = prismaToTypescript.priority(adapted.severity as Priority);
  }
  if (adapted.category && typeof adapted.category === 'string') {
    adapted.category = prismaToTypescript.category(adapted.category as Category);
  }

  // Handle timestamp conversions
  if (adapted.timestamp instanceof Date) {
    adapted.timestamp = adapted.timestamp.getTime();
  }
  if (adapted.createdAt instanceof Date) {
    adapted.createdAt = adapted.createdAt.getTime();
  }
  if (adapted.updatedAt instanceof Date) {
    adapted.updatedAt = adapted.updatedAt.getTime();
  }

  // Handle null to undefined conversions
  Object.keys(adapted).forEach(key => {
    if (adapted[key] === null) {
      adapted[key] = undefined;
    }
  });

  return adapted as T;
};

// Create database entity from TypeScript interface
export const prepareEntityForDatabase = (entity: any): any => {
  const prepared = { ...entity };

  // Convert TypeScript union types to Prisma enums
  if (prepared.priority && typeof prepared.priority === 'string') {
    prepared.priority = typescriptToPrisma.priority(prepared.priority as StandardPriority);
  }
  if (prepared.severity && typeof prepared.severity === 'string') {
    prepared.severity = typescriptToPrisma.priority(prepared.severity as StandardPriority);
  }
  if (prepared.category && typeof prepared.category === 'string') {
    prepared.category = typescriptToPrisma.category(prepared.category as StandardCategory);
  }

  // Convert Unix timestamps to Date objects
  if (typeof prepared.timestamp === 'number') {
    prepared.timestamp = new Date(prepared.timestamp);
  }
  if (typeof prepared.createdAt === 'number') {
    prepared.createdAt = new Date(prepared.createdAt);
  }
  if (typeof prepared.updatedAt === 'number') {
    prepared.updatedAt = new Date(prepared.updatedAt);
  }

  // Handle undefined to null conversions for optional fields
  Object.keys(prepared).forEach(key => {
    if (prepared[key] === undefined) {
      prepared[key] = null;
    }
  });

  return prepared;
};