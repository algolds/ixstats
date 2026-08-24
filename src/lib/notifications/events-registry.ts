export interface NotificationEventEntry {
  eventKey: string;
  name: string;
  description: string;
  category: string;
  source: string;
  triggerType: string;
  defaultEnabled: boolean;
}

export const NOTIFICATION_EVENTS: NotificationEventEntry[] = [
  {
    eventKey: "onEconomicDataChange",
    name: "Economic Data Change",
    description:
      "Monitors economic metrics and triggers on significant changes exceeding configured threshold",
    category: "economic",
    source: "economic-engine",
    triggerType: "data-change",
    defaultEnabled: true,
  },
  {
    eventKey: "onEconomicCalculation",
    name: "Economic Calculation Complete",
    description: "Triggers when major economic calculations complete (GDP, growth, forecasts)",
    category: "economic",
    source: "economic-engine",
    triggerType: "data-change",
    defaultEnabled: true,
  },
  {
    eventKey: "onBudgetAlert",
    name: "Budget Alert",
    description:
      "Triggers for budget-related events: deficit, surplus, overspending, underspending",
    category: "economic",
    source: "economic-engine",
    triggerType: "threshold",
    defaultEnabled: true,
  },
  {
    eventKey: "onTaxSystemChange",
    name: "Tax System Change",
    description: "Triggers when tax system is updated or changes significantly",
    category: "economic",
    source: "economic-engine",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onTierTransition",
    name: "Tier Transition",
    description: "Triggers when a country transitions between economic or population tiers",
    category: "economic",
    source: "economic-engine",
    triggerType: "threshold",
    defaultEnabled: true,
  },
  {
    eventKey: "onTradeEvent",
    name: "Trade Event",
    description:
      "Triggers for trade-related events: new partner, increase, decrease, embargo, agreement",
    category: "economic",
    source: "diplomacy",
    triggerType: "data-change",
    defaultEnabled: true,
  },
  {
    eventKey: "onDiplomaticEvent",
    name: "Diplomatic Event",
    description:
      "Triggers for diplomatic activities: treaties, agreements, missions, conflicts, resolutions",
    category: "diplomatic",
    source: "diplomacy",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onSecurityEvent",
    name: "Security Event",
    description:
      "Triggers when security events occur: terrorism, insurgency, cyber attacks, civil unrest",
    category: "security",
    source: "security-engine",
    triggerType: "pattern",
    defaultEnabled: true,
  },
  {
    eventKey: "onDefenseEvent",
    name: "Defense Event",
    description:
      "Triggers for defense-related events: unit created/lost, readiness change, doctrine change",
    category: "security",
    source: "military",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onIntelligenceAlert",
    name: "Intelligence Alert",
    description: "Triggers for intelligence alerts: threats, opportunities, trends, anomalies",
    category: "intelligence",
    source: "intelligence",
    triggerType: "pattern",
    defaultEnabled: true,
  },
  {
    eventKey: "sdAlert",
    name: "Intelligence Alert Threshold",
    description: "Triggers when intelligence alert thresholds are crossed for monitored metrics",
    category: "intelligence",
    source: "intelligence",
    triggerType: "threshold",
    defaultEnabled: true,
  },
  {
    eventKey: "onCrisisDetected",
    name: "Crisis Detection",
    description: "Triggers for crisis situations across all severity levels",
    category: "crisis",
    source: "crisis-system",
    triggerType: "pattern",
    defaultEnabled: true,
  },
  {
    eventKey: "crisisAlert",
    name: "System Crisis Alert",
    description: "System-generated crisis notifications from the NotificationAPI service",
    category: "crisis",
    source: "crisis-system",
    triggerType: "pattern",
    defaultEnabled: true,
  },
  {
    eventKey: "onPolicyChange",
    name: "Policy Change",
    description: "Triggers when government policies are enacted, modified, or repealed",
    category: "governance",
    source: "government",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onGovernmentStructureChange",
    name: "Government Structure Change",
    description: "Triggers when government components or effectiveness changes",
    category: "governance",
    source: "government",
    triggerType: "data-change",
    defaultEnabled: true,
  },
  {
    eventKey: "onQuickActionComplete",
    name: "Quick Action Complete",
    description: "Triggers when quick actions complete, fail, or are scheduled",
    category: "governance",
    source: "quick-actions",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onMeetingEvent",
    name: "Meeting Event",
    description: "Triggers for meeting lifecycle: scheduled, starting, ended, cancelled",
    category: "governance",
    source: "meetings",
    triggerType: "scheduled",
    defaultEnabled: true,
  },
  {
    eventKey: "onVitalityScoreChange",
    name: "Vitality Score Change",
    description: "Triggers when national health scores change significantly across any dimension",
    category: "governance",
    source: "vitality",
    triggerType: "data-change",
    defaultEnabled: true,
  },
  {
    eventKey: "onAchievementUnlock",
    name: "Achievement Unlock",
    description: "Triggers when users unlock achievements",
    category: "achievement",
    source: "achievements",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "achievementUnlocked",
    name: "Achievement Notification (API)",
    description: "System achievement notifications via the NotificationAPI service",
    category: "achievement",
    source: "achievements",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onThinkPageActivity",
    name: "ThinkPage Activity",
    description: "Triggers for ThinkPages interactions: created, updated, commented, liked, shared",
    category: "social",
    source: "thinkpages",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onSocialActivity",
    name: "Social Activity",
    description: "Triggers for social platform: follows, mentions, shares, collaboration invites",
    category: "social",
    source: "social",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onThinktankActivity",
    name: "ThinkTank Activity",
    description:
      "Triggers for ThinkTank group activities: invites, messages, documents, member changes",
    category: "social",
    source: "thinktank",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onActivityRingGoal",
    name: "Activity Ring Goal",
    description: "Triggers when activity ring goals are completed across any dimension",
    category: "social",
    source: "activity",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onUserAccountChange",
    name: "User Account Change",
    description:
      "Triggers for user account events: country assignment, role change, profile verified",
    category: "system",
    source: "user-system",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "onAdminAction",
    name: "Admin Action",
    description:
      "Triggers for administrative interventions: announcements, interventions, warnings, maintenance",
    category: "system",
    source: "admin",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "manualNotification",
    name: "Manual Notification",
    description: "Admin manually sends a notification from the admin panel",
    category: "system",
    source: "admin",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "globalAnnouncement",
    name: "Global Announcement",
    description: "System-wide announcements sent to all users",
    category: "system",
    source: "admin",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "systemNotification",
    name: "System Notification",
    description: "General system-generated notifications and alerts",
    category: "system",
    source: "system",
    triggerType: "system",
    defaultEnabled: true,
  },
  {
    eventKey: "securityEventAlert",
    name: "Security Event Alert",
    description: "Triggers when security events are detected from event generators",
    category: "security",
    source: "security-engine",
    triggerType: "pattern",
    defaultEnabled: true,
  },
  {
    eventKey: "onEconomicDataThreshold",
    name: "Economic Data Threshold",
    description: "Triggers when economic metrics cross predefined thresholds",
    category: "economic",
    source: "economic-engine",
    triggerType: "threshold",
    defaultEnabled: true,
  },
  {
    eventKey: "diplomaticEvent",
    name: "Diplomatic Event (API)",
    description: "System diplomatic event notifications via the NotificationAPI service",
    category: "diplomatic",
    source: "diplomacy",
    triggerType: "user-action",
    defaultEnabled: true,
  },
  {
    eventKey: "meetingActivity",
    name: "Meeting Activity (API)",
    description: "System meeting notifications via the NotificationAPI service",
    category: "governance",
    source: "meetings",
    triggerType: "scheduled",
    defaultEnabled: true,
  },
  {
    eventKey: "thinkpageActivity",
    name: "ThinkPage Activity (API)",
    description: "System ThinkPage notifications via the NotificationAPI service",
    category: "social",
    source: "thinkpages",
    triggerType: "user-action",
    defaultEnabled: true,
  },
];

export const NOTIFICATION_CATEGORIES = Array.from(
  new Set(NOTIFICATION_EVENTS.map((e) => e.category))
).sort();

export const NOTIFICATION_SOURCES = Array.from(
  new Set(NOTIFICATION_EVENTS.map((e) => e.source))
).sort();

export const NOTIFICATION_TRIGGER_TYPES = Array.from(
  new Set(NOTIFICATION_EVENTS.map((e) => e.triggerType))
).sort();

export const CATEGORY_ORDER: Record<string, number> = {
  economic: 0,
  diplomatic: 1,
  governance: 2,
  social: 3,
  security: 4,
  intelligence: 5,
  crisis: 6,
  achievement: 7,
  system: 8,
};

export function getEventsByCategory(category?: string): NotificationEventEntry[] {
  if (category) return NOTIFICATION_EVENTS.filter((e) => e.category === category);
  return NOTIFICATION_EVENTS;
}

export function getEventsBySource(source?: string): NotificationEventEntry[] {
  if (source) return NOTIFICATION_EVENTS.filter((e) => e.source === source);
  return NOTIFICATION_EVENTS;
}

export function getEventsByTriggerType(triggerType?: string): NotificationEventEntry[] {
  if (triggerType) return NOTIFICATION_EVENTS.filter((e) => e.triggerType === triggerType);
  return NOTIFICATION_EVENTS;
}
