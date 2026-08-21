/**
 * Builder Suggestions & Recommendations Types
 */

export interface SuggestionItem<T = any> {
  id: string;
  title: string;
  description?: string;
  severity: "info" | "warning" | "critical";
  diff?: string;
  payload?: T;
  action?: () => void;
}
