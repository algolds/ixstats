/**
 * Modular Notification API Service
 * Provides a simple, futureproof interface for creating notifications from anywhere in the platform
 *
 * Usage:
 * ```ts
 * import { notificationAPI } from '~/lib/notification-api';
 *
 * // Create a notification
 * await notificationAPI.create({
 *   title: 'GDP Growth Alert',
 *   message: 'GDP increased by 5%',
 *   category: 'economic',
 *   priority: 'high',
 *   userId: 'user_123',
 * });
 *
 * // Bulk create notifications
 * await notificationAPI.createMany([...notifications]);
 * ```
 */

import { db } from '~/server/db';
import { emitNotificationEvent } from '~/server/api/routers/notifications';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';
export type NotificationCategory =
  | 'economic'
  | 'diplomatic'
  | 'governance'
  | 'social'
  | 'security'
  | 'system'
  | 'achievement'
  | 'crisis'
  | 'opportunity';
export type NotificationType =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'alert'
  | 'update';
export type NotificationSeverity = 'urgent' | 'important' | 'informational';
export type DeliveryMethod = 'toast' | 'dynamic-island' | 'modal' | 'command-palette';

export interface CreateNotificationInput {
  // Required fields
  title: string;

  // Optional fields
  message?: string;
  description?: string;
  userId?: string | null; // If null, it's a country or global notification
  countryId?: string | null; // If null and userId is null, it's global
  category?: NotificationCategory;
  type?: NotificationType;
  priority?: NotificationPriority;
  severity?: NotificationSeverity;
  href?: string | null;
  source?: string;
  actionable?: boolean;
  deliveryMethod?: DeliveryMethod;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

export interface NotificationTriggerOptions {
  // Thinkpages notifications
  thinkpage?: {
    id: string;
    title: string;
    action: 'created' | 'updated' | 'commented' | 'liked' | 'shared';
    authorId: string;
    targetUserId?: string;
  };

  // Economic notifications
  economic?: {
    metric: string;
    value: number;
    change?: number;
    threshold?: number;
    countryId: string;
  };

  // Diplomatic notifications
  diplomatic?: {
    eventType: 'treaty' | 'agreement' | 'mission' | 'conflict' | 'resolution';
    countries: string[];
    title?: string;
  };

  // Meeting notifications
  meeting?: {
    id: string;
    title: string;
    scheduledTime: Date;
    participants: string[];
    action: 'scheduled' | 'starting' | 'ended' | 'cancelled';
  };

  // Achievement notifications
  achievement?: {
    name: string;
    description: string;
    category: string;
    userId: string;
  };

  // Crisis notifications
  crisis?: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    countryId: string;
    description: string;
  };

  // Custom notification
  custom?: CreateNotificationInput;
}

class NotificationAPIService {
  /**
   * Create a single notification
   */
  async create(input: CreateNotificationInput): Promise<string> {
    try {
      const notification = await db.notification.create({
        data: {
          title: input.title,
          message: input.message ?? null,
          description: input.description ?? null,
          userId: input.userId ?? null,
          countryId: input.countryId ?? null,
          category: input.category ?? null,
          type: input.type ?? 'info',
          priority: input.priority ?? 'medium',
          severity: input.severity ?? 'informational',
          href: input.href ?? null,
          source: input.source ?? 'system',
          actionable: input.actionable ?? false,
          deliveryMethod: input.deliveryMethod ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          relevanceScore: input.relevanceScore ?? null,
        },
      });

      // Emit real-time event
      emitNotificationEvent(notification);

      console.log('[NotificationAPI] Created notification:', notification.id, '-', notification.title);
      return notification.id;
    } catch (error) {
      console.error('[NotificationAPI] Failed to create notification:', error);
      throw error;
    }
  }

  /**
   * Create multiple notifications in bulk
   */
  async createMany(inputs: CreateNotificationInput[]): Promise<string[]> {
    try {
      const notifications = await db.notification.createMany({
        data: inputs.map(input => ({
          title: input.title,
          message: input.message ?? null,
          description: input.description ?? null,
          userId: input.userId ?? null,
          countryId: input.countryId ?? null,
          category: input.category ?? null,
          type: input.type ?? 'info',
          priority: input.priority ?? 'medium',
          severity: input.severity ?? 'informational',
          href: input.href ?? null,
          source: input.source ?? 'system',
          actionable: input.actionable ?? false,
          deliveryMethod: input.deliveryMethod ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          relevanceScore: input.relevanceScore ?? null,
        })),
      });

      console.log('[NotificationAPI] Created', notifications.count, 'notifications');

      // Note: We can't easily get IDs from createMany, so we return empty array
      // For detailed tracking, use multiple create() calls instead
      return [];
    } catch (error) {
      console.error('[NotificationAPI] Failed to create bulk notifications:', error);
      throw error;
    }
  }

  /**
   * Trigger notifications based on platform events
   */
  async trigger(options: NotificationTriggerOptions): Promise<string | null> {
    // Thinkpages notifications
    if (options.thinkpage) {
      const { id, title, action, authorId, targetUserId } = options.thinkpage;

      const actionMessages: Record<typeof action, string> = {
        created: 'created a new ThinkPage',
        updated: 'updated their ThinkPage',
        commented: 'commented on your ThinkPage',
        liked: 'liked your ThinkPage',
        shared: 'shared your ThinkPage',
      };

      return this.create({
        title: `ThinkPage ${action}`,
        message: `${actionMessages[action]}: "${title}"`,
        userId: targetUserId ?? null,
        category: 'social',
        type: action === 'created' ? 'success' : 'info',
        priority: action === 'commented' ? 'medium' : 'low',
        href: `/thinkpages/${id}`,
        source: 'thinkpages',
        actionable: true,
        metadata: { thinkpageId: id, authorId, action },
      });
    }

    // Economic notifications
    if (options.economic) {
      const { metric, value, change, threshold, countryId } = options.economic;
      const changePercent = change ?? 0;
      const isSignificant = Math.abs(changePercent) > (threshold ?? 10);

      return this.create({
        title: `Economic Alert: ${metric}`,
        message: `${metric} ${changePercent > 0 ? 'increased' : 'decreased'} by ${Math.abs(changePercent).toFixed(2)}% to ${value.toLocaleString()}`,
        countryId,
        category: 'economic',
        type: 'alert',
        priority: isSignificant ? 'high' : 'medium',
        severity: isSignificant ? 'important' : 'informational',
        href: '/mycountry/new?tab=economy',
        source: 'economic-system',
        actionable: true,
        metadata: { metric, value, change: changePercent },
      });
    }

    // Diplomatic notifications
    if (options.diplomatic) {
      const { eventType, countries, title } = options.diplomatic;

      const eventTitles: Record<typeof eventType, string> = {
        treaty: 'Treaty Signed',
        agreement: 'Agreement Reached',
        mission: 'Diplomatic Mission',
        conflict: 'Diplomatic Conflict',
        resolution: 'Conflict Resolved',
      };

      return this.create({
        title: title ?? eventTitles[eventType],
        message: `Diplomatic ${eventType} involving ${countries.length} countries`,
        category: 'diplomatic',
        type: eventType === 'conflict' ? 'warning' : 'info',
        priority: eventType === 'conflict' ? 'high' : 'medium',
        href: '/diplomatic',
        source: 'diplomatic-system',
        actionable: true,
        metadata: { eventType, countries },
      });
    }

    // Meeting notifications
    if (options.meeting) {
      const { id, title, scheduledTime, participants, action } = options.meeting;

      const actionMessages: Record<typeof action, string> = {
        scheduled: 'Meeting scheduled',
        starting: 'Meeting starting now',
        ended: 'Meeting has ended',
        cancelled: 'Meeting cancelled',
      };

      const actionPriorities: Record<typeof action, NotificationPriority> = {
        scheduled: 'low',
        starting: 'high',
        ended: 'low',
        cancelled: 'medium',
      };

      // Notify all participants
      const notificationPromises = participants.map(userId =>
        this.create({
          title: `${actionMessages[action]}: ${title}`,
          message: `Meeting ${action === 'starting' ? 'is about to start' : actionMessages[action]}`,
          userId,
          category: 'governance',
          type: action === 'cancelled' ? 'warning' : 'info',
          priority: actionPriorities[action],
          href: `/meetings/${id}`,
          source: 'meeting-system',
          actionable: action === 'starting',
          metadata: { meetingId: id, scheduledTime: scheduledTime.toISOString(), action },
        })
      );

      await Promise.all(notificationPromises);
      return notificationPromises.length > 0 ? 'bulk-created' : null;
    }

    // Achievement notifications
    if (options.achievement) {
      const { name, description, category, userId } = options.achievement;

      return this.create({
        title: `🏆 Achievement Unlocked: ${name}`,
        message: description,
        userId,
        category: 'achievement',
        type: 'success',
        priority: 'low',
        href: '/achievements',
        source: 'achievement-system',
        actionable: true,
        metadata: { achievementName: name, achievementCategory: category },
      });
    }

    // Crisis notifications
    if (options.crisis) {
      const { type, severity, countryId, description } = options.crisis;

      return this.create({
        title: `🚨 Crisis Alert: ${type}`,
        message: description,
        countryId,
        category: 'crisis',
        type: 'error',
        priority: severity,
        severity: severity === 'critical' ? 'urgent' : 'important',
        href: '/crisis-management',
        source: 'crisis-system',
        actionable: true,
        deliveryMethod: severity === 'critical' ? 'modal' : 'dynamic-island',
        metadata: { crisisType: type, severity },
      });
    }

    // Custom notification
    if (options.custom) {
      return this.create(options.custom);
    }

    return null;
  }

  /**
   * Create notification for economic data change
   */
  async notifyEconomicChange(params: {
    metric: string;
    value: number;
    previousValue: number;
    countryId: string;
    threshold?: number;
  }): Promise<string> {
    const change = ((params.value - params.previousValue) / params.previousValue) * 100;

    return this.trigger({
      economic: {
        metric: params.metric,
        value: params.value,
        change,
        threshold: params.threshold,
        countryId: params.countryId,
      },
    }) as Promise<string>;
  }

  /**
   * Create notification for ThinkPage activity
   */
  async notifyThinkPageActivity(params: {
    thinkpageId: string;
    title: string;
    action: 'created' | 'updated' | 'commented' | 'liked' | 'shared';
    authorId: string;
    targetUserId?: string;
  }): Promise<string> {
    return this.trigger({
      thinkpage: {
        id: params.thinkpageId,
        title: params.title,
        action: params.action,
        authorId: params.authorId,
        targetUserId: params.targetUserId,
      },
    }) as Promise<string>;
  }

  /**
   * Create notification for meeting events
   */
  async notifyMeetingEvent(params: {
    meetingId: string;
    title: string;
    scheduledTime: Date;
    participants: string[];
    action: 'scheduled' | 'starting' | 'ended' | 'cancelled';
  }): Promise<void> {
    await this.trigger({
      meeting: {
        id: params.meetingId,
        title: params.title,
        scheduledTime: params.scheduledTime,
        participants: params.participants,
        action: params.action,
      },
    });
  }

  /**
   * Send notification to all users in a country
   */
  async notifyCountry(params: {
    countryId: string;
    title: string;
    message: string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
  }): Promise<string> {
    return this.create({
      title: params.title,
      message: params.message,
      countryId: params.countryId,
      category: params.category ?? 'governance',
      priority: params.priority ?? 'medium',
      source: 'country-system',
    });
  }

  /**
   * Send global notification to all users
   */
  async notifyGlobal(params: {
    title: string;
    message: string;
    category?: NotificationCategory;
    priority?: NotificationPriority;
  }): Promise<string> {
    return this.create({
      title: params.title,
      message: params.message,
      userId: null,
      countryId: null,
      category: params.category ?? 'system',
      priority: params.priority ?? 'medium',
      source: 'system',
    });
  }
}

// Export singleton instance
export const notificationAPI = new NotificationAPIService();

// Export for convenience
export default notificationAPI;
