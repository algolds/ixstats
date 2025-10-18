/**
 * Delivery Handlers for Unified Notification System
 * Implements different delivery methods for notifications
 */

import type {
  UnifiedNotification,
  NotificationContext,
  DeliveryMethod,
  NotificationPriority,
} from '~/types/unified-notifications';

// Base interface for all delivery handlers
export interface DeliveryHandler {
  canHandle(method: DeliveryMethod): boolean;
  deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean>;
  getCapabilities(): DeliveryCapabilities;
}

export interface DeliveryCapabilities {
  supportsBatching: boolean;
  supportsActions: boolean;
  maxContentLength: number;
  priorityLevels: NotificationPriority[];
  requiresUserInteraction: boolean;
  persistsAcrossSessions: boolean;
}

// Dynamic Island delivery handler
export class DynamicIslandDeliveryHandler implements DeliveryHandler {
  private islandCallback: ((notification: UnifiedNotification) => void) | null = null;
  private batchedNotifications: Map<string, UnifiedNotification[]> = new Map();
  private batchTimeout: NodeJS.Timeout | null = null;

  constructor() {
    console.log('[DynamicIslandDeliveryHandler] Initialized');
  }

  /**
   * Register the dynamic island callback
   */
  setIslandCallback(callback: (notification: UnifiedNotification) => void) {
    this.islandCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'dynamic-island';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    if (!this.islandCallback) {
      console.warn('[DynamicIslandDeliveryHandler] No island callback registered');
      return false;
    }

    try {
      // Check if notification should be batched
      if (this.shouldBatch(notification, context)) {
        await this.addToBatch(notification, context);
        return true;
      }

      // Deliver immediately
      this.islandCallback(this.enhanceNotificationForIsland(notification, context));
      return true;
    } catch (error) {
      console.error('[DynamicIslandDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: true,
      supportsActions: true,
      maxContentLength: 150,
      priorityLevels: ['critical', 'high', 'medium', 'low'],
      requiresUserInteraction: false,
      persistsAcrossSessions: false,
    };
  }

  private shouldBatch(notification: UnifiedNotification, context: NotificationContext): boolean {
    // Don't batch critical notifications
    if (notification.priority === 'critical') return false;
    
    // Don't batch if user is in executive mode and it's governance/economic
    if (context.isExecutiveMode && 
        ['economic', 'governance', 'security'].includes(notification.category)) {
      return false;
    }

    // Batch achievements and system notifications
    return ['achievement', 'system', 'opportunity'].includes(notification.category);
  }

  private async addToBatch(notification: UnifiedNotification, context: NotificationContext) {
    const batchKey = `${context.userId}-${notification.category}`;
    
    if (!this.batchedNotifications.has(batchKey)) {
      this.batchedNotifications.set(batchKey, []);
    }
    
    this.batchedNotifications.get(batchKey)!.push(notification);

    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Set new timeout to deliver batch
    this.batchTimeout = setTimeout(() => {
      this.deliverBatch(batchKey, context);
    }, 2000); // 2 second batch window
  }

  private deliverBatch(batchKey: string, context: NotificationContext) {
    const notifications = this.batchedNotifications.get(batchKey);
    if (!notifications || notifications.length === 0) return;

    if (notifications.length === 1) {
      // Single notification, deliver normally
      if (this.islandCallback && notifications[0]) {
        this.islandCallback(this.enhanceNotificationForIsland(notifications[0], context));
      }
    } else {
      // Create batch notification
      const batchNotification = this.createBatchNotification(notifications, context);
      if (this.islandCallback) {
        this.islandCallback(this.enhanceNotificationForIsland(batchNotification, context));
      }
    }

    // Clear batch
    this.batchedNotifications.delete(batchKey);
  }

  private createBatchNotification(
    notifications: UnifiedNotification[],
    context: NotificationContext
  ): UnifiedNotification {
    if (notifications.length === 0) {
      throw new Error('Cannot create batch notification from empty array');
    }
    
    const category = notifications[0]!.category;
    const count = notifications.length;
    
    const batchNotification: UnifiedNotification = {
      id: `batch-${Date.now()}`,
      source: 'intelligence',
      timestamp: Date.now(),
      title: `${count} ${category} updates`,
      message: `${count} new ${category} notifications`,
      category,
      type: 'info',
      priority: 'medium',
      severity: 'informational',
      context,
      triggers: [],
      relevanceScore: Math.max(...notifications.map(n => n.relevanceScore)),
      deliveryMethod: 'dynamic-island',
      status: 'pending',
      actionable: true,
      actions: [{
        id: 'view-all',
        label: `View All (${count})`,
        type: 'primary',
        onClick: () => {
          // Open command palette with filtered notifications
          console.log('View all batch notifications');
        }
      }],
      metadata: {
        batchedNotifications: notifications.map(n => n.id),
        isBatch: true,
      }
    };

    return batchNotification;
  }

  private enhanceNotificationForIsland(
    notification: UnifiedNotification,
    context: NotificationContext
  ): UnifiedNotification {
    // Add dynamic island specific enhancements
    const enhanced = { ...notification };

    // Truncate message for island display
    if (enhanced.message.length > this.getCapabilities().maxContentLength) {
      enhanced.message = enhanced.message.substring(0, this.getCapabilities().maxContentLength - 3) + '...';
    }

    // Add contextual actions
    if (!enhanced.actions) {
      enhanced.actions = [];
    }

    // Add "View Details" action if not present
    if (!enhanced.actions.some(a => a.id === 'view-details')) {
      enhanced.actions.unshift({
        id: 'view-details',
        label: 'View Details',
        type: 'secondary',
        onClick: () => {
          // Navigate to appropriate page based on category
          const routes = {
            economic: '/mycountry/new',
            governance: '/mycountry/new?tab=executive',
            diplomatic: '/executive/diplomatic',
            achievement: '/mycountry/achievements',
          };
          const route = routes[notification.category as keyof typeof routes] || '/mycountry/new';
          window.location.href = route;
        }
      });
    }

    return enhanced;
  }
}

// Toast delivery handler
export class ToastDeliveryHandler implements DeliveryHandler {
  private toastCallback: ((notification: UnifiedNotification) => void) | null = null;

  constructor() {
    console.log('[ToastDeliveryHandler] Initialized');
  }

  setToastCallback(callback: (notification: UnifiedNotification) => void) {
    this.toastCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'toast';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    if (!this.toastCallback) {
      console.warn('[ToastDeliveryHandler] No toast callback registered');
      return false;
    }

    try {
      const enhancedNotification = this.enhanceNotificationForToast(notification, context);
      this.toastCallback(enhancedNotification);
      return true;
    } catch (error) {
      console.error('[ToastDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: false,
      supportsActions: true,
      maxContentLength: 200,
      priorityLevels: ['high', 'medium', 'low'],
      requiresUserInteraction: false,
      persistsAcrossSessions: false,
    };
  }

  private enhanceNotificationForToast(
    notification: UnifiedNotification,
    context: NotificationContext
  ): UnifiedNotification {
    const enhanced = { ...notification };

    // Set appropriate toast duration based on priority
    const durations = {
      critical: 10000,
      high: 7000,
      medium: 5000,
      low: 3000,
    };

    enhanced.metadata = {
      ...enhanced.metadata,
      toastDuration: durations[notification.priority],
      toastType: this.getToastType(notification),
    };

    return enhanced;
  }

  private getToastType(notification: UnifiedNotification): string {
    const typeMapping = {
      success: 'success',
      info: 'info',
      warning: 'warning',
      error: 'error',
      critical: 'error',
      alert: 'warning',
      opportunity: 'info',
      update: 'info',
    };

    return typeMapping[notification.type] || 'info';
  }
}

// Modal delivery handler for critical notifications
export class ModalDeliveryHandler implements DeliveryHandler {
  private modalCallback: ((notification: UnifiedNotification) => void) | null = null;

  constructor() {
    console.log('[ModalDeliveryHandler] Initialized');
  }

  setModalCallback(callback: (notification: UnifiedNotification) => void) {
    this.modalCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'modal';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    if (!this.modalCallback) {
      console.warn('[ModalDeliveryHandler] No modal callback registered');
      return false;
    }

    try {
      const enhancedNotification = this.enhanceNotificationForModal(notification, context);
      this.modalCallback(enhancedNotification);
      return true;
    } catch (error) {
      console.error('[ModalDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: false,
      supportsActions: true,
      maxContentLength: 500,
      priorityLevels: ['critical', 'high'],
      requiresUserInteraction: true,
      persistsAcrossSessions: false,
    };
  }

  private enhanceNotificationForModal(
    notification: UnifiedNotification,
    context: NotificationContext
  ): UnifiedNotification {
    const enhanced = { ...notification };

    // Add modal-specific metadata
    enhanced.metadata = {
      ...enhanced.metadata,
      modalSize: notification.priority === 'critical' ? 'large' : 'medium',
      modalType: this.getModalType(notification),
      requiresAcknowledgment: notification.priority === 'critical',
    };

    // Ensure critical notifications have proper actions
    if (notification.priority === 'critical' && (!enhanced.actions || enhanced.actions.length === 0)) {
      enhanced.actions = [{
        id: 'acknowledge',
        label: 'Acknowledge',
        type: 'primary',
        onClick: () => {
          // Mark as acknowledged
          console.log('Critical notification acknowledged');
        }
      }];
    }

    return enhanced;
  }

  private getModalType(notification: UnifiedNotification): string {
    if (notification.category === 'crisis' || notification.priority === 'critical') {
      return 'error';
    }
    if (notification.type === 'warning') {
      return 'warning';
    }
    return 'info';
  }
}

// Command Palette delivery handler
export class CommandPaletteDeliveryHandler implements DeliveryHandler {
  private paletteCallback: ((notification: UnifiedNotification) => void) | null = null;

  constructor() {
    console.log('[CommandPaletteDeliveryHandler] Initialized');
  }

  setPaletteCallback(callback: (notification: UnifiedNotification) => void) {
    this.paletteCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'command-palette';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    if (!this.paletteCallback) {
      console.warn('[CommandPaletteDeliveryHandler] No palette callback registered');
      return false;
    }

    try {
      const enhancedNotification = this.enhanceNotificationForPalette(notification, context);
      this.paletteCallback(enhancedNotification);
      return true;
    } catch (error) {
      console.error('[CommandPaletteDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: true,
      supportsActions: true,
      maxContentLength: 300,
      priorityLevels: ['critical', 'high', 'medium', 'low'],
      requiresUserInteraction: false,
      persistsAcrossSessions: true,
    };
  }

  private enhanceNotificationForPalette(
    notification: UnifiedNotification,
    context: NotificationContext
  ): UnifiedNotification {
    const enhanced = { ...notification };

    // Add command palette specific metadata
    enhanced.metadata = {
      ...enhanced.metadata,
      paletteCategory: this.getPaletteCategory(notification),
      searchKeywords: this.generateSearchKeywords(notification),
      shortcut: this.getShortcut(notification),
    };

    return enhanced;
  }

  private getPaletteCategory(notification: UnifiedNotification): string {
    const categoryMapping: Record<string, string> = {
      economic: 'Economy',
      governance: 'Government',
      diplomatic: 'Diplomacy',
      security: 'Security',
      achievement: 'Achievements',
      system: 'System',
      crisis: 'Crisis Management',
      opportunity: 'Opportunities',
      social: 'Social',
      policy: 'Policy',
      intelligence: 'Intelligence',
      global: 'Global',
      military: 'Military',
    };

    return categoryMapping[notification.category] || 'General';
  }

  private generateSearchKeywords(notification: UnifiedNotification): string[] {
    const keywords = [
      notification.category,
      notification.type,
      notification.priority,
      ...notification.title.toLowerCase().split(' '),
    ];

    // Add contextual keywords
    if (notification.category === 'economic') {
      keywords.push('gdp', 'economy', 'trade', 'growth');
    }
    if (notification.category === 'governance') {
      keywords.push('government', 'policy', 'efficiency');
    }

    return [...new Set(keywords)]; // Remove duplicates
  }

  private getShortcut(notification: UnifiedNotification): string | undefined {
    // Generate shortcuts for common notification types
    const shortcuts = {
      economic: 'Ctrl+E',
      governance: 'Ctrl+G',
      diplomatic: 'Ctrl+D',
      security: 'Ctrl+S',
    };

    return shortcuts[notification.category as keyof typeof shortcuts];
  }
}

// Silent delivery handler for background notifications
export class SilentDeliveryHandler implements DeliveryHandler {
  private storageCallback: ((notification: UnifiedNotification) => void) | null = null;

  constructor() {
    console.log('[SilentDeliveryHandler] Initialized');
  }

  setStorageCallback(callback: (notification: UnifiedNotification) => void) {
    this.storageCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'silent';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    try {
      // Just store the notification without UI feedback
      if (this.storageCallback) {
        this.storageCallback(notification);
      }

      // Add to browser storage for persistence
      this.storeNotificationLocally(notification);
      
      return true;
    } catch (error) {
      console.error('[SilentDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: true,
      supportsActions: false,
      maxContentLength: 1000,
      priorityLevels: ['medium', 'low'],
      requiresUserInteraction: false,
      persistsAcrossSessions: true,
    };
  }

  private storeNotificationLocally(notification: UnifiedNotification) {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('silent-notifications') || '[]';
      const notifications = JSON.parse(stored);
      
      notifications.push({
        ...notification,
        storedAt: Date.now(),
      });

      // Keep only last 100 silent notifications
      const trimmed = notifications.slice(-100);
      
      localStorage.setItem('silent-notifications', JSON.stringify(trimmed));
    } catch (error) {
      console.error('[SilentDeliveryHandler] Failed to store notification:', error);
    }
  }
}

// Badge delivery handler for icon badges
export class BadgeDeliveryHandler implements DeliveryHandler {
  private badgeCallback: ((count: number, category?: string) => void) | null = null;
  private badgeCounts: Map<string, number> = new Map();

  constructor() {
    console.log('[BadgeDeliveryHandler] Initialized');
  }

  setBadgeCallback(callback: (count: number, category?: string) => void) {
    this.badgeCallback = callback;
  }

  canHandle(method: DeliveryMethod): boolean {
    return method === 'badge';
  }

  async deliver(notification: UnifiedNotification, context: NotificationContext): Promise<boolean> {
    try {
      // Increment badge count for category
      const current = this.badgeCounts.get(notification.category) || 0;
      this.badgeCounts.set(notification.category, current + 1);

      // Update badge display
      if (this.badgeCallback) {
        const total = Array.from(this.badgeCounts.values()).reduce((sum, count) => sum + count, 0);
        this.badgeCallback(total, notification.category);
      }

      return true;
    } catch (error) {
      console.error('[BadgeDeliveryHandler] Delivery failed:', error);
      return false;
    }
  }

  getCapabilities(): DeliveryCapabilities {
    return {
      supportsBatching: true,
      supportsActions: false,
      maxContentLength: 0, // No content, just count
      priorityLevels: ['high', 'medium', 'low'],
      requiresUserInteraction: false,
      persistsAcrossSessions: false,
    };
  }

  /**
   * Clear badge count for a category
   */
  clearBadge(category?: string) {
    if (category) {
      this.badgeCounts.delete(category);
    } else {
      this.badgeCounts.clear();
    }

    if (this.badgeCallback) {
      const total = Array.from(this.badgeCounts.values()).reduce((sum, count) => sum + count, 0);
      this.badgeCallback(total, category);
    }
  }
}

// Delivery handler registry
export class DeliveryHandlerRegistry {
  private handlers: Map<DeliveryMethod, DeliveryHandler> = new Map();

  constructor() {
    // Register default handlers
    this.registerHandler('dynamic-island', new DynamicIslandDeliveryHandler());
    this.registerHandler('toast', new ToastDeliveryHandler());
    this.registerHandler('modal', new ModalDeliveryHandler());
    this.registerHandler('command-palette', new CommandPaletteDeliveryHandler());
    this.registerHandler('silent', new SilentDeliveryHandler());
    this.registerHandler('badge', new BadgeDeliveryHandler());

    console.log('[DeliveryHandlerRegistry] Initialized with', this.handlers.size, 'handlers');
  }

  registerHandler(method: DeliveryMethod, handler: DeliveryHandler) {
    this.handlers.set(method, handler);
  }

  getHandler(method: DeliveryMethod): DeliveryHandler | null {
    return this.handlers.get(method) || null;
  }

  getAllHandlers(): Map<DeliveryMethod, DeliveryHandler> {
    return new Map(this.handlers);
  }

  getCapabilities(): Record<DeliveryMethod, DeliveryCapabilities> {
    const capabilities: Partial<Record<DeliveryMethod, DeliveryCapabilities>> = {};
    
    for (const [method, handler] of this.handlers) {
      capabilities[method] = handler.getCapabilities();
    }

    return capabilities as Record<DeliveryMethod, DeliveryCapabilities>;
  }
}

// Singleton registry instance
let registryInstance: DeliveryHandlerRegistry | null = null;

/**
 * Get the singleton delivery handler registry
 */
export function getDeliveryHandlerRegistry(): DeliveryHandlerRegistry {
  if (!registryInstance) {
    registryInstance = new DeliveryHandlerRegistry();
  }
  return registryInstance;
}

export default DeliveryHandlerRegistry;