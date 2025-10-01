import type { ExecutiveAction, QuickAction, NotificationAction } from '~/types/actions';
import type { IntelligenceItem, IntelligenceMetric } from '~/types/intelligence-unified';
import type { StandardPriority, StandardCategory, StandardTrend, IconReference } from '~/types/base';

// Category to icon mapping
const CATEGORY_ICONS: Record<string, string> = {
  'economic': 'TrendingUp',
  'diplomatic': 'Globe', 
  'social': 'Users',
  'governance': 'Shield',
  'security': 'Lock',
  'infrastructure': 'Building',
  'emergency': 'AlertTriangle'
};

// Urgency to impact mapping
const URGENCY_TO_IMPACT: Record<string, StandardPriority> = {
  'critical': 'critical',
  'high': 'high', 
  'medium': 'medium',
  'low': 'low'
};

// Transform legacy ExecutiveAction to unified ExecutiveAction first, then to QuickAction
export const adaptLegacyExecutiveAction = (legacyAction: Record<string, unknown>): ExecutiveAction => ({
  id: legacyAction.id,
  type: 'executive',
  title: legacyAction.title,
  description: legacyAction.description,
  category: normalizeCategory(legacyAction.category),
  enabled: legacyAction.enabled,
  priority: normalizePriority(legacyAction.urgency || 'medium'), // Map urgency to priority
  createdAt: Date.now(), // Default timestamp
  updatedAt: Date.now(),
  urgency: normalizePriority(legacyAction.urgency || 'medium'),
  estimatedImpact: legacyAction.estimatedImpact || { timeframe: 'unknown' },
  requirements: legacyAction.requirements || [],
  cooldownHours: legacyAction.cooldownHours,
  cost: legacyAction.cost,
  risks: legacyAction.risks
});

// Transform ExecutiveAction to QuickAction (fixes major type error)
export const adaptExecutiveToQuick = (action: Record<string, unknown>): QuickAction => {
  // First convert legacy format to unified format if needed
  const unifiedAction = action.type ? action : adaptLegacyExecutiveAction(action);
  
  return {
    id: unifiedAction.id,
    type: 'quick',
    title: unifiedAction.title,
    description: unifiedAction.description,
    category: unifiedAction.category,
    enabled: unifiedAction.enabled,
    priority: unifiedAction.priority,
    createdAt: unifiedAction.createdAt,
    updatedAt: unifiedAction.updatedAt,
    icon: {
      name: CATEGORY_ICONS[unifiedAction.category] || 'Zap',
      variant: 'outline' as const
    },
    estimatedTime: calculateEstimatedTime(unifiedAction),
    impact: unifiedAction.priority,  // Direct mapping since both use StandardPriority
    urgency: unifiedAction.urgency || unifiedAction.priority  // Backward compatibility
  };
};

// Calculate estimated time based on action complexity
const calculateEstimatedTime = (action: ExecutiveAction): string => {
  const baseTime = action.requirements.length * 10; // 10 min per requirement
  const urgencyMultiplier = action.urgency === 'critical' ? 0.5 : 
                           action.urgency === 'high' ? 0.75 : 1;
  const totalMinutes = Math.ceil(baseTime * urgencyMultiplier);
  
  if (totalMinutes < 60) return `${totalMinutes} min`;
  if (totalMinutes < 1440) return `${Math.ceil(totalMinutes / 60)} hr`;
  return `${Math.ceil(totalMinutes / 1440)} day`;
};

// Transform legacy IntelligenceItem variants to unified format with backward compatibility
export const unifyIntelligenceItem = (item: Record<string, unknown>): IntelligenceItem & { 
  // Backward compatibility properties
  priority?: string;
  content?: string;
  relatedCountries?: string[];
} => ({
  id: item.id,
  type: item.type || 'update',
  title: item.title,
  description: item.description || item.message || item.content,
  category: normalizeCategory(item.category),
  severity: normalizePriority(item.severity || item.priority || item.urgency),
  source: item.source || 'system',
  confidence: item.confidence || 80,
  actionable: Boolean(item.actionable),
  timestamp: normalizeTimestamp(item.timestamp || item.createdAt),
  createdAt: normalizeTimestamp(item.createdAt || item.timestamp),
  affectedRegions: item.affectedRegions || (item.affectedCountries ? item.affectedCountries.split(',') : []),
  relatedItems: item.relatedItems,
  tags: item.tags,
  metrics: item.metrics?.map(unifyMetric) || [],
  
  // Backward compatibility mappings
  priority: normalizePriority(item.severity || item.priority || item.urgency),
  content: item.description || item.message || item.content,
  relatedCountries: item.affectedRegions || (typeof item.affectedCountries === 'string' ? item.affectedCountries.split(',') : [])
});

// Normalize timestamp to Unix timestamp
const normalizeTimestamp = (timestamp: unknown): number => {
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  return Date.now();
};

// Normalize category to StandardCategory
const normalizeCategory = (category: unknown): StandardCategory => {
  const normalized = String(category).toLowerCase();
  if (['economic', 'economy'].includes(normalized)) return 'economic';
  if (['diplomatic', 'diplomacy', 'foreign'].includes(normalized)) return 'diplomatic';  
  if (['social', 'population', 'welfare'].includes(normalized)) return 'social';
  if (['governance', 'government', 'admin'].includes(normalized)) return 'governance';
  if (['security', 'defense', 'military'].includes(normalized)) return 'security';
  if (['infrastructure', 'public works'].includes(normalized)) return 'infrastructure';
  return 'governance'; // default fallback
};

// Normalize priority/severity to StandardPriority
const normalizePriority = (priority: unknown): StandardPriority => {
  const normalized = String(priority).toLowerCase();
  if (['critical', 'urgent'].includes(normalized)) return 'critical';
  if (['high', 'important'].includes(normalized)) return 'high';
  if (['medium', 'moderate', 'normal'].includes(normalized)) return 'medium';
  return 'low';
};

// Unify metric interface
const unifyMetric = (metric: Record<string, unknown>): IntelligenceMetric => ({
  id: (metric.id as string) || `metric-${Date.now()}-${Math.random()}`,
  label: String(metric.label || ''),
  value: Number(metric.value || 0),
  unit: metric.unit as string | undefined,
  trend: (metric.trend as StandardTrend) || 'stable',
  changeValue: Number(metric.changeValue || 0),
  changePercent: Number(metric.changePercent || 0),
  changePeriod: String(metric.changePeriod || 'current'),
  status: (metric.status as 'critical' | 'concerning' | 'good' | 'excellent') || 'good',
  rank: metric.rank as { global: number; regional: number; total: number } | undefined,
  target: metric.target as { value: number; achieved: boolean; timeToTarget?: string } | undefined,
  createdAt: normalizeTimestamp(metric.createdAt),
  updatedAt: metric.updatedAt ? normalizeTimestamp(metric.updatedAt) : undefined
});

// Transform database entities to interface types (for Prisma → TypeScript)
export const adaptDatabaseToInterface = <T>(dbEntity: Record<string, unknown>): T => {
  // Use the new enum-aware adapter
  const { adaptDatabaseEntityWithEnums } = require('./database-adapters');
  return adaptDatabaseEntityWithEnums({
    ...dbEntity,
    // Handle specific field mappings
    flag: dbEntity.flag || undefined,
    // Normalize lastCalculated to string format for compatibility
    lastCalculated: dbEntity.lastCalculated ? (
      dbEntity.lastCalculated instanceof Date ? 
        dbEntity.lastCalculated.toISOString() :
        typeof dbEntity.lastCalculated === 'number' ?
          new Date(dbEntity.lastCalculated).toISOString() :
          dbEntity.lastCalculated
    ) : undefined,
  });
};

// Comprehensive timestamp normalization utilities
export const normalizeToUnixTimestamp = (timestamp: any): number => {
  if (typeof timestamp === 'number') return timestamp;
  if (timestamp instanceof Date) return timestamp.getTime();
  if (typeof timestamp === 'string') return new Date(timestamp).getTime();
  return Date.now();
};

export const normalizeToISOString = (timestamp: any): string => {
  if (typeof timestamp === 'string' && timestamp.includes('T')) return timestamp; // Already ISO
  if (timestamp instanceof Date) return timestamp.toISOString();
  if (typeof timestamp === 'number') return new Date(timestamp).toISOString();
  return new Date().toISOString();
};

// Enhanced country data transformer for social profile compatibility
export const adaptCountryForSocialProfile = (country: Record<string, unknown>): Record<string, unknown> => ({
  ...country,
  lastCalculated: normalizeToISOString(country.lastCalculated),
  baselineDate: normalizeToISOString(country.baselineDate || country.createdAt),
  // Fix null vs undefined issues
  realGDPGrowthRate: country.realGDPGrowthRate ?? 0,
  // Ensure numeric types are not null
  landArea: country.landArea ?? undefined,
  populationDensity: country.populationDensity ?? undefined,
  // Normalize flag URL
  flagUrl: country.flag || country.flagUrl || undefined
});