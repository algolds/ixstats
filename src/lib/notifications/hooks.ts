/**
 * Notification Hooks for Platform Features
 * Auto-wiring notifications into existing functionality
 */

import { notificationAPI } from "./api";
import { guardNotificationEvent } from "./guard";
import { withBasePath } from "~/lib/base-path";

/**
 * ThinkPages Activity Hook
 * Triggers notifications for ThinkPages interactions
 */
async function onThinkPageActivity(params: {
  thinkpageId: string;
  title: string;
  action: "created" | "updated" | "commented" | "liked" | "shared";
  authorId: string;
  authorName?: string;
  targetUserId?: string;
}) {
  if (!(await guardNotificationEvent("onThinkPageActivity"))) return;
  await notificationAPI.notifyThinkPageActivity({
    thinkpageId: params.thinkpageId,
    title: params.title,
    action: params.action,
    authorId: params.authorId,
    authorName: params.authorName,
    targetUserId: params.targetUserId,
  });
}

/**
 * Meeting Event Hook
 * Triggers notifications for meeting lifecycle events
 */
async function onMeetingEvent(params: {
  meetingId: string;
  title: string;
  scheduledTime: Date;
  participants: string[];
  action: "scheduled" | "starting" | "ended" | "cancelled";
  minutesUntilStart?: number;
}) {
  if (!(await guardNotificationEvent("onMeetingEvent"))) return;
  await notificationAPI.notifyMeetingEvent({
    meetingId: params.meetingId,
    title: params.title,
    scheduledTime: params.scheduledTime,
    participants: params.participants,
    action: params.action,
  });

  // Schedule reminder notifications for upcoming meetings
  if (params.action === "scheduled" && params.minutesUntilStart) {
    // Could integrate with a job scheduler here
    console.log(
      `[NotificationHooks] Meeting reminder scheduled for ${params.minutesUntilStart} minutes before start`
    );
  }
}

/**
 * Diplomatic Event Hook
 * Triggers notifications for diplomatic activities
 */
async function onDiplomaticEvent(params: {
  eventType: "treaty" | "agreement" | "mission" | "conflict" | "resolution";
  title: string;
  countries: string[];
  description?: string;
  affectedUserIds?: string[];
}) {
  if (!(await guardNotificationEvent("onDiplomaticEvent"))) return;
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
        category: "diplomatic",
        priority: params.eventType === "conflict" ? "high" : "medium",
        href: "/mycountry/diplomacy",
        actionable: true,
      });
    }
  }
}

/**
 * Achievement Unlock Hook
 * Triggers notifications when users unlock achievements
 */
async function onAchievementUnlock(params: {
  userId: string;
  achievementId: string;
  name: string;
  description: string;
  category: string;
  rarity?: "common" | "rare" | "epic" | "legendary";
}) {
  if (!(await guardNotificationEvent("onAchievementUnlock"))) return;
  const rarityEmojis = {
    common: "🥉",
    rare: "🥈",
    epic: "🥇",
    legendary: "💎",
  };

  const emoji = rarityEmojis[params.rarity || "common"];

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
 * Social Activity Hook
 * Triggers notifications for social platform activities.
 *
 * `toUserId` is the recipient's Clerk user id (for ThinkPages, the persona's owning
 * `clerkUserId`, never the persona id). `fromUserName` is the acting persona's display name.
 * `contentId` is a ThinkPages post id; the notification links to that post.
 */
export async function onSocialActivity(params: {
  activityType: "follow" | "mention" | "share" | "repost" | "quote" | "collaboration_invite";
  fromUserId: string;
  toUserId: string;
  fromUserName?: string;
  contentTitle?: string;
  contentId?: string;
}) {
  if (!(await guardNotificationEvent("onSocialActivity"))) return;
  const actor = params.fromUserName?.trim() || "Someone";
  const activityMessages = {
    follow: `${actor} started following you`,
    mention: `${actor} mentioned you`,
    share: `${actor} shared your content`,
    repost: `${actor} reposted your post`,
    quote: `${actor} quoted your post`,
    collaboration_invite: `${actor} invited you to collaborate`,
  };

  await notificationAPI.create({
    title: activityMessages[params.activityType],
    message: params.contentTitle ? `on "${params.contentTitle}"` : undefined,
    userId: params.toUserId,
    category: "social",
    priority: "low",
    href: params.contentId ? withBasePath(`/dashboard/post/${params.contentId}`) : null,
    actionable: !!params.contentId,
    metadata: {
      fromUserId: params.fromUserId,
      activityType: params.activityType,
      ...(params.contentId ? { postId: params.contentId } : {}),
    },
  });
}

/**
 * Quick Action Complete Hook
 * Triggers notifications when quick actions (policies, meetings) complete or fail
 */
async function onQuickActionComplete(params: {
  userId?: string;
  countryId: string;
  actionType: "policy" | "meeting" | "activity" | "decision";
  actionName: string;
  status: "completed" | "failed" | "scheduled";
  impactSummary?: string;
  errorDetails?: string;
  href?: string;
}) {
  if (!(await guardNotificationEvent("onQuickActionComplete"))) return;
  const statusTitles = {
    completed: "Action Completed Successfully",
    failed: "Action Failed",
    scheduled: "Action Scheduled",
  };

  const priority =
    params.status === "failed" ? "high" : params.status === "completed" ? "medium" : "low";
  const type =
    params.status === "failed" ? "error" : params.status === "completed" ? "success" : "info";

  const message =
    params.status === "failed" && params.errorDetails
      ? `${params.actionName}: ${params.errorDetails}`
      : params.status === "completed" && params.impactSummary
        ? `${params.actionName}: ${params.impactSummary}`
        : params.actionName;

  await notificationAPI.create({
    title: statusTitles[params.status],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: "governance",
    priority,
    type,
    href: params.href || "/mycountry/quickactions",
    actionable: params.status === "failed",
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
async function onTaxSystemChange(params: {
  userId?: string;
  countryId: string;
  changeType:
    "created" | "updated" | "revenue_projection_change" | "effectiveness_change" | "bracket_change";
  systemName: string;
  previousValue?: number;
  newValue?: number;
  changePercent?: number;
  details?: string;
}) {
  if (!(await guardNotificationEvent("onTaxSystemChange"))) return;
  const changeTitles = {
    created: "Tax System Created",
    updated: "Tax System Updated",
    revenue_projection_change: "Revenue Projection Changed",
    effectiveness_change: "Tax Effectiveness Changed",
    bracket_change: "Tax Bracket Updated",
  };

  // Determine priority based on change magnitude
  let priority: "low" | "medium" | "high" = "medium";
  if (params.changePercent && Math.abs(params.changePercent) > 20) {
    priority = "high";
  } else if (params.changePercent && Math.abs(params.changePercent) < 5) {
    priority = "low";
  }

  const type = params.changePercent && params.changePercent < 0 ? "warning" : "info";

  let message = params.systemName;
  if (params.details) {
    message += `: ${params.details}`;
  } else if (params.changePercent !== undefined) {
    const direction = params.changePercent > 0 ? "increased" : "decreased";
    message += ` ${direction} by ${Math.abs(params.changePercent).toFixed(1)}%`;
  }

  await notificationAPI.create({
    title: changeTitles[params.changeType],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: "economic",
    priority,
    type,
    href: "/mycountry/tax-system",
    actionable:
      params.changeType === "revenue_projection_change" && Math.abs(params.changePercent || 0) > 10,
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
async function onGovernmentStructureChange(params: {
  userId?: string;
  countryId: string;
  changeType:
    | "component_added"
    | "component_removed"
    | "effectiveness_change"
    | "synergy_detected"
    | "budget_exceeded";
  componentName?: string;
  effectivenessScore?: number;
  previousScore?: number;
  synergyBonus?: number;
  details?: string;
}) {
  if (!(await guardNotificationEvent("onGovernmentStructureChange"))) return;
  const changeTitles = {
    component_added: "Government Component Added",
    component_removed: "Government Component Removed",
    effectiveness_change: "Government Effectiveness Changed",
    synergy_detected: "Component Synergy Detected",
    budget_exceeded: "Department Budget Exceeded",
  };

  // Determine priority
  let priority: "low" | "medium" | "high" = "medium";
  if (params.changeType === "budget_exceeded") {
    priority = "high";
  } else if (params.changeType === "synergy_detected") {
    priority = "medium";
  } else if (params.effectivenessScore && params.previousScore) {
    const change = Math.abs(params.effectivenessScore - params.previousScore);
    if (change > 10) priority = "high";
    else if (change < 5) priority = "low";
  }

  const type =
    params.changeType === "budget_exceeded"
      ? "warning"
      : params.changeType === "synergy_detected"
        ? "success"
        : "info";

  let message = params.componentName || "Government structure";
  if (params.details) {
    message += `: ${params.details}`;
  } else if (params.effectivenessScore !== undefined && params.previousScore !== undefined) {
    const change = params.effectivenessScore - params.previousScore;
    const direction = change > 0 ? "improved" : "decreased";
    message += ` effectiveness ${direction} by ${Math.abs(change).toFixed(1)} points`;
  } else if (params.synergyBonus) {
    message += ` provides +${params.synergyBonus}% synergy bonus`;
  }

  await notificationAPI.create({
    title: changeTitles[params.changeType],
    message,
    userId: params.userId || null,
    countryId: params.countryId,
    category: "governance",
    priority,
    type,
    href: "/mycountry/government",
    actionable:
      params.changeType === "budget_exceeded" ||
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
async function onThinktankActivity(params: {
  activityType:
    | "group_invite"
    | "new_message"
    | "document_created"
    | "document_updated"
    | "member_joined"
    | "member_left"
    | "role_changed"
    | "settings_changed";
  groupId: string;
  groupName: string;
  groupType?: "public" | "private" | "invite_only";
  actorUserId: string;
  actorUserName?: string;
  targetUserId?: string;
  targetUserIds?: string[];
  contentTitle?: string;
  contentId?: string;
  metadata?: Record<string, any>;
}) {
  if (!(await guardNotificationEvent("onThinktankActivity"))) return;
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
    metadata,
  } = params;

  // Helper function to create notification for a user
  const createNotificationForUser = async (userId: string, customMessage?: string) => {
    const actorName = actorUserName || "Someone";

    let title = "";
    let message = customMessage || "";
    let href = `/thinktanks?group=${groupId}`;

    switch (activityType) {
      case "group_invite":
        title = `Invitation to ${groupName}`;
        message = `${actorName} invited you to join the group`;
        href = `/thinktanks?group=${groupId}`;
        break;

      case "new_message":
        title = `New message in ${groupName}`;
        message = contentTitle || `${actorName} posted a message`;
        href = `/thinktanks?group=${groupId}&tab=chat`;
        break;

      case "document_created":
        title = `New document in ${groupName}`;
        message = contentTitle
          ? `${actorName} created "${contentTitle}"`
          : `${actorName} created a new document`;
        href = `/thinktanks?group=${groupId}&tab=papers`;
        break;

      case "document_updated":
        title = `Document updated in ${groupName}`;
        message = contentTitle
          ? `${actorName} updated "${contentTitle}"`
          : `${actorName} updated a document`;
        href = `/thinktanks?group=${groupId}&tab=papers`;
        break;

      case "member_joined":
        title = `New member in ${groupName}`;
        message = `${actorName} joined the group`;
        break;

      case "member_left":
        title = `Member left ${groupName}`;
        message = `${actorName} left the group`;
        break;

      case "role_changed":
        title = `Role changed in ${groupName}`;
        message = metadata?.newRole
          ? `You were promoted to ${metadata.newRole}`
          : "Your role in the group has changed";
        break;

      case "settings_changed":
        title = `${groupName} settings updated`;
        message = `${actorName} updated the group settings`;
        break;
    }

    await notificationAPI.create({
      title,
      message,
      userId,
      category: "social",
      type: activityType === "group_invite" ? "update" : "info",
      priority: activityType === "group_invite" ? "medium" : "low",
      href,
      source: "thinktank",
      actionable: activityType === "group_invite",
      metadata: {
        groupId,
        groupName,
        groupType,
        activityType,
        fromUserId: actorUserId,
        contentId,
        ...metadata,
      },
    });
  };

  // Handle single target user
  if (targetUserId) {
    await createNotificationForUser(targetUserId);
  }

  // Handle multiple target users (bulk notifications)
  if (targetUserIds && targetUserIds.length > 0) {
    // Use Promise.all for parallel execution
    await Promise.all(targetUserIds.map((userId) => createNotificationForUser(userId)));
  }
}

/**
 * User Account Change Hook
 * Triggers notifications for user account events
 */
async function onUserAccountChange(params: {
  userId: string;
  changeType:
    | "country_assigned"
    | "country_updated"
    | "role_changed"
    | "profile_verified"
    | "settings_updated";
  title: string;
  description: string;
  metadata?: Record<string, any>;
  priority?: "critical" | "high" | "medium" | "low";
}) {
  if (!(await guardNotificationEvent("onUserAccountChange"))) return;
  const priorityMap = {
    country_assigned: "high" as const,
    country_updated: "medium" as const,
    role_changed: "high" as const,
    profile_verified: "medium" as const,
    settings_updated: "low" as const,
  };

  const typeMap = {
    country_assigned: "success" as const,
    country_updated: "info" as const,
    role_changed: "alert" as const,
    profile_verified: "success" as const,
    settings_updated: "info" as const,
  };

  await notificationAPI.create({
    title: params.title,
    message: params.description,
    userId: params.userId,
    category: "system",
    type: typeMap[params.changeType],
    priority: params.priority ?? priorityMap[params.changeType],
    href: params.changeType.startsWith("country") ? "/mycountry/new" : "/settings",
    source: "user-system",
    actionable: true,
    metadata: {
      changeType: params.changeType,
      ...params.metadata,
    },
  });
}

/**
 * Vitality Score Change Hook
 * Triggers notifications when national health scores change significantly
 */
async function onVitalityScoreChange(params: {
  countryId: string;
  userId?: string;
  dimension: "economic" | "population" | "diplomatic" | "governmental" | "overall";
  currentScore: number;
  previousScore: number;
  threshold?: number;
}) {
  if (!(await guardNotificationEvent("onVitalityScoreChange"))) return;
  const { countryId, userId, dimension, currentScore, previousScore, threshold = 10 } = params;

  const change = currentScore - previousScore;

  // Only notify if change exceeds threshold
  if (Math.abs(change) >= threshold) {
    const isImprovement = change > 0;
    const priority = Math.abs(change) > 15 ? "high" : "medium";

    const dimensionLabels = {
      economic: "Economic Vitality",
      population: "Population Wellbeing",
      diplomatic: "Diplomatic Standing",
      governmental: "Governmental Efficiency",
      overall: "Overall National Health",
    };

    await notificationAPI.create({
      title: `${isImprovement ? "⬆️" : "⬇️"} ${dimensionLabels[dimension]} ${isImprovement ? "Improved" : "Declined"}`,
      message: `${dimensionLabels[dimension]} ${isImprovement ? "increased" : "decreased"} by ${Math.abs(change).toFixed(1)} points to ${currentScore.toFixed(1)}`,
      userId: userId || null,
      countryId,
      category:
        dimension === "diplomatic"
          ? "diplomatic"
          : dimension === "governmental"
            ? "governance"
            : "economic",
      type: isImprovement ? "success" : "warning",
      priority,
      href: "/mycountry/new?tab=vitality",
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

// Export all hooks
export const notificationHooks = {
  onThinkPageActivity,
  onMeetingEvent,
  onDiplomaticEvent,
  onAchievementUnlock,
  onSocialActivity,
  onQuickActionComplete,
  onTaxSystemChange,
  onGovernmentStructureChange,
  onThinktankActivity,
  onUserAccountChange,
  onVitalityScoreChange,
};
