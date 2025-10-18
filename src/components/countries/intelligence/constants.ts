// Constants for Intelligence Briefing components
// Extracted from EnhancedIntelligenceBriefing.tsx

export const CLASSIFICATION_STYLES = {
  'PUBLIC': {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    label: 'PUBLIC'
  },
  'RESTRICTED': {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    label: 'RESTRICTED'
  },
  'CONFIDENTIAL': {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    label: 'CONFIDENTIAL'
  }
} as const;

export const STATUS_STYLES = {
  'excellent': { color: 'text-green-400', bg: 'bg-green-500/20' },
  'good': { color: 'text-blue-400', bg: 'bg-blue-500/20' },
  'fair': { color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  'poor': { color: 'text-red-400', bg: 'bg-red-500/20' }
} as const;

export const IMPORTANCE_STYLES = {
  'critical': { priority: 4, glow: 'shadow-red-500/20' },
  'high': { priority: 3, glow: 'shadow-orange-500/20' },
  'medium': { priority: 2, glow: 'shadow-blue-500/20' },
  'low': { priority: 1, glow: 'shadow-gray-500/20' }
} as const;

export const TIER_SCORE_MAP: Record<string, number> = {
  "Extravagant": 100,
  "Very Strong": 85,
  "Strong": 70,
  "Healthy": 55,
  "Developed": 40,
  "Developing": 25,
  "Impoverished": 10
};

export const ECONOMIC_TIER_DATA = [
  { name: "Impoverished", min: 0, max: 9999, icon: "📉" },
  { name: "Developing", min: 10000, max: 24999, icon: "📈" },
  { name: "Developed", min: 25000, max: 34999, icon: "🏭" },
  { name: "Healthy", min: 35000, max: 44999, icon: "💰" },
  { name: "Strong", min: 45000, max: 54999, icon: "🚀" },
  { name: "Very Strong", min: 55000, max: 64999, icon: "🌟" },
  { name: "Extravagant", min: 65000, max: Infinity, icon: "👑" }
];

export const POPULATION_TIER_DATA = [
  { tier: 1, name: "Small Nation", min: 0, max: 999999, icon: "🏘️" },
  { tier: 2, name: "Medium Nation", min: 1000000, max: 4999999, icon: "🏙️" },
  { tier: 3, name: "Large Nation", min: 5000000, max: 19999999, icon: "🌆" },
  { tier: 4, name: "Major Nation", min: 20000000, max: 49999999, icon: "🌇" },
  { tier: 5, name: "Great Nation", min: 50000000, max: 99999999, icon: "🗾" },
  { tier: 6, name: "Superpower", min: 100000000, max: Infinity, icon: "🌍" }
];
