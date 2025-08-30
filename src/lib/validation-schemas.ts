/**
 * Comprehensive Zod Validation Schemas
 * Runtime type validation for all major interfaces
 */

import { z } from 'zod';

// Base validation schemas
export const StandardPrioritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const StandardCategorySchema = z.enum(['economic', 'diplomatic', 'social', 'governance', 'security', 'infrastructure']);
export const StandardTrendSchema = z.enum(['up', 'down', 'stable']);
export const StandardTimeframeSchema = z.enum(['immediate', 'short', 'medium', 'long']);

// Icon reference schema
export const IconReferenceSchema = z.object({
  name: z.string(),
  variant: z.enum(['solid', 'outline']).optional(),
  color: z.string().optional(),
});

// Base entity schema
export const BaseEntitySchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
});

// Base action schema
export const BaseActionSchema = BaseEntitySchema.extend({
  title: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  priority: StandardPrioritySchema,
  category: StandardCategorySchema,
});

// Executive Action schema
export const ExecutiveActionSchema = BaseActionSchema.extend({
  type: z.literal('executive'),
  urgency: StandardPrioritySchema,
  estimatedImpact: z.object({
    economic: z.string().optional(),
    social: z.string().optional(),
    diplomatic: z.string().optional(),
    timeframe: z.string(),
  }),
  requirements: z.array(z.string()),
  cooldownHours: z.number().optional(),
  cost: z.object({
    economic: z.number(),
    political: z.number(),
    time: z.number(),
  }).optional(),
  risks: z.array(z.string()).optional(),
});

// Quick Action schema
export const QuickActionSchema = BaseActionSchema.extend({
  type: z.literal('quick'),
  icon: IconReferenceSchema,
  estimatedTime: z.string(),
  impact: StandardPrioritySchema,
});

// Intelligence Item schema with backward compatibility
export const IntelligenceItemSchema = z.object({
  id: z.string(),
  type: z.enum(['alert', 'opportunity', 'update', 'prediction', 'insight']),
  title: z.string(),
  description: z.string(),
  category: StandardCategorySchema,
  severity: StandardPrioritySchema,
  source: z.string(),
  confidence: z.number().min(0).max(100).optional(),
  actionable: z.boolean(),
  timestamp: z.number(),
  createdAt: z.number(),
  updatedAt: z.number().optional(),
  affectedRegions: z.array(z.string()).optional(),
  relatedItems: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  metrics: z.array(z.any()).optional(),
  
  // Backward compatibility properties
  priority: StandardPrioritySchema.optional(),
  content: z.string().optional(),
  relatedCountries: z.array(z.string()).optional(),
});

// Country data schema
export const CountryDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  currentPopulation: z.number().min(0),
  currentGdpPerCapita: z.number().min(0),
  currentTotalGdp: z.number().min(0),
  economicTier: z.string(),
  populationTier: z.string(),
  adjustedGdpGrowth: z.number(),
  populationGrowthRate: z.number(),
  lastCalculated: z.union([z.date(), z.string(), z.number()]),
  baselineDate: z.union([z.date(), z.string(), z.number()]).optional(),
  realGDPGrowthRate: z.number().optional(),
  flag: z.string().optional(),
  flagUrl: z.string().optional(),
});

// Validation utility functions
export function validateWithFallback<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  fallback: T
): T {
  const result = schema.safeParse(data);
  return result.success ? result.data : fallback;
}

export function validateArray<T>(
  schema: z.ZodSchema<T>,
  data: unknown[],
  fallback: T[] = []
): T[] {
  if (!Array.isArray(data)) return fallback;
  
  return data
    .map(item => schema.safeParse(item))
    .filter(result => result.success)
    .map(result => (result as z.ZodSafeParseSuccess<T>).data);
}

// Bulk validation functions
export const validate = {
  executiveAction: (data: unknown) => validateWithFallback(
    ExecutiveActionSchema,
    data,
    {
      id: '',
      type: 'executive' as const,
      title: 'Unknown Action',
      description: '',
      enabled: false,
      priority: 'medium' as const,
      category: 'governance' as const,
      createdAt: Date.now(),
      urgency: 'medium' as const,
      estimatedImpact: { timeframe: 'unknown' },
      requirements: [],
    }
  ),
  
  quickAction: (data: unknown) => validateWithFallback(
    QuickActionSchema,
    data,
    {
      id: '',
      type: 'quick' as const,
      title: 'Unknown Action',
      description: '',
      enabled: false,
      priority: 'medium' as const,
      category: 'governance' as const,
      createdAt: Date.now(),
      icon: { name: 'Zap', variant: 'outline' as const },
      estimatedTime: '0 min',
      impact: 'medium' as const,
    }
  ),
  
  intelligenceItem: (data: unknown) => validateWithFallback(
    IntelligenceItemSchema,
    data,
    {
      id: '',
      type: 'update' as const,
      title: 'Unknown Intelligence',
      description: '',
      category: 'governance' as const,
      severity: 'medium' as const,
      source: 'system',
      confidence: 80,
      actionable: false,
      timestamp: Date.now(),
      createdAt: Date.now(),
      priority: 'medium' as const,
      content: '',
      relatedCountries: [],
    }
  ),
  
  country: (data: unknown) => validateWithFallback(
    CountryDataSchema,
    data,
    {
      id: '',
      name: 'Unknown Country',
      currentPopulation: 0,
      currentGdpPerCapita: 0,
      currentTotalGdp: 0,
      economicTier: 'Developing',
      populationTier: 'Small',
      adjustedGdpGrowth: 0,
      populationGrowthRate: 0,
      lastCalculated: new Date(),
      realGDPGrowthRate: 0,
    }
  ),
  
  array: validateArray,
};

// Schema exports for reuse
export const schemas = {
  ExecutiveActionSchema,
  QuickActionSchema,
  IntelligenceItemSchema,
  CountryDataSchema,
  StandardPrioritySchema,
  StandardCategorySchema,
};