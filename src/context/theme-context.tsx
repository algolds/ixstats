// src/context/theme-context.tsx
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  effectiveTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'system',
  storageKey = 'ixstats-theme'
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [effectiveTheme, setEffectiveTheme] = useState<'light' | 'dark'>('dark');

  // Initialize theme from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme | null;
      if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
        setThemeState(storedTheme);
      }
    } catch (error) {
      console.warn('Failed to load theme from localStorage:', error);
    }
  }, [storageKey]);

  // Update effective theme based on current theme and system preference
  useEffect(() => {
    const updateEffectiveTheme = () => {
      if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        setEffectiveTheme(systemTheme);
      } else {
        setEffectiveTheme(theme);
      }
    };

    updateEffectiveTheme();

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        updateEffectiveTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(effectiveTheme);
    
    // Set data attribute for CSS
    root.setAttribute('data-theme', effectiveTheme);
    
    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', effectiveTheme === 'dark' ? '#1f2937' : '#ffffff');
    }
  }, [effectiveTheme]);

  const setTheme = (newTheme: Theme) => {
    try {
      localStorage.setItem(storageKey, newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.warn('Failed to save theme to localStorage:', error);
      setThemeState(newTheme);
    }
  };

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('system');
    } else {
      setTheme('light');
    }
  };

  const value: ThemeContextType = {
    theme,
    effectiveTheme,
    setTheme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Theme configuration for CSS custom properties
export const themeConfig = {
  light: {
    '--color-bg-primary': '#ffffff',
    '--color-bg-secondary': '#f8fafc',
    '--color-bg-tertiary': '#f1f5f9',
    '--color-bg-surface': '#ffffff',
    '--color-bg-accent': '#e2e8f0',
    '--color-text-primary': '#1e293b',
    '--color-text-secondary': '#475569',
    '--color-text-tertiary': '#64748b',
    '--color-text-muted': '#94a3b8',
    '--color-border-primary': '#e2e8f0',
    '--color-border-secondary': '#cbd5e0',
    '--color-brand-primary': '#3b82f6',
    '--color-brand-secondary': '#60a5fa',
    '--color-brand-dark': '#2563eb',
    '--color-success': '#10b981',
    '--color-success-dark': '#059669',
    '--color-warning': '#f59e0b',
    '--color-warning-dark': '#d97706',
    '--color-error': '#ef4444',
    '--color-error-dark': '#dc2626',
    '--color-info': '#06b6d4',
    '--color-surface-blur': 'rgba(255, 255, 255, 0.95)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  },
  dark: {
    '--color-bg-primary': '#0f172a',
    '--color-bg-secondary': '#1e293b',
    '--color-bg-tertiary': '#334155',
    '--color-bg-surface': '#1e293b',
    '--color-bg-accent': '#475569',
    '--color-text-primary': '#f1f5f9',
    '--color-text-secondary': '#e2e8f0',
    '--color-text-tertiary': '#cbd5e0',
    '--color-text-muted': '#94a3b8',
    '--color-border-primary': '#475569',
    '--color-border-secondary': '#64748b',
    '--color-brand-primary': '#3b82f6',
    '--color-brand-secondary': '#60a5fa',
    '--color-brand-dark': '#2563eb',
    '--color-success': '#10b981',
    '--color-success-dark': '#059669',
    '--color-warning': '#f59e0b',
    '--color-warning-dark': '#d97706',
    '--color-error': '#ef4444',
    '--color-error-dark': '#dc2626',
    '--color-info': '#06b6d4',
    '--color-surface-blur': 'rgba(30, 41, 59, 0.95)',
    '--shadow-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
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
    info: "var(--color-info)"
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
      "var(--color-chart-6)"
    ]
  };
}