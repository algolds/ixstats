import type { BaseAction, StandardPriority, IconReference, ImpactMetrics, CostStructure } from './base';

// Discriminated union for all action types
export type Action = ExecutiveAction | QuickAction | NotificationAction;

// Executive-level actions with full metadata
export interface ExecutiveAction extends BaseAction {
  type: 'executive';
  urgency: StandardPriority;
  estimatedImpact: ImpactMetrics;
  requirements: string[];
  cooldownHours?: number;
  cost?: CostStructure;
  risks?: string[];
}

// Quick actions for immediate use
export interface QuickAction extends BaseAction {
  type: 'quick';
  icon: IconReference;           // Standardized icon reference
  estimatedTime: string;
  impact: StandardPriority;      // Unified with priority
  urgency?: StandardPriority;    // Backward compatibility - maps to priority
}

// Notification-embedded actions
export interface NotificationAction extends BaseAction {
  type: 'notification';
  onClick: (() => void) | string; // Function or URL
  shortcut?: string;
  icon?: IconReference;
  tooltip?: string;
  disabled?: boolean;
  loading?: boolean;
}

// Type guards for discriminated unions
export const isExecutiveAction = (action: Action): action is ExecutiveAction => 
  action.type === 'executive';

export const isQuickAction = (action: Action): action is QuickAction => 
  action.type === 'quick';

export const isNotificationAction = (action: Action): action is NotificationAction => 
  action.type === 'notification';