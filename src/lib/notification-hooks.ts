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

/**
 * Quick Action Complete Hook
 * Triggers notifications when quick actions (policies, meetings) complete or fail
 */
export async function onQuickActionComplete(params: {
  userId?: string;
  countryId: string;
  actionType: 'policy' | 'meeting' | 'activity' | 'decision';
  actionName: string;
  status: 'completed' | 'failed' | 'scheduled';
  impactSummary?: string;
  errorDetails?: string;
  href?: string;
}) {
  const statusTitles = {
    completed: 'Action Completed Successfully',
    failed: 'Action Failed',
    scheduled: 'Action Scheduled',
  };

  const priority = params.status === 'failed' ? 'high' : params.status === 'completed' ? 'medium' : 'low';
  const type = params.status === 'failed' ? 'error' : params.status === 'completed' ? 'success' : 'info';

  const message = params.status === 'failed' && params.errorDetails
    ? `${params.actionName}: ${params.errorDetails}`
    : params.status === 'completed' && params.impactSummary
    ? `${params.actionName}: ${params.impactSummary}`
    : params.actionName;

  await notificationAPI.create({
    title: statusTitles[params.status],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: 'governance',
    priority,
    type,
    href: params.href || '/mycountry/quickactions',
    actionable: params.status === 'failed',
    metadata: {
      actionType: params.actionType,
      status: params.status,
    },
  });
}

/**
 * Tax System Change Hook
 * Triggers notifications when tax system is updated or changes significantly
 */
export async function onTaxSystemChange(params: {
  userId?: string;
  countryId: string;
  changeType: 'created' | 'updated' | 'revenue_projection_change' | 'effectiveness_change' | 'bracket_change';
  systemName: string;
  previousValue?: number;
  newValue?: number;
  changePercent?: number;
  details?: string;
}) {
  const changeTitles = {
    created: 'Tax System Created',
    updated: 'Tax System Updated',
    revenue_projection_change: 'Revenue Projection Changed',
    effectiveness_change: 'Tax Effectiveness Changed',
    bracket_change: 'Tax Bracket Updated',
  };

  // Determine priority based on change magnitude
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (params.changePercent && Math.abs(params.changePercent) > 20) {
    priority = 'high';
  } else if (params.changePercent && Math.abs(params.changePercent) < 5) {
    priority = 'low';
  }

  const type = params.changePercent && params.changePercent < 0 ? 'warning' : 'info';

  let message = params.systemName;
  if (params.details) {
    message += `: ${params.details}`;
  } else if (params.changePercent !== undefined) {
    const direction = params.changePercent > 0 ? 'increased' : 'decreased';
    message += ` ${direction} by ${Math.abs(params.changePercent).toFixed(1)}%`;
  }

  await notificationAPI.create({
    title: changeTitles[params.changeType],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: 'economic',
    priority,
    type,
    href: '/mycountry/tax-system',
    actionable: params.changeType === 'revenue_projection_change' && Math.abs(params.changePercent || 0) > 10,
    metadata: {
      changeType: params.changeType,
      previousValue: params.previousValue,
      newValue: params.newValue,
      changePercent: params.changePercent,
    },
  });
}

/**
 * Government Structure Change Hook
 * Triggers notifications when government components or effectiveness changes
 */
export async function onGovernmentStructureChange(params: {
  userId?: string;
  countryId: string;
  changeType: 'component_added' | 'component_removed' | 'effectiveness_change' | 'synergy_detected' | 'budget_exceeded';
  componentName?: string;
  effectivenessScore?: number;
  previousScore?: number;
  synergyBonus?: number;
  details?: string;
}) {
  const changeTitles = {
    component_added: 'Government Component Added',
    component_removed: 'Government Component Removed',
    effectiveness_change: 'Government Effectiveness Changed',
    synergy_detected: 'Component Synergy Detected',
    budget_exceeded: 'Department Budget Exceeded',
  };

  // Determine priority
  let priority: 'low' | 'medium' | 'high' = 'medium';
  if (params.changeType === 'budget_exceeded') {
    priority = 'high';
  } else if (params.changeType === 'synergy_detected') {
    priority = 'medium';
  } else if (params.effectivenessScore && params.previousScore) {
    const change = Math.abs(params.effectivenessScore - params.previousScore);
    if (change > 10) priority = 'high';
    else if (change < 5) priority = 'low';
  }

  const type = params.changeType === 'budget_exceeded' ? 'warning' :
    params.changeType === 'synergy_detected' ? 'success' : 'info';

  let message = params.componentName || 'Government structure';
  if (params.details) {
    message += `: ${params.details}`;
  } else if (params.effectivenessScore !== undefined && params.previousScore !== undefined) {
    const change = params.effectivenessScore - params.previousScore;
    const direction = change > 0 ? 'improved' : 'decreased';
    message += ` effectiveness ${direction} by ${Math.abs(change).toFixed(1)} points`;
  } else if (params.synergyBonus) {
    message += ` provides +${params.synergyBonus}% synergy bonus`;
  }

  await notificationAPI.create({
    title: changeTitles[params.changeType],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: 'governance',
    priority,
    type,
    href: '/mycountry/government',
    actionable: params.changeType === 'budget_exceeded' ||
      (params.effectivenessScore !== undefined && params.effectivenessScore < 50),
    metadata: {
      changeType: params.changeType,
      effectivenessScore: params.effectivenessScore,
      previousScore: params.previousScore,
      synergyBonus: params.synergyBonus,
    },
  });
}

/**
 * ThinkTank Activity Hook
 * Triggers notifications for ThinkTank group activities
 */
export async function onThinktankActivity(params: {
  activityType: 'group_invite' | 'new_message' | 'document_created' | 'document_updated' |
                'member_joined' | 'member_left' | 'role_changed' | 'settings_changed';
  groupId: string;
  groupName: string;
  groupType?: 'public' | 'private' | 'invite_only';
  actorUserId: string;
  actorUserName?: string;
  targetUserId?: string;
  targetUserIds?: string[];
  contentTitle?: string;
  contentId?: string;
  metadata?: Record<string, any>;
}) {
  const {
    activityType,
    groupId,
    groupName,
    groupType,
    actorUserId,
    actorUserName,
    targetUserId,
    targetUserIds,
    contentTitle,
    contentId,
    metadata
  } = params;

  // Helper function to create notification for a user
  const createNotificationForUser = async (userId: string, customMessage?: string) => {
    const actorName = actorUserName || 'Someone';

    let title = '';
    let message = customMessage || '';
    let href = `/thinkpages/thinktanks?group=${groupId}`;

    switch (activityType) {
      case 'group_invite':
        title = `Invitation to ${groupName}`;
        message = `${actorName} invited you to join the group`;
        href = `/thinkpages/thinktanks?invite=${groupId}`;
        break;

      case 'new_message':
        title = `New message in ${groupName}`;
        message = contentTitle || `${actorName} posted a message`;
        break;

      case 'document_created':
        title = `New document in ${groupName}`;
        message = contentTitle ? `${actorName} created "${contentTitle}"` : `${actorName} created a new document`;
        href = contentId ? `/thinkpages/thinktanks?group=${groupId}&doc=${contentId}` : href;
        break;

      case 'document_updated':
        title = `Document updated in ${groupName}`;
        message = contentTitle ? `${actorName} updated "${contentTitle}"` : `${actorName} updated a document`;
        href = contentId ? `/thinkpages/thinktanks?group=${groupId}&doc=${contentId}` : href;
        break;

      case 'member_joined':
        title = `New member in ${groupName}`;
        message = `${actorName} joined the group`;
        break;

      case 'member_left':
        title = `Member left ${groupName}`;
        message = `${actorName} left the group`;
        break;

      case 'role_changed':
        title = `Role changed in ${groupName}`;
        message = metadata?.newRole
          ? `You were promoted to ${metadata.newRole}`
          : 'Your role in the group has changed';
        break;

      case 'settings_changed':
        title = `${groupName} settings updated`;
        message = `${actorName} updated the group settings`;
        break;
    }

    await notificationAPI.create({
      title,
      message,
      userId,
      category: 'social',
      type: activityType === 'group_invite' ? 'update' : 'info',
      priority: activityType === 'group_invite' ? 'medium' : 'low',
      href,
      source: 'thinktank',
      actionable: activityType === 'group_invite',
      metadata: {
        groupId,
        groupName,
        groupType,
        activityType,
        fromUserId: actorUserId,
        contentId,
        ...metadata
      }
    });
  };

  // Handle single target user
  if (targetUserId) {
    await createNotificationForUser(targetUserId);
  }

  // Handle multiple target users (bulk notifications)
  if (targetUserIds && targetUserIds.length > 0) {
    // Use Promise.all for parallel execution
    await Promise.all(
      targetUserIds.map(userId => createNotificationForUser(userId))
    );
  }
}

/**
 * User Account Change Hook
 * Triggers notifications for user account events
 */
export async function onUserAccountChange(params: {
  userId: string;
  changeType: 'country_assigned' | 'country_updated' | 'role_changed' | 'profile_verified' | 'settings_updated';
  title: string;
  description: string;
  metadata?: Record<string, any>;
  priority?: 'critical' | 'high' | 'medium' | 'low';
}) {
  const priorityMap = {
    country_assigned: 'high' as const,
    country_updated: 'medium' as const,
    role_changed: 'high' as const,
    profile_verified: 'medium' as const,
    settings_updated: 'low' as const,
  };

  const typeMap = {
    country_assigned: 'success' as const,
    country_updated: 'info' as const,
    role_changed: 'alert' as const,
    profile_verified: 'success' as const,
    settings_updated: 'info' as const,
  };

  await notificationAPI.create({
    title: params.title,
    message: params.description,
    userId: params.userId,
    category: 'system',
    type: typeMap[params.changeType],
    priority: params.priority ?? priorityMap[params.changeType],
    href: params.changeType.startsWith('country') ? '/mycountry/new' : '/settings',
    source: 'user-system',
    actionable: true,
    metadata: {
      changeType: params.changeType,
      ...params.metadata,
    },
  });
}

/**
 * Admin Action Hook
 * Triggers notifications for administrative interventions
 */
export async function onAdminAction(params: {
  actionType: 'global_announcement' | 'user_intervention' | 'data_intervention' | 'system_warning' | 'maintenance';
  title: string;
  description: string;
  affectedUserIds?: string[];
  affectedCountryIds?: string[];
  adminId: string;
  adminName?: string;
  severity: 'urgent' | 'important' | 'informational';
  metadata?: Record<string, any>;
}) {
  const priorityMap = {
    urgent: 'critical' as const,
    important: 'high' as const,
    informational: 'medium' as const,
  };

  const deliveryMap = {
    urgent: 'modal' as const,
    important: 'dynamic-island' as const,
    informational: 'toast' as const,
  };

  // Global announcements go to all users
  if (params.actionType === 'global_announcement') {
    await notificationAPI.notifyGlobal({
      title: params.title,
      message: params.description,
      category: 'system',
      priority: priorityMap[params.severity],
    });
    return;
  }

  // System warnings go to all users with specific delivery method
  if (params.actionType === 'system_warning' || params.actionType === 'maintenance') {
    await notificationAPI.create({
      title: params.title,
      message: params.description,
      userId: null,
      countryId: null,
      category: 'system',
      type: 'warning',
      priority: priorityMap[params.severity],
      severity: params.severity,
      deliveryMethod: deliveryMap[params.severity],
      source: 'admin',
      actionable: true,
      metadata: {
        actionType: params.actionType,
        adminId: params.adminId,
        adminName: params.adminName,
        ...params.metadata,
      },
    });
    return;
  }

  // User/country interventions go to specific targets
  if (params.affectedUserIds && params.affectedUserIds.length > 0) {
    for (const userId of params.affectedUserIds) {
      await notificationAPI.create({
        title: params.title,
        message: params.description,
        userId,
        category: 'system',
        type: 'alert',
        priority: priorityMap[params.severity],
        severity: params.severity,
        href: params.actionType === 'data_intervention' ? '/mycountry/new' : undefined,
        source: 'admin',
        actionable: true,
        metadata: {
          actionType: params.actionType,
          adminId: params.adminId,
          adminName: params.adminName,
          ...params.metadata,
        },
      });
    }
  }

  if (params.affectedCountryIds && params.affectedCountryIds.length > 0) {
    for (const countryId of params.affectedCountryIds) {
      await notificationAPI.create({
        title: params.title,
        message: params.description,
        countryId,
        category: 'system',
        type: 'alert',
        priority: priorityMap[params.severity],
        severity: params.severity,
        href: '/mycountry/new',
        source: 'admin',
        actionable: true,
        metadata: {
          actionType: params.actionType,
          adminId: params.adminId,
          adminName: params.adminName,
          ...params.metadata,
        },
      });
    }
  }
}

/**
 * Economic Calculation Hook
 * Triggers notifications when major economic calculations complete
 */
export async function onEconomicCalculation(params: {
  countryId: string;
  userId?: string;
  calculationType: 'gdp' | 'growth' | 'tier' | 'forecast';
  metric: string;
  currentValue: number;
  previousValue?: number;
  changePercent?: number;
  tierChange?: {
    from: string;
    to: string;
  };
}) {
  const { countryId, userId, calculationType, metric, currentValue, previousValue, changePercent, tierChange } = params;

  // GDP calculation notifications
  if (calculationType === 'gdp' && changePercent !== undefined && Math.abs(changePercent) > 5) {
    const isIncrease = changePercent > 0;
    const priority = Math.abs(changePercent) > 10 ? 'high' : 'medium';

    await notificationAPI.create({
      title: `${isIncrease ? '📈' : '📉'} GDP ${isIncrease ? 'Growth' : 'Decline'} Alert`,
      message: `${metric} ${isIncrease ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(2)}% to ${currentValue.toLocaleString()}`,
      userId: userId || null,
      countryId,
      category: 'economic',
      type: isIncrease ? 'success' : 'warning',
      priority,
      href: '/mycountry/new?tab=economy',
      actionable: true,
      metadata: {
        calculationType,
        metric,
        currentValue,
        previousValue,
        changePercent,
      },
    });
  }

  // Tier change notifications
  if (tierChange) {
    await notificationAPI.create({
      title: '🎯 Economic Tier Transition',
      message: `Your nation has transitioned from ${tierChange.from} to ${tierChange.to} tier`,
      userId: userId || null,
      countryId,
      category: 'economic',
      type: 'success',
      priority: 'high',
      severity: 'important',
      href: '/mycountry/new?tab=economy',
      actionable: true,
      metadata: {
        calculationType,
        tierChange,
      },
    });
  }

  // Milestone notifications (crossing billion/trillion thresholds)
  if (calculationType === 'gdp' && metric.includes('Total GDP')) {
    const milestones = [
      { threshold: 1_000_000_000_000, label: '1 Trillion' },
      { threshold: 500_000_000_000, label: '500 Billion' },
      { threshold: 100_000_000_000, label: '100 Billion' },
      { threshold: 10_000_000_000, label: '10 Billion' },
      { threshold: 1_000_000_000, label: '1 Billion' },
    ];

    for (const milestone of milestones) {
      if (previousValue && previousValue < milestone.threshold && currentValue >= milestone.threshold) {
        await notificationAPI.create({
          title: '🏆 Economic Milestone Achieved',
          message: `Total GDP has crossed the ${milestone.label} threshold`,
          userId: userId || null,
          countryId,
          category: 'economic',
          type: 'success',
          priority: 'high',
          severity: 'important',
          href: '/mycountry/new?tab=economy',
          actionable: true,
          metadata: {
            milestone: milestone.label,
            currentValue,
          },
        });
        break; // Only notify for the first milestone crossed
      }
    }
  }
}

/**
 * Vitality Score Change Hook
 * Triggers notifications when national health scores change significantly
 */
export async function onVitalityScoreChange(params: {
  countryId: string;
  userId?: string;
  dimension: 'economic' | 'population' | 'diplomatic' | 'governmental' | 'overall';
  currentScore: number;
  previousScore: number;
  threshold?: number;
}) {
  const { countryId, userId, dimension, currentScore, previousScore, threshold = 10 } = params;

  const change = currentScore - previousScore;

  // Only notify if change exceeds threshold
  if (Math.abs(change) >= threshold) {
    const isImprovement = change > 0;
    const priority = Math.abs(change) > 15 ? 'high' : 'medium';

    const dimensionLabels = {
      economic: 'Economic Vitality',
      population: 'Population Wellbeing',
      diplomatic: 'Diplomatic Standing',
      governmental: 'Governmental Efficiency',
      overall: 'Overall National Health',
    };

    await notificationAPI.create({
      title: `${isImprovement ? '⬆️' : '⬇️'} ${dimensionLabels[dimension]} ${isImprovement ? 'Improved' : 'Declined'}`,
      message: `${dimensionLabels[dimension]} ${isImprovement ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)} points to ${currentScore.toFixed(1)}`,
      userId: userId || null,
      countryId,
      category: dimension === 'diplomatic' ? 'diplomatic' : dimension === 'governmental' ? 'governance' : 'economic',
      type: isImprovement ? 'success' : 'warning',
      priority,
      href: '/mycountry/new?tab=vitality',
      actionable: true,
      metadata: {
        dimension,
        currentScore,
        previousScore,
        change,
      },
    });
  }
}

/**
 * Tier Transition Hook
 * Triggers notifications when a country transitions between economic tiers
 */
export async function onTierTransition(params: {
  countryId: string;
  userId?: string;
  tierType: 'economic' | 'population';
  fromTier: string;
  toTier: string;
  metric: string;
  currentValue: number;
}) {
  const { countryId, userId, tierType, fromTier, toTier, metric, currentValue } = params;

  const tierRanks = {
    'Impoverished': 1,
    'Developing': 2,
    'Emerging': 3,
    'Developed': 4,
    'Advanced': 5,
    'Elite': 6,
  };

  const fromRank = tierRanks[fromTier as keyof typeof tierRanks] || 0;
  const toRank = tierRanks[toTier as keyof typeof tierRanks] || 0;
  const isUpgrade = toRank > fromRank;

  await notificationAPI.create({
    title: `${isUpgrade ? '🎉' : '⚠️'} ${tierType === 'economic' ? 'Economic' : 'Population'} Tier ${isUpgrade ? 'Advancement' : 'Decline'}`,
    message: `Your nation has ${isUpgrade ? 'advanced' : 'declined'} from ${fromTier} to ${toTier} tier (${metric}: ${currentValue.toLocaleString()})`,
    userId: userId || null,
    countryId,
    category: tierType === 'economic' ? 'economic' : 'social',
    type: isUpgrade ? 'success' : 'warning',
    priority: 'critical',
    severity: 'urgent',
    href: `/mycountry/new?tab=${tierType === 'economic' ? 'economy' : 'population'}`,
    actionable: true,
    deliveryMethod: 'dynamic-island',
    metadata: {
      tierType,
      fromTier,
      toTier,
      metric,
      currentValue,
      isUpgrade,
    },
  });
}

/**
 * Activity Ring Goal Hook
 * Triggers notifications when activity ring goals are completed
 */
export async function onActivityRingGoal(params: {
  userId: string;
  countryId: string;
  ringType: 'economic' | 'diplomatic' | 'governance' | 'social';
  goalName: string;
  progress: number;
  target: number;
  completed: boolean;
}) {
  const { userId, countryId, ringType, goalName, progress, target, completed } = params;

  if (completed) {
    const ringLabels = {
      economic: 'Economic',
      diplomatic: 'Diplomatic',
      governance: 'Governance',
      social: 'Social',
    };

    await notificationAPI.create({
      title: `🎯 ${ringLabels[ringType]} Goal Completed!`,
      message: `You've achieved your ${goalName} goal (${progress}/${target})`,
      userId,
      countryId,
      category: ringType === 'diplomatic' ? 'diplomatic' : ringType === 'governance' ? 'governance' : ringType === 'social' ? 'social' : 'economic',
      type: 'success',
      priority: 'low',
      href: '/mycountry/new?tab=activity',
      actionable: true,
      metadata: {
        ringType,
        goalName,
        progress,
        target,
      },
    });
  }
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
  onQuickActionComplete,
  onTaxSystemChange,
  onGovernmentStructureChange,
  onThinktankActivity,
  onUserAccountChange,
  onAdminAction,
  onEconomicCalculation,
  onVitalityScoreChange,
  onTierTransition,
  onActivityRingGoal,
};

export default notificationHooks;
