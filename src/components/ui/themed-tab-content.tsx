/**
 * Themed Tab Content Component
 * Provides automatic theming for MyCountry tab content areas
 */

import React from "react";
import { cn } from "~/lib/utils";
import { getTabThemeClasses, getTabCSSProperties, type TabTheme } from "~/lib/mycountry-theme";

interface ThemedTabContentProps {
  theme: TabTheme;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Themed wrapper component that applies the appropriate color scheme
 * and CSS properties for a specific MyCountry tab
 */
export const ThemedTabContent: React.FC<ThemedTabContentProps> = ({
  theme,
  children,
  className,
  style,
}) => {
  const themeClasses = getTabThemeClasses(theme);
  const cssProperties = getTabCSSProperties(theme);

  return (
    <div
      className={cn(themeClasses.content, className)}
      style={{
        ...cssProperties,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface ThemedGlassCardProps {
  theme: TabTheme;
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  withEffects?: boolean;
}

/**
 * Glass card component with automatic tab theming
 */
export const ThemedGlassCard: React.FC<ThemedGlassCardProps> = ({
  theme,
  children,
  className,
  interactive = false,
  withEffects = false,
}) => {
  const themeClasses = getTabThemeClasses(theme);
  const cssProperties = getTabCSSProperties(theme);

  const classes = cn(
    themeClasses.glass,
    interactive && themeClasses.interactive,
    withEffects && [themeClasses.effects.shimmer, themeClasses.effects.glow],
    className
  );

  return (
    <div className={classes} style={cssProperties as React.CSSProperties}>
      {children}
    </div>
  );
};

interface ThemedMetricProps {
  theme: TabTheme;
  value: string | number;
  label: string;
  size?: "primary" | "secondary" | "small";
  className?: string;
}

/**
 * Themed metric display component
 */
export const ThemedMetric: React.FC<ThemedMetricProps> = ({
  theme,
  value,
  label,
  size = "primary",
  className,
}) => {
  const themeClasses = getTabThemeClasses(theme);
  const cssProperties = getTabCSSProperties(theme);

  return (
    <div className={cn("text-center", className)} style={cssProperties as React.CSSProperties}>
      <div className={themeClasses.metric[size]}>{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
};

export default ThemedTabContent;
