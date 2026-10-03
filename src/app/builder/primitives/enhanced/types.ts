// Enhanced Primitive Types

export type SectionId =
  | "symbols"
  | "core"
  | "labor"
  | "fiscal"
  | "government"
  | "demographics"
  | "spending"
  | "sectors"
  | "preview";

export interface SectionColorScheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  border: string;
  text: string;
  muted: string;
}

export type PrimitiveTheme =
  | "gold" // National Symbols, Fiscal System
  | "blue" // Core Indicators
  | "emerald" // Labor & Employment
  | "purple" // Government Spending
  | "red" // Demographics
  | "default";

export interface EnhancedInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  label?: string;
  description?: string;
  unit?: string;
  sectionId?: SectionId;
  theme?: PrimitiveTheme;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  required?: boolean;
  referenceValue?: number;
  referenceLabel?: string;
  showComparison?: boolean;
  animationDuration?: number;
  className?: string;
}

export interface MetricCardProps {
  label: string;
  value: number | string;
  unit?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  sectionId?: SectionId;
  theme?: PrimitiveTheme;
  trend?: "up" | "down" | "neutral";
  change?: number;
  changeUnit?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  tooltip?: string;
  precision?: number;
}

export interface AnimationConfig {
  enabled?: boolean;
  duration?: number;
  easing?: "easeInOut" | "easeIn" | "easeOut" | "linear";
  delay?: number;
  stagger?: number;
}
