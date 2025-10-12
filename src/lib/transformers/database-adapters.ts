import type { Priority, Category, Trend } from '@prisma/client';
import type { StandardPriority, StandardCategory, StandardTrend } from '~/types/base';

/**
 * Database Schema Alignment Adapters
 * Transforms Prisma enum types to TypeScript union types and vice versa
 */

// Prisma to TypeScript transformations
export const prismaToTypescript = {
  priority: (priority: Priority): StandardPriority => {
    // Priority enum in Prisma is already lowercase, so just return it
    return priority as StandardPriority;
  },

  category: (category: Category): StandardCategory => {
    // Category enum in Prisma is already lowercase, so just return it
    return category as StandardCategory;
  },

  trend: (trend: Trend): StandardTrend => {
    // Trend enum in Prisma is already lowercase, so just return it
    return trend as StandardTrend;
  }
};

// TypeScript to Prisma transformations
export const typescriptToPrisma = {
  priority: (priority: StandardPriority): Priority => {
    // Priority enum in Prisma is already lowercase, so just return it
    return priority as Priority;
  },

  category: (category: StandardCategory): Category => {
    // Category enum in Prisma is already lowercase, so just return it
    // Map 'crisis' to 'economic' as fallback
    return (category === 'crisis' ? 'economic' : category) as Category;
  },

  trend: (trend: StandardTrend): Trend => {
    // Trend enum in Prisma is already lowercase, so just return it
    return trend as Trend;
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