// src/context/theme-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  compactMode: boolean;
  setCompactMode: (compact: boolean) => void;
  toggleCompactMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ixstats-theme",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("dark");
  const [compactMode, setCompactModeState] = useState<boolean>(false);

  // Initialize theme and compact mode from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme && ["light", "dark", "system"].includes(storedTheme)) {
        setThemeState(storedTheme);
      }

      const storedCompactMode = localStorage.getItem("ixstats-compact-mode");
      if (storedCompactMode !== null) {
        setCompactModeState(storedCompactMode === "true");
      }
    } catch (error) {
      console.warn("Failed to load theme settings from localStorage:", error);
    }
  }, [storageKey]);

  // Memoize system theme detection and update effective theme
  const systemTheme = useMemo(() => {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }, []);

  // Update effective theme with better performance
  useEffect(() => {
    const newEffectiveTheme = theme === "system" ? systemTheme : theme;
    if (newEffectiveTheme !== effectiveTheme) {
      setEffectiveTheme(newEffectiveTheme);
    }
  }, [theme, systemTheme, effectiveTheme]);

  // Listen for system theme changes - optimized
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply theme and compact mode to document - debounced for performance
  useEffect(() => {
    const applyTheme = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(effectiveTheme);

      // Apply compact mode class
      if (compactMode) {
        root.classList.add("compact-mode");
      } else {
        root.classList.remove("compact-mode");
      }

      // Set data attributes for CSS
      root.setAttribute("data-theme", effectiveTheme);
      root.setAttribute("data-compact", compactMode.toString());

      // Update meta theme-color for mobile browsers
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", effectiveTheme === "dark" ? "#1f2937" : "#ffffff");
      }
    };

    // Debounce theme application
    const timeoutId = setTimeout(applyTheme, 0);
    return () => clearTimeout(timeoutId);
  }, [effectiveTheme, compactMode]);

  // Memoize theme functions to prevent re-renders
  const setTheme = useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
        setThemeState(newTheme);
      } catch (error) {
        console.warn("Failed to save theme to localStorage:", error);
        setThemeState(newTheme);
      }
    },
    [storageKey]
  );

  const toggleTheme = useCallback(() => {
    if (theme === "light") {
      setTheme("dark");
    } else if (theme === "dark") {
      setTheme("system");
    } else {
      setTheme("light");
    }
  }, [theme, setTheme]);

  // Compact mode functions
  const setCompactMode = useCallback((compact: boolean) => {
    try {
      localStorage.setItem("ixstats-compact-mode", compact.toString());
      setCompactModeState(compact);
    } catch (error) {
      console.warn("Failed to save compact mode to localStorage:", error);
      setCompactModeState(compact);
    }
  }, []);

  const toggleCompactMode = useCallback(() => {
    setCompactMode(!compactMode);
  }, [compactMode, setCompactMode]);

  // Memoize context value to prevent unnecessary re-renders
  const value: ThemeContextType = useMemo(
    () => ({
      theme,
      effectiveTheme,
      setTheme,
      toggleTheme,
      compactMode,
      setCompactMode,
      toggleCompactMode,
    }),
    [theme, effectiveTheme, setTheme, toggleTheme, compactMode, setCompactMode, toggleCompactMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Theme configuration for CSS custom properties
export const themeConfig = {
  light: {
    "--color-bg-primary": "#ffffff",
    "--color-bg-secondary": "#f8fafc",
    "--color-bg-tertiary": "#f1f5f9",
    "--color-bg-surface": "#ffffff",
    "--color-bg-accent": "#e2e8f0",
    "--color-text-primary": "#1e293b",
    "--color-text-secondary": "#475569",
    "--color-text-tertiary": "#64748b",
    "--color-text-muted": "#94a3b8",
    "--color-border-primary": "#e2e8f0",
    "--color-border-secondary": "#cbd5e0",
    "--color-brand-primary": "#3b82f6",
    "--color-brand-secondary": "#60a5fa",
    "--color-brand-dark": "#2563eb",
    "--color-success": "#10b981",
    "--color-success-dark": "#059669",
    "--color-warning": "#f59e0b",
    "--color-warning-dark": "#d97706",
    "--color-error": "#ef4444",
    "--color-error-dark": "#dc2626",
    "--color-info": "#06b6d4",
    "--color-purple": "#8b5cf6",
    "--color-surface-blur": "rgba(255, 255, 255, 0.95)",
    "--shadow-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  },
  dark: {
    "--color-bg-primary": "#0f172a",
    "--color-bg-secondary": "#1e293b",
    "--color-bg-tertiary": "#334155",
    "--color-bg-surface": "#1e293b",
    "--color-bg-accent": "#475569",
    "--color-text-primary": "#f1f5f9",
    "--color-text-secondary": "#e2e8f0",
    "--color-text-tertiary": "#cbd5e0",
    "--color-text-muted": "#94a3b8",
    "--color-border-primary": "#475569",
    "--color-border-secondary": "#64748b",
    "--color-brand-primary": "#3b82f6",
    "--color-brand-secondary": "#60a5fa",
    "--color-brand-dark": "#2563eb",
    "--color-success": "#10b981",
    "--color-success-dark": "#059669",
    "--color-warning": "#f59e0b",
    "--color-warning-dark": "#d97706",
    "--color-error": "#ef4444",
    "--color-error-dark": "#dc2626",
    "--color-info": "#06b6d4",
    "--color-purple": "#8b5cf6",
    "--color-surface-blur": "rgba(30, 41, 59, 0.95)",
    "--shadow-lg": "0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)",
  },
} as const;

// Hook to get current theme values
export function useThemeValues() {
  const { effectiveTheme } = useTheme();
  return themeConfig[effectiveTheme];
}
export function useStatusColors() {
  return {
    online: "var(--color-success)",
    offline: "var(--color-error)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
  };
}

export function useChartTheme() {
  return {
    background: "var(--color-bg-secondary)",
    gridColor: "var(--color-border-primary)",
    textColor: "var(--color-text-muted)",
    axisColor: "var(--color-border-secondary)",
    tooltipBg: "var(--color-surface-blur)",
    colors: [
      "var(--color-chart-1)",
      "var(--color-chart-2)",
      "var(--color-chart-3)",
      "var(--color-chart-4)",
      "var(--color-chart-5)",
      "var(--color-chart-6)",
    ],
  };
}
