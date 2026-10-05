interface NotificationEventEntry {
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
    eventKey: "budgetYearNotification",
    name: "New Budget Year",
    description:
      "Once per new IxTime year, asks each country owner to set the new year's budget (the previous budget stays in effect until then)",
    category: "economic",
    source: "budget-year-rollover",
    triggerType: "scheduled",
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
    eventKey: "realmsNotification",
    name: "Realm Notices",
    description: "Tells a player their realm nation claim was rejected, and why",
    category: "system",
    source: "realms",
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
];

export const NOTIFICATION_CATEGORIES = Array.from(
  new Set(NOTIFICATION_EVENTS.map((e) => e.category))
).sort();
export const NOTIFICATION_TRIGGER_TYPES = Array.from(
  new Set(NOTIFICATION_EVENTS.map((e) => e.triggerType))
).sort();

export const CATEGORY_ORDER: Record<string, number> = {
  economic: 0,
  diplomatic: 1,
  governance: 2,
  social: 3,
  achievement: 4,
  system: 5,
};
