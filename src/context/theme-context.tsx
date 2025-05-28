// src/context/theme-context.tsx
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to dark theme since it's our new default
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("ixstats-theme") as Theme | null;
      
      if (savedTheme && (savedTheme === "light" || savedTheme === "dark")) {
        setTheme(savedTheme);
      } else {
        // Check system preference, but default to dark
        if (window.matchMedia("(prefers-color-scheme: light)").matches) {
          setTheme("light");
        } else {
          setTheme("dark"); // Our new default
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ixstats-theme", theme);
      
      // Since dark is now our default CSS, we add "light" class for light theme
      const htmlElement = document.documentElement;
      
      if (theme === "light") {
        htmlElement.classList.add("light");
        htmlElement.classList.remove("dark"); // Remove any existing dark class
      } else {
        htmlElement.classList.remove("light");
        htmlElement.classList.add("dark"); // Keep for compatibility, but not needed for styling
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  const value = {
    theme,
    toggleTheme,
    isDark: theme === "dark",
    isLight: theme === "light"
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

// Utility hook for conditional styling based on theme
export function useThemeClasses() {
  const { isDark, isLight } = useTheme();
  
  return {
    // Background classes
    bg: {
      primary: "bg-[var(--color-bg-primary)]",
      secondary: "bg-[var(--color-bg-secondary)]", 
      tertiary: "bg-[var(--color-bg-tertiary)]",
      surface: "bg-[var(--color-bg-surface)]",
      elevated: "bg-[var(--color-bg-elevated)]"
    },
    
    // Text classes
    text: {
      primary: "text-[var(--color-text-primary)]",
      secondary: "text-[var(--color-text-secondary)]",
      tertiary: "text-[var(--color-text-tertiary)]",
      muted: "text-[var(--color-text-muted)]",
      disabled: "text-[var(--color-text-disabled)]"
    },
    
    // Border classes
    border: {
      primary: "border-[var(--color-border-primary)]",
      secondary: "border-[var(--color-border-secondary)]",
      accent: "border-[var(--color-border-accent)]"
    },
    
    // Brand classes
    brand: {
      primary: "text-[var(--color-brand-primary)]",
      bg: "bg-[var(--color-brand-primary)]",
      border: "border-[var(--color-brand-primary)]"
    },
    
    // Status classes
    status: {
      success: "text-[var(--color-success)]",
      warning: "text-[var(--color-warning)]", 
      error: "text-[var(--color-error)]",
      info: "text-[var(--color-info)]"
    },
    
    // Component classes
    card: "card",
    button: {
      primary: "btn-primary",
      secondary: "btn-secondary"
    },
    input: "form-input",
    label: "form-label",
    select: "form-select",
    
    // Utility
    isDark,
    isLight
  };
}

// Helper function to get theme-aware colors for chart libraries
export function useChartTheme() {
  const { isDark } = useTheme();
  
  return {
    backgroundColor: isDark ? "#1f2937" : "#ffffff",
    gridColor: isDark ? "#374151" : "#e5e7eb", 
    textColor: isDark ? "#d1d5db" : "#374151",
    axisColor: isDark ? "#4b5563" : "#9ca3af",
    tooltipBg: isDark ? "rgba(31, 41, 55, 0.95)" : "rgba(255, 255, 255, 0.95)",
    
    // Chart color palette (works well in both themes)
    colors: [
      "#8b5cf6", // purple
      "#3b82f6", // blue  
      "#10b981", // green
      "#f59e0b", // yellow
      "#ef4444", // red
      "#06b6d4", // cyan
      "#84cc16", // lime
      "#f97316", // orange
      "#ec4899", // pink
      "#14b8a6"  // teal
    ]
  };
}

// Hook for getting economic tier colors
export function useTierColors() {
  return {
    advanced: "var(--color-tier-advanced)",
    developed: "var(--color-tier-developed)", 
    emerging: "var(--color-tier-emerging)",
    developing: "var(--color-tier-developing)"
  };
}

// Hook for status indicators
export function useStatusColors() {
  return {
    online: "var(--color-success)",
    offline: "var(--color-error)",
    warning: "var(--color-warning)",
    info: "var(--color-info)",
    paused: "var(--color-warning)",
    active: "var(--color-success)",
    inactive: "var(--color-text-muted)"
  };
}