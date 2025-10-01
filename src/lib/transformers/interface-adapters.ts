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

// Helper type guards
const isString = (value: unknown): value is string => typeof value === 'string';
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isNumber = (value: unknown): value is number => typeof value === 'number';
const isArray = (value: unknown): value is unknown[] => Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

// Transform legacy ExecutiveAction to unified ExecutiveAction first, then to QuickAction
export const adaptLegacyExecutiveAction = (legacyAction: Record<string, unknown>): ExecutiveAction => ({
  id: isString(legacyAction.id) ? legacyAction.id : `action-${Date.now()}`,
  type: 'executive',
  title: isString(legacyAction.title) ? legacyAction.title : 'Unknown Action',
  description: isString(legacyAction.description) ? legacyAction.description : '',
  category: normalizeCategory(legacyAction.category),
  enabled: isBoolean(legacyAction.enabled) ? legacyAction.enabled : true,
  priority: normalizePriority(legacyAction.urgency || 'medium'), // Map urgency to priority
  createdAt: Date.now(), // Default timestamp
  updatedAt: Date.now(),
  urgency: normalizePriority(legacyAction.urgency || 'medium'),
  estimatedImpact: legacyAction.estimatedImpact as any || { timeframe: 'unknown' },
  requirements: isStringArray(legacyAction.requirements) ? legacyAction.requirements : [],
  cooldownHours: isNumber(legacyAction.cooldownHours) ? legacyAction.cooldownHours : undefined,
  cost: legacyAction.cost as any,
  risks: isStringArray(legacyAction.risks) ? legacyAction.risks : undefined
});

// Transform ExecutiveAction to QuickAction (fixes major type error)
export const adaptExecutiveToQuick = (action: Record<string, unknown> | ExecutiveAction): QuickAction => {
  // First convert legacy format to unified format if needed
  const unifiedAction = action.type ? action as ExecutiveAction : adaptLegacyExecutiveAction(action as Record<string, unknown>);

  return {
    id: isString(unifiedAction.id) ? unifiedAction.id : `quick-${Date.now()}`,
    type: 'quick',
    title: isString(unifiedAction.title) ? unifiedAction.title : 'Unknown',
    description: isString(unifiedAction.description) ? unifiedAction.description : '',
    category: normalizeCategory(unifiedAction.category),
    enabled: isBoolean(unifiedAction.enabled) ? unifiedAction.enabled : true,
    priority: normalizePriority(unifiedAction.priority),
    createdAt: isNumber(unifiedAction.createdAt) ? unifiedAction.createdAt : Date.now(),
    updatedAt: isNumber(unifiedAction.updatedAt) ? unifiedAction.updatedAt : Date.now(),
    icon: {
      name: CATEGORY_ICONS[String(unifiedAction.category)] || 'Zap',
      variant: 'outline' as const
    },
    estimatedTime: calculateEstimatedTime(unifiedAction),
    impact: normalizePriority(unifiedAction.priority),  // Direct mapping since both use StandardPriority
    urgency: normalizePriority(unifiedAction.urgency) || normalizePriority(unifiedAction.priority)  // Backward compatibility
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
  id: isString(item.id) ? item.id : `intel-${Date.now()}`,
  type: isString(item.type) ? item.type as any : 'update',
  title: isString(item.title) ? item.title : 'Unknown',
  description: isString(item.description) ? item.description : isString(item.message) ? item.message : isString(item.content) ? item.content : '',
  category: normalizeCategory(item.category),
  severity: normalizePriority(item.severity || item.priority || item.urgency),
  source: isString(item.source) ? item.source : 'system',
  confidence: isNumber(item.confidence) ? item.confidence : 80,
  actionable: Boolean(item.actionable),
  timestamp: normalizeTimestamp(item.timestamp || item.createdAt),
  createdAt: normalizeTimestamp(item.createdAt || item.timestamp),
  affectedRegions: isStringArray(item.affectedRegions) ? item.affectedRegions : (typeof item.affectedCountries === 'string' ? item.affectedCountries.split(',') : []),
  relatedItems: isStringArray(item.relatedItems) ? item.relatedItems : undefined,
  tags: isStringArray(item.tags) ? item.tags : undefined,
  metrics: isArray(item.metrics) ? item.metrics.map((m: any) => unifyMetric(m)) : [],

  // Backward compatibility mappings
  priority: normalizePriority(item.severity || item.priority || item.urgency),
  content: isString(item.description) ? item.description : isString(item.message) ? item.message : isString(item.content) ? item.content : '',
  relatedCountries: isStringArray(item.affectedRegions) ? item.affectedRegions : (typeof item.affectedCountries === 'string' ? item.affectedCountries.split(',') : [])
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