// Enhanced Builder Primitives
// Refactored standardized components with glass physics and section theming

// Core Input Primitives
export { EnhancedNumberInput } from "./EnhancedNumberInput";
export { EnhancedSlider } from "./EnhancedSlider";
export { SliderWithDirectInput } from "./SliderWithDirectInput";
export { EnhancedDial } from "./EnhancedDial";
export { EnhancedToggle } from "./EnhancedToggle";
export { CurrencySymbolPicker } from "./CurrencySymbolPicker";
export { GlassSelectBox } from "./GlassSelectBox";
export { GlassProgressIndicator } from "./GlassProgressIndicator";

// Chart Primitives
export { EnhancedBarChart } from "./EnhancedBarChart";
export { EnhancedPieChart } from "./EnhancedPieChart";
// Future chart types (v1.1+): EnhancedLineChart, EnhancedAreaChart, EnhancedGaugeChart
// Currently satisfied by existing bar and pie charts for economic visualizations

// Composite Components
export { MetricCard } from "./MetricCard";
export { BasicView, AdvancedView, ViewTransition } from "./BasicAdvancedView";

// Theme and Utilities
export { useSectionTheme, getSectionColors, type SectionTheme } from "./theme-utils";
export { useAnimatedValue, type AnimationConfig } from "./animation-utils";

// Types
export type {
  EnhancedInputProps,
  EnhancedChartProps,
  PrimitiveTheme,
  SectionColorScheme,
} from "./types";
