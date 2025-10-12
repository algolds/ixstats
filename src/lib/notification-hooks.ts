/**
 * Notification Hooks for Platform Features
 * Auto-wiring notifications into existing functionality
 */

import { notificationAPI } from './notification-api';

/**
 * Economic Data Change Hook
 * Monitors economic metrics and triggers notifications on significant changes
 */
export async function onEconomicDataChange(params: {
  countryId: string;
  metric: string;
  currentValue: number;
  previousValue: number;
  threshold?: number;
}) {
  const { countryId, metric, currentValue, previousValue, threshold = 10 } = params;

  const change = ((currentValue - previousValue) / previousValue) * 100;

  // Only notify if change exceeds threshold
  if (Math.abs(change) >= threshold) {
    await notificationAPI.notifyEconomicChange({
      metric,
      value: currentValue,
      previousValue,
      countryId,
      threshold,
    });
  }
}

/**
 * ThinkPages Activity Hook
 * Triggers notifications for ThinkPages interactions
 */
export async function onThinkPageActivity(params: {
  thinkpageId: string;
  title: string;
  action: 'created' | 'updated' | 'commented' | 'liked' | 'shared';
  authorId: string;
  authorName?: string;
  targetUserId?: string;
}) {
  await notificationAPI.notifyThinkPageActivity({
    thinkpageId: params.thinkpageId,
    title: params.title,
    action: params.action,
    authorId: params.authorId,
    targetUserId: params.targetUserId,
  });
}

/**
 * Meeting Event Hook
 * Triggers notifications for meeting lifecycle events
 */
export async function onMeetingEvent(params: {
  meetingId: string;
  title: string;
  scheduledTime: Date;
  participants: string[];
  action: 'scheduled' | 'starting' | 'ended' | 'cancelled';
  minutesUntilStart?: number;
}) {
  await notificationAPI.notifyMeetingEvent({
    meetingId: params.meetingId,
    title: params.title,
    scheduledTime: params.scheduledTime,
    participants: params.participants,
    action: params.action,
  });

  // Schedule reminder notifications for upcoming meetings
  if (params.action === 'scheduled' && params.minutesUntilStart) {
    // Could integrate with a job scheduler here
    console.log(`[NotificationHooks] Meeting reminder scheduled for ${params.minutesUntilStart} minutes before start`);
  }
}

/**
 * Diplomatic Event Hook
 * Triggers notifications for diplomatic activities
 */
export async function onDiplomaticEvent(params: {
  eventType: 'treaty' | 'agreement' | 'mission' | 'conflict' | 'resolution';
  title: string;
  countries: string[];
  description?: string;
  affectedUserIds?: string[];
}) {
  await notificationAPI.trigger({
    diplomatic: {
      eventType: params.eventType,
      countries: params.countries,
      title: params.title,
    },
  });

  // Notify specific users if provided
  if (params.affectedUserIds && params.affectedUserIds.length > 0) {
    for (const userId of params.affectedUserIds) {
      await notificationAPI.create({
        title: params.title,
        message: params.description || `Diplomatic ${params.eventType} event`,
        userId,
        category: 'diplomatic',
        priority: params.eventType === 'conflict' ? 'high' : 'medium',
        href: '/diplomatic',
        actionable: true,
      });
    }
  }
}

/**
 * Achievement Unlock Hook
 * Triggers notifications when users unlock achievements
 */
export async function onAchievementUnlock(params: {
  userId: string;
  achievementId: string;
  name: string;
  description: string;
  category: string;
  rarity?: 'common' | 'rare' | 'epic' | 'legendary';
}) {
  const rarityEmojis = {
    common: '🥉',
    rare: '🥈',
    epic: '🥇',
    legendary: '💎',
  };

  const emoji = rarityEmojis[params.rarity || 'common'];

  await notificationAPI.trigger({
    achievement: {
      name: `${emoji} ${params.name}`,
      description: params.description,
      category: params.category,
      userId: params.userId,
    },
  });
}

/**
 * Crisis Detection Hook
 * Triggers notifications for crisis situations
 */
export async function onCrisisDetected(params: {
  countryId: string;
  crisisType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedMetrics?: string[];
  recommendedActions?: string[];
}) {
  await notificationAPI.trigger({
    crisis: {
      type: params.crisisType,
      severity: params.severity,
      countryId: params.countryId,
      description: params.description,
    },
  });

  // For critical crises, also notify country leadership directly
  if (params.severity === 'critical') {
    // Could query for country leadership users and notify them directly
    console.log(`[NotificationHooks] Critical crisis detected in country ${params.countryId}`);
  }
}

/**
 * Policy Change Hook
 * Triggers notifications when government policies change
 */
export async function onPolicyChange(params: {
  countryId: string;
  policyName: string;
  changeType: 'enacted' | 'modified' | 'repealed';
  impact: 'major' | 'moderate' | 'minor';
  description: string;
}) {
  const priority = params.impact === 'major' ? 'high' : params.impact === 'moderate' ? 'medium' : 'low';

  await notificationAPI.notifyCountry({
    countryId: params.countryId,
    title: `Policy ${params.changeType}: ${params.policyName}`,
    message: params.description,
    category: 'governance',
    priority,
  });
}

/**
 * Budget Alert Hook
 * Triggers notifications for budget-related events
 */
export async function onBudgetAlert(params: {
  countryId: string;
  alertType: 'deficit' | 'surplus' | 'overspending' | 'underspending';
  amount: number;
  category?: string;
  userId?: string;
}) {
  const alertTitles = {
    deficit: 'Budget Deficit Alert',
    surplus: 'Budget Surplus Detected',
    overspending: 'Department Overspending',
    underspending: 'Budget Underspending',
  };

  const priority = params.alertType === 'deficit' || params.alertType === 'overspending' ? 'high' : 'medium';

  await notificationAPI.create({
    title: alertTitles[params.alertType],
    message: `${params.category || 'Budget'} ${params.alertType}: ${params.amount.toLocaleString()} currency units`,
    userId: params.userId || null,
    countryId: params.countryId,
    category: 'economic',
    priority,
    href: '/mycountry/new?tab=budget',
    actionable: true,
  });
}

/**
 * Defense/Military Event Hook
 * Triggers notifications for defense-related events
 */
export async function onDefenseEvent(params: {
  countryId: string;
  eventType: 'unit_created' | 'unit_lost' | 'readiness_change' | 'doctrine_change';
  title: string;
  description: string;
  severity?: 'low' | 'medium' | 'high';
}) {
  const priority = params.severity === 'high' ? 'high' : params.severity === 'medium' ? 'medium' : 'low';

  await notificationAPI.notifyCountry({
    countryId: params.countryId,
    title: params.title,
    message: params.description,
    category: 'security',
    priority,
  });
}

/**
 * Social Activity Hook
 * Triggers notifications for social platform activities
 */
export async function onSocialActivity(params: {
  activityType: 'follow' | 'mention' | 'share' | 'collaboration_invite';
  fromUserId: string;
  toUserId: string;
  fromUserName?: string;
  contentTitle?: string;
  contentId?: string;
}) {
  const activityMessages = {
    follow: `${params.fromUserName || 'Someone'} started following you`,
    mention: `${params.fromUserName || 'Someone'} mentioned you`,
    share: `${params.fromUserName || 'Someone'} shared your content`,
    collaboration_invite: `${params.fromUserName || 'Someone'} invited you to collaborate`,
  };

  await notificationAPI.create({
    title: activityMessages[params.activityType],
    message: params.contentTitle ? `on "${params.contentTitle}"` : undefined,
    userId: params.toUserId,
    category: 'social',
    priority: 'low',
    href: params.contentId ? `/content/${params.contentId}` : `/profile/${params.fromUserId}`,
    actionable: true,
    metadata: {
      fromUserId: params.fromUserId,
      activityType: params.activityType,
    },
  });
}

/**
 * Intelligence Alert Hook
 * Triggers notifications for intelligence/SDI alerts
 */
export async function onIntelligenceAlert(params: {
  userId?: string;
  countryId?: string;
  alertType: 'threat' | 'opportunity' | 'trend' | 'anomaly';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  confidence: number;
}) {
  const priority = params.severity === 'critical' ? 'critical' : params.severity === 'high' ? 'high' : 'medium';

  await notificationAPI.create({
    title: `Intelligence Alert: ${params.title}`,
    message: params.description,
    userId: params.userId || null,
    countryId: params.countryId || null,
    category: params.alertType === 'threat' ? 'security' : 'opportunity',
    type: params.alertType === 'threat' ? 'warning' : 'info',
    priority,
    severity: params.severity === 'critical' ? 'urgent' : params.severity === 'high' ? 'important' : 'informational',
    href: '/sdi',
    actionable: true,
    metadata: {
      source: params.source,
      confidence: params.confidence,
      alertType: params.alertType,
    },
  });
}

/**
 * Trade Event Hook
 * Triggers notifications for trade-related events
 */
export async function onTradeEvent(params: {
  countryId: string;
  eventType: 'new_partner' | 'trade_increase' | 'trade_decrease' | 'embargo' | 'agreement_signed';
  partnerCountry: string;
  title: string;
  impact: 'positive' | 'negative' | 'neutral';
  value?: number;
}) {
  const priority = params.eventType === 'embargo' ? 'high' : 'medium';
  const type = params.impact === 'positive' ? 'success' : params.impact === 'negative' ? 'warning' : 'info';

  await notificationAPI.notifyCountry({
    countryId: params.countryId,
    title: params.title,
    message: `Trade event with ${params.partnerCountry}${params.value ? `: ${params.value.toLocaleString()} units` : ''}`,
    category: 'economic',
    priority,
  });
}

// Export all hooks
export const notificationHooks = {
  onEconomicDataChange,
  onThinkPageActivity,
  onMeetingEvent,
  onDiplomaticEvent,
  onAchievementUnlock,
  onCrisisDetected,
  onPolicyChange,
  onBudgetAlert,
  onDefenseEvent,
  onSocialActivity,
  onIntelligenceAlert,
  onTradeEvent,
};

export default notificationHooks;
