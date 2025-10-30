// Chart and Control Type Definitions
export interface ChartColors {
  primary: string[];
  semantic: {
    success: string;
    warning: string;
    error: string;
    info: string;
  };
  [key: string]: any;
}

export interface ChartData {
  [key: string]: any;
}

export interface ChartConfig {
  theme?: "default" | "gold" | "blue" | "emerald" | "purple";
  depth?: "base" | "elevated" | "modal";
  blur?: "light" | "medium" | "heavy";
  height?: number | string;
  loading?: boolean;
  error?: string;
  className?: string;
}

export interface ControlConfig {
  theme?: "default" | "gold" | "blue" | "emerald" | "purple";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export interface NumberPickerConfig extends ControlConfig {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  unit?: string;
}

export interface SliderConfig extends ControlConfig {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  orientation?: "horizontal" | "vertical";
  showTicks?: boolean;
  tickCount?: number;
}

export interface DialConfig extends ControlConfig {
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
}

export interface ToggleConfig extends ControlConfig {
  description?: string;
}
