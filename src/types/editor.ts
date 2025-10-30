/**
 * Editor Type Definitions
 *
 * Types for the country editor feedback and validation system.
 */

/**
 * Status indicator for feedback metrics
 */
export type FeedbackStatus = "success" | "warning" | "danger" | "info";

/**
 * Trend indicator for metrics
 */
export type FeedbackTrend = "up" | "down" | "stable";

/**
 * Individual metric within a feedback section
 */
export interface FeedbackMetric {
  /** Metric label */
  label: string;

  /** Metric value (numeric or string) */
  value: number | string;

  /** Trend indicator */
  trend?: FeedbackTrend;

  /** Status indicator */
  status: FeedbackStatus;

  /** Optional description */
  description?: string;

  /** Optional unit of measurement */
  unit?: string;
}

/**
 * Section of feedback metrics
 */
export interface FeedbackSection {
  /** Section title */
  title: string;

  /** Section description */
  description?: string;

  /** Array of metrics in this section */
  metrics: FeedbackMetric[];

  /** Section-level status */
  status?: FeedbackStatus;

  /** Icon identifier for the section */
  icon?: string;
}

/**
 * Editor feedback state
 */
export interface EditorFeedback {
  /** Array of feedback sections */
  sections: FeedbackSection[];

  /** Overall score (0-100) */
  overallScore: number;

  /** Array of recommendations */
  recommendations: string[];

  /** Timestamp of last feedback calculation */
  lastUpdated?: Date;

  /** Whether feedback is currently being calculated */
  isCalculating?: boolean;

  /** Any errors during feedback calculation */
  errors?: string[];
}

/**
 * Validation error types
 */
export interface ValidationError {
  /** Field that has the error */
  field: string;

  /** Error message */
  message: string;

  /** Error severity */
  severity: "error" | "warning" | "info";

  /** Optional suggestion for fixing */
  suggestion?: string;

  /** Related field if applicable */
  relatedField?: string;
}

/**
 * Editor save state
 */
export interface EditorSaveState {
  /** Whether currently saving */
  isSaving: boolean;

  /** Last successful save timestamp */
  lastSavedAt: Date | null;

  /** Whether there are pending unsaved changes */
  pendingChanges: boolean;

  /** Any error during save */
  error: Error | null;

  /** Success message */
  successMessage?: string;
}
