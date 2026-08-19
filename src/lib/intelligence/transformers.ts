import type { StandardPriority, StandardCategory, StandardTrend } from "~/types/base";

export interface UnifiedIntelligenceItem {
  id: string;
  type: string;
  title: string;
  description: string;
  category: StandardCategory;
  priority: StandardPriority;
  trend: StandardTrend;
  confidence: number;
  source: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function unifyIntelligenceItem(rawItem: any): UnifiedIntelligenceItem {
  return {
    id: rawItem.id || `intel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: rawItem.type || "general",
    title: rawItem.title || rawItem.headline || "Untitled Intelligence",
    description: rawItem.description || rawItem.summary || "",
    category: (rawItem.category || "security") as StandardCategory,
    priority: (rawItem.priority || rawItem.urgency || "medium") as StandardPriority,
    trend: (rawItem.trend || "stable") as StandardTrend,
    confidence: typeof rawItem.confidence === "number" ? rawItem.confidence : 85,
    source: rawItem.source || "System Analysis",
    timestamp: rawItem.timestamp
      ? new Date(rawItem.timestamp).toISOString()
      : new Date().toISOString(),
    metadata: rawItem.metadata || undefined,
  };
}
