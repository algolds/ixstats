// WebSocket Intelligence System Types
// Type definitions for real-time intelligence updates

export interface IntelligenceUpdate {
  id: string;
  type:
    | "new_intelligence"
    | "vitality_update"
    | "alert"
    | "system_update"
    | "economic_change"
    | "cache-invalidation";
  title: string;
  description?: string;
  countryId?: string;
  category: "economic" | "population" | "diplomatic" | "governance" | "security" | "system";
  priority: "low" | "medium" | "high" | "urgent" | "critical";
  severity: "info" | "warning" | "critical";
  data: any;
  isGlobal: boolean;
  timestamp: number;
  expiresAt?: number;
}

export interface CountryIntelligenceChannel {
  countryId: string;
  subscriberCount: number;
  lastActivity: number;
  activeAlerts: number;
}

export interface GlobalIntelligenceChannel {
  subscriberCount: number;
  lastActivity: number;
  totalUpdates: number;
}

export interface WebSocketIntelligenceEvent {
  type: "intelligence:update" | "intelligence:alert" | "intelligence:initial" | "vitality:update";
  data: any;
  timestamp: number;
  channel: string;
  countryId?: string;
}

export interface WebSocketClientState {
  connected: boolean;
  authenticated: boolean;
  subscriptions: Set<string>;
  lastHeartbeat: number;
  connectionId?: string;
  userId?: string;
  countryId?: string;
}

export interface IntelligenceWebSocketHookOptions {
  countryId?: string;
  autoReconnect?: boolean;
  heartbeatInterval?: number;
  subscribeToGlobal?: boolean;
  subscribeToAlerts?: boolean;
  onUpdate?: (update: IntelligenceUpdate) => void;
  onAlert?: (alert: IntelligenceUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}
