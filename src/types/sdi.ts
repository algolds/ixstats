// src/types/sdi.ts
// Sovereign Digital Interface Type Definitions

export interface IntelligenceItem {
  id: string;
  title: string;
  content: string;
  category: 'economic' | 'crisis' | 'diplomatic' | 'security' | 'technology' | 'environment';
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: Date;
  region?: string;
  affectedCountries?: string[];
  isActive: boolean;
}

export interface CrisisEvent {
  id: string;
  type: 'natural_disaster' | 'economic_crisis' | 'political_crisis' | 'security_threat' | 'pandemic' | 'environmental';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  affectedCountries: string[];
  casualties: number;
  economicImpact: number;
  status: 'coordinating' | 'monitoring' | 'deployed' | 'standby' | 'resolved';
  responseStatus: 'coordinating' | 'monitoring' | 'deployed' | 'standby' | 'resolved';
  timestamp: Date;
  description: string;
  location?: string;
  coordinates?: { lat: number; lng: number };
}

export interface ResponseTeam {
  id: string;
  name: string;
  status: 'deployed' | 'standby' | 'monitoring' | 'returning';
  location: string;
  capabilities: string[];
  personnel: number;
  equipment?: string[];
  estimatedArrival?: Date;
}

export interface EconomicIndicator {
  globalGDP: number;
  globalGrowth: number;
  inflationRate: number;
  unemploymentRate: number;
  tradeVolume: number;
  currencyVolatility: number;
  timestamp: Date;
}

export interface CommodityPrice {
  name: string;
  price: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  unit: string;
  timestamp: Date;
}

export interface EconomicAlert {
  id: string;
  type: 'market_volatility' | 'trade_disruption' | 'currency_crisis' | 'supply_chain' | 'sanctions';
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: Date;
  affectedRegions?: string[];
  economicImpact?: number;
}

export interface DiplomaticRelation {
  id: string;
  country1: string;
  country2: string;
  relationship: 'alliance' | 'neutral' | 'tension' | 'conflict' | 'partnership';
  strength: number; // 0-100
  treaties: string[];
  lastContact: Date;
  status: 'active' | 'monitoring' | 'dormant' | 'hostile';
  diplomaticChannels: string[];
  tradeVolume?: number;
  culturalExchange?: boolean;
}

export interface Treaty {
  id: string;
  name: string;
  parties: string[];
  type: 'economic' | 'military' | 'cultural' | 'environmental' | 'scientific' | 'security';
  status: 'active' | 'pending' | 'expired' | 'suspended';
  signedDate: Date;
  expiryDate: Date;
  description?: string;
  terms?: string[];
  complianceRate?: number;
}

export interface DiplomaticEvent {
  id: string;
  type: 'summit' | 'negotiation' | 'signing' | 'protest' | 'mediation' | 'conference';
  title: string;
  participants: string[];
  date: Date;
  status: 'scheduled' | 'preparing' | 'ongoing' | 'completed' | 'cancelled';
  location?: string;
  agenda?: string[];
  outcomes?: string[];
}

export interface SDIModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  isActive: boolean;
  requiresAuth: boolean;
  permissions?: string[];
  dataRefreshInterval?: number;
}

export interface SDIAlert {
  id: string;
  type: 'intelligence' | 'crisis' | 'economic' | 'diplomatic' | 'security';
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  isRead: boolean;
  actionRequired: boolean;
  actionUrl?: string;
}

export interface SDIUser {
  id: string;
  username: string;
  role: 'observer' | 'analyst' | 'coordinator' | 'administrator';
  permissions: string[];
  lastActive: Date;
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    notifications: boolean;
    autoRefresh: boolean;
    defaultModule: string;
  };
}

export interface SDISystemStatus {
  timestamp: Date;
  activeUsers: number;
  activeCrises: number;
  intelligenceItems: number;
  diplomaticEvents: number;
  systemHealth: 'operational' | 'degraded' | 'maintenance';
  uptime: number;
  lastBackup: Date;
}

export interface SDIConfiguration {
  modules: SDIModule[];
  refreshIntervals: {
    intelligence: number;
    crisis: number;
    economic: number;
    diplomatic: number;
  };
  alerts: {
    enabled: boolean;
    soundEnabled: boolean;
    desktopNotifications: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    compactMode: boolean;
    showTimestamps: boolean;
    timezone: string;
  };
}

// Utility types
export type IntelligenceCategory = IntelligenceItem['category'];
export type CrisisType = CrisisEvent['type'];
export type DiplomaticRelationshipType = DiplomaticRelation['relationship'];
export type TreatyType = Treaty['type'];
export type AlertPriority = 'low' | 'medium' | 'high' | 'critical';

// API Response types
export interface SDIApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
  version: string;
}

export interface SDIPaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Real-time update types
export type SDIUpdateData = IntelligenceItem | CrisisEvent | DiplomaticRelation | Treaty | null;

export interface SDIRealTimeUpdate {
  type: 'intelligence' | 'crisis' | 'economic' | 'diplomatic' | 'system';
  action: 'create' | 'update' | 'delete';
  data: SDIUpdateData;
  timestamp: Date;
  userId?: string;
}

// Filter and search types
export interface SDIFilterOptions {
  categories?: IntelligenceCategory[];
  priorities?: AlertPriority[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  regions?: string[];
  countries?: string[];
  sources?: string[];
}

export interface SDISearchOptions {
  query: string;
  filters: SDIFilterOptions;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
} 