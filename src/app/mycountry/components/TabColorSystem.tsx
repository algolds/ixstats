"use client";

import { createContext, useContext, useState, useCallback, useMemo } from 'react';

// Comprehensive tab color system for MyCountry interface
export interface TabTheme {
  id: string;
  name: string;
  description: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    glow: string;
    text: string;
    muted: string;
  };
  cssVars: {
    '--tab-primary': string;
    '--tab-secondary': string;
    '--tab-accent': string;
    '--tab-bg': string;
    '--tab-glow': string;
    '--tab-text': string;
    '--tab-muted': string;
  };
}

// Comprehensive tab themes based on MyCountry content areas
export const TAB_THEMES: Record<string, TabTheme> = {
  // Core MyCountry identity
  mycountry: {
    id: 'mycountry',
    name: 'MyCountry',
    description: 'Core national identity and portfolio',
    colors: {
      primary: '#F59E0B',
      secondary: '#FCD34D',
      accent: '#FDE68A',
      background: 'rgba(252, 211, 77, 0.08)',
      glow: 'rgba(252, 211, 77, 0.4)',
      text: '#92400E',
      muted: '#F3F4F6',
    },
    cssVars: {
      '--tab-primary': '#F59E0B',
      '--tab-secondary': '#FCD34D',
      '--tab-accent': '#FDE68A',
      '--tab-bg': 'rgba(252, 211, 77, 0.08)',
      '--tab-glow': 'rgba(252, 211, 77, 0.4)',
      '--tab-text': '#92400E',
      '--tab-muted': '#F3F4F6',
    },
  },

  // Executive Command Interface
  executive: {
    id: 'executive',
    name: 'Executive',
    description: 'Strategic command and leadership interface',
    colors: {
      primary: '#B45309',
      secondary: '#F59E0B',
      accent: '#FBBF24',
      background: 'rgba(180, 83, 9, 0.08)',
      glow: 'rgba(180, 83, 9, 0.3)',
      text: '#92400E',
      muted: '#FEF3C7',
    },
    cssVars: {
      '--tab-primary': '#B45309',
      '--tab-secondary': '#F59E0B',
      '--tab-accent': '#FBBF24',
      '--tab-bg': 'rgba(180, 83, 9, 0.08)',
      '--tab-glow': 'rgba(180, 83, 9, 0.3)',
      '--tab-text': '#92400E',
      '--tab-muted': '#FEF3C7',
    },
  },

  // Strategic Decision Intelligence
  intelligence: {
    id: 'intelligence',
    name: 'Intelligence',
    description: 'Strategic intelligence and decision support',
    colors: {
      primary: '#0891B2',
      secondary: '#06B6D4',
      accent: '#22D3EE',
      background: 'rgba(8, 145, 178, 0.08)',
      glow: 'rgba(8, 145, 178, 0.3)',
      text: '#0E7490',
      muted: '#E0F7FA',
    },
    cssVars: {
      '--tab-primary': '#0891B2',
      '--tab-secondary': '#06B6D4',
      '--tab-accent': '#22D3EE',
      '--tab-bg': 'rgba(8, 145, 178, 0.08)',
      '--tab-glow': 'rgba(8, 145, 178, 0.3)',
      '--tab-text': '#0E7490',
      '--tab-muted': '#E0F7FA',
    },
  },

  // Analytics and Performance
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Performance metrics and data analysis',
    colors: {
      primary: '#059669',
      secondary: '#10B981',
      accent: '#34D399',
      background: 'rgba(5, 150, 105, 0.08)',
      glow: 'rgba(5, 150, 105, 0.3)',
      text: '#047857',
      muted: '#D1FAE5',
    },
    cssVars: {
      '--tab-primary': '#059669',
      '--tab-secondary': '#10B981',
      '--tab-accent': '#34D399',
      '--tab-bg': 'rgba(5, 150, 105, 0.08)',
      '--tab-glow': 'rgba(5, 150, 105, 0.3)',
      '--tab-text': '#047857',
      '--tab-muted': '#D1FAE5',
    },
  },

  // Governance and Policy
  governance: {
    id: 'governance',
    name: 'Governance',
    description: 'Government operations and policy management',
    colors: {
      primary: '#7C3AED',
      secondary: '#8B5CF6',
      accent: '#A78BFA',
      background: 'rgba(124, 58, 237, 0.08)',
      glow: 'rgba(124, 58, 237, 0.3)',
      text: '#6D28D9',
      muted: '#EDE9FE',
    },
    cssVars: {
      '--tab-primary': '#7C3AED',
      '--tab-secondary': '#8B5CF6',
      '--tab-accent': '#A78BFA',
      '--tab-bg': 'rgba(124, 58, 237, 0.08)',
      '--tab-glow': 'rgba(124, 58, 237, 0.3)',
      '--tab-text': '#6D28D9',
      '--tab-muted': '#EDE9FE',
    },
  },

  // Global and International
  global: {
    id: 'global',
    name: 'Global',
    description: 'International relations and global positioning',
    colors: {
      primary: '#475569',
      secondary: '#64748B',
      accent: '#94A3B8',
      background: 'rgba(71, 85, 105, 0.08)',
      glow: 'rgba(71, 85, 105, 0.3)',
      text: '#334155',
      muted: '#F1F5F9',
    },
    cssVars: {
      '--tab-primary': '#475569',
      '--tab-secondary': '#64748B',
      '--tab-accent': '#94A3B8',
      '--tab-bg': 'rgba(71, 85, 105, 0.08)',
      '--tab-glow': 'rgba(71, 85, 105, 0.3)',
      '--tab-text': '#334155',
      '--tab-muted': '#F1F5F9',
    },
  },

  // Economic Affairs
  economic: {
    id: 'economic',
    name: 'Economic',
    description: 'Economic policy and financial management',
    colors: {
      primary: '#059669',
      secondary: '#10B981',
      accent: '#34D399',
      background: 'rgba(5, 150, 105, 0.08)',
      glow: 'rgba(5, 150, 105, 0.3)',
      text: '#047857',
      muted: '#D1FAE5',
    },
    cssVars: {
      '--tab-primary': '#059669',
      '--tab-secondary': '#10B981',
      '--tab-accent': '#34D399',
      '--tab-bg': 'rgba(5, 150, 105, 0.08)',
      '--tab-glow': 'rgba(5, 150, 105, 0.3)',
      '--tab-text': '#047857',
      '--tab-muted': '#D1FAE5',
    },
  },

  // Social and Demographics
  social: {
    id: 'social',
    name: 'Social',
    description: 'Social policy and demographic management',
    colors: {
      primary: '#DC2626',
      secondary: '#EF4444',
      accent: '#F87171',
      background: 'rgba(220, 38, 38, 0.08)',
      glow: 'rgba(220, 38, 38, 0.3)',
      text: '#B91C1C',
      muted: '#FEE2E2',
    },
    cssVars: {
      '--tab-primary': '#DC2626',
      '--tab-secondary': '#EF4444',
      '--tab-accent': '#F87171',
      '--tab-bg': 'rgba(220, 38, 38, 0.08)',
      '--tab-glow': 'rgba(220, 38, 38, 0.3)',
      '--tab-text': '#B91C1C',
      '--tab-muted': '#FEE2E2',
    },
  },

  // Critical Alerts and Warnings
  critical: {
    id: 'critical',
    name: 'Critical',
    description: 'Critical alerts and emergency management',
    colors: {
      primary: '#DC2626',
      secondary: '#EF4444',
      accent: '#FCA5A5',
      background: 'rgba(220, 38, 38, 0.12)',
      glow: 'rgba(220, 38, 38, 0.4)',
      text: '#7F1D1D',
      muted: '#FEE2E2',
    },
    cssVars: {
      '--tab-primary': '#DC2626',
      '--tab-secondary': '#EF4444',
      '--tab-accent': '#FCA5A5',
      '--tab-bg': 'rgba(220, 38, 38, 0.12)',
      '--tab-glow': 'rgba(220, 38, 38, 0.4)',
      '--tab-text': '#7F1D1D',
      '--tab-muted': '#FEE2E2',
    },
  },
};

// Utility functions for tab theming
export function getTabTheme(tabId: string): TabTheme {
  const theme = TAB_THEMES[tabId as keyof typeof TAB_THEMES];
  if (theme) return theme;
  if (TAB_THEMES.global) return TAB_THEMES.global;
  return TAB_THEMES.mycountry as TabTheme;
}

export function applyTabTheme(tabId: string): React.CSSProperties {
  const theme = getTabTheme(tabId);
  return theme.cssVars as React.CSSProperties;
}

// Theme context provider
interface TabThemeContextType {
  currentTheme: TabTheme;
  setTheme: (themeId: string) => void;
  applyThemeStyles: (element: HTMLElement) => void;
}

const TabThemeContext = createContext<TabThemeContextType | null>(null);

export function TabThemeProvider({ 
  children, 
  defaultTheme = 'mycountry' 
}: { 
  children: React.ReactNode;
  defaultTheme?: string;
}) {
  const [currentThemeId, setCurrentThemeId] = useState(defaultTheme);
  const currentTheme = getTabTheme(currentThemeId);

  const setTheme = useCallback((themeId: string) => {
    setCurrentThemeId(themeId);
  }, []);

  const applyThemeStyles = useCallback((element: HTMLElement) => {
    const theme = getTabTheme(currentThemeId);
    Object.entries(theme.cssVars).forEach(([property, value]) => {
      element.style.setProperty(property, value);
    });
  }, [currentThemeId]);

  const contextValue = useMemo(() => ({
    currentTheme,
    setTheme,
    applyThemeStyles,
  }), [currentTheme, setTheme, applyThemeStyles]);

  return (
    <TabThemeContext.Provider value={contextValue}>
      <div style={applyTabTheme(currentThemeId)}>
        {children}
      </div>
    </TabThemeContext.Provider>
  );
}

export function useTabTheme() {
  const context = useContext(TabThemeContext);
  if (!context) {
    throw new Error('useTabTheme must be used within a TabThemeProvider');
  }
  return context;
}

// Tab indicator component with color coding
interface TabIndicatorProps {
  theme: string;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export function TabIndicator({ 
  theme, 
  label, 
  isActive = false, 
  onClick, 
  className = '' 
}: TabIndicatorProps) {
  const tabTheme = getTabTheme(theme);
  
  return (
    <button
      onClick={onClick}
      className={`
        relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
        ${isActive 
          ? 'ring-2 ring-opacity-50 shadow-lg' 
          : 'hover:shadow-md hover:scale-105'
        }
        ${className}
      `}
      style={{
        backgroundColor: isActive 
          ? tabTheme.colors.background 
          : 'rgba(255, 255, 255, 0.05)',
        borderColor: tabTheme.colors.primary,
        color: isActive ? tabTheme.colors.text : tabTheme.colors.secondary,
        boxShadow: isActive 
          ? `0 0 20px ${tabTheme.colors.glow}` 
          : undefined,
        // ringColor: tabTheme.colors.primary, // Not a valid CSS property
      }}
    >
      <span className="relative z-10">{label}</span>
      {isActive && (
        <div 
          className="absolute inset-0 rounded-lg opacity-20"
          style={{
            background: `linear-gradient(135deg, ${tabTheme.colors.primary}, ${tabTheme.colors.secondary})`,
          }}
        />
      )}
    </button>
  );
}

export default {
  TAB_THEMES,
  getTabTheme,
  applyTabTheme,
  TabThemeProvider,
  useTabTheme,
  TabIndicator,
};