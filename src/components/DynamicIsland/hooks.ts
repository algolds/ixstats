import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Globe, BarChart3, Settings, Activity, TrendingUp, Crown, Gauge, Eye, Target, Plus } from 'lucide-react';
import { createUrl } from '~/lib/url-utils';
import type { ViewMode, SearchFilter } from './types';

// UserProfile interface for command items hook
interface UserProfile {
  countryId: string | null;
}

interface CommandItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

interface CommandGroup {
  group: string;
  items: CommandItem[];
}

export function useCommandItems(userProfile?: UserProfile) {
  return useMemo(() => {
    const baseItems: CommandGroup[] = [
      {
        group: 'Navigation',
        items: [
          { title: 'Go to Countries', icon: Globe, action: () => window.location.href = createUrl('/countries/new') },
          { title: 'View Analytics', icon: BarChart3, action: () => window.location.href = createUrl('/analytics') },
          { title: 'Open Settings', icon: Settings, action: () => window.location.href = createUrl('/settings') },
        ],
      },
      {
        group: 'Quick Actions',
        items: [
          { title: 'Refresh Data', icon: Activity, action: () => window.location.reload() },
          { title: 'Export Statistics', icon: TrendingUp, action: () => console.log('Export statistics') },
        ]
      }
    ];

    if (userProfile?.countryId) {
      baseItems.splice(1, 0, {
        group: 'Dashboard Sections',
        items: [
          { title: 'Go to MyCountry', icon: Crown, action: () => window.location.href = createUrl('/mycountry') },
          { title: 'Open ECI Suite', icon: Gauge, action: () => window.location.href = createUrl('/eci') },
          { title: 'Access SDI Intelligence', icon: Eye, action: () => window.location.href = createUrl('/sdi') },
        ]
      });
    } else {
      baseItems.splice(1, 0, {
        group: 'Setup Required',
        items: [
          { title: 'Complete Setup', icon: Target, action: () => window.location.href = createUrl('/setup') },
          { title: 'Configure Profile', icon: Settings, action: () => window.location.href = createUrl('/profile') },
        ]
      });
    }

    return baseItems;
  }, [userProfile?.countryId]);
}

// Shared state management hook for Dynamic Island
export function useDynamicIslandState() {
  const [mode, setMode] = useState<ViewMode>('compact');
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<ViewMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('all');
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'time' | 'date' | 'both'>('time');
  
  // Enhanced keyboard shortcuts with debouncing to prevent duplicates
  const [isProcessingShortcut, setIsProcessingShortcut] = useState(false);
  const shortcutTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  // Debounce search query for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Mode switching with dropdown behavior
  const switchMode = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    setIsUserInteracting(true);
    
    // Reset user interaction after 30 seconds
    const timeout = setTimeout(() => setIsUserInteracting(false), 30000);
    
    if (newMode === "compact") {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      setExpandedMode(newMode);
    }
    
    return () => clearTimeout(timeout);
  }, []);

  // Start cycling mode after 10 seconds of inactivity
  useEffect(() => {
    if (mode === "compact" && !isUserInteracting) {
      const timeout = setTimeout(() => {
        switchMode("cycling");
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [mode, isUserInteracting, switchMode]);

  // Enhanced keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent duplicate processing
      if (isProcessingShortcut) {
        e.preventDefault();
        return;
      }

      // Only handle if focused on body or the command palette
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';
      
      // Allow keyboard shortcuts when not typing in inputs (except for our search input)
      const isOurSearchInput = activeElement?.closest('[data-command-palette-search]');
      if (isInputFocused && !isOurSearchInput && e.key !== 'Escape') {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "search" ? "compact" : "search");
            
            // Clear processing flag after animation
            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => {
              setIsProcessingShortcut(false);
            }, 500);
            break;
          case 'n':
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "notifications" ? "compact" : "notifications");
            
            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => {
              setIsProcessingShortcut(false);
            }, 500);
            break;
          case ',':
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "settings" ? "compact" : "settings");
            
            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => {
              setIsProcessingShortcut(false);
            }, 500);
            break;
        }
      }
      
      // Tab cycling for filters when in search mode
      if (e.key === 'Tab' && mode === 'search' && !isProcessingShortcut) {
        e.preventDefault();
        const filters: SearchFilter[] = ['all', 'countries', 'commands', 'features'];
        const currentIndex = filters.indexOf(searchFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        const nextFilter = filters[nextIndex];
        if (nextFilter) {
          setSearchFilter(nextFilter);
        }
      }
      
      if (e.key === 'Escape' && !isProcessingShortcut) {
        e.preventDefault();
        if (mode === 'search' && searchQuery) {
          setSearchQuery('');
          setSearchFilter('all');
        } else {
          setIsProcessingShortcut(true);
          switchMode("compact");
          
          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => {
            setIsProcessingShortcut(false);
          }, 500);
        }
      }
    };

    // Use capture phase to catch events before they bubble
    window.addEventListener('keydown', handleKeyPress, { capture: true, passive: false });
    return () => {
      window.removeEventListener('keydown', handleKeyPress, { capture: true });
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, [mode, switchMode, searchFilter, searchQuery, isProcessingShortcut]);

  return {
    // State
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    isUserInteracting,
    timeDisplayMode,
    
    // Actions
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    setTimeDisplayMode,
    switchMode,
  };
}

// Static data for commands and features
export const commands = [
  { name: "Dashboard", path: "/dashboard", icon: Target, description: "Main analytics dashboard" },
  { name: "Countries", path: "/countries", icon: Globe, description: "Browse all countries" },
  { name: "MyCountry®", path: "/mycountry/new", icon: Crown, description: "Your national dashboard and executive command center" },
  { name: "ECI", path: "/eci", icon: Target, description: "Executive Command Interface" },
  { name: "Builder", path: "/builder", icon: Plus, description: "Country builder tool" },
  { name: "Profile", path: "/profile", icon: Activity, description: "User profile settings" },
  { name: "Admin", path: "/admin", icon: Settings, description: "Admin panel" },
];

export const features = [
  { name: "Economic Analysis", path: "/dashboard", icon: BarChart3, description: "View detailed economic metrics and projections" },
  { name: "Strategic Planning", path: "/eci", icon: Target, description: "Access strategic planning tools" },
  { name: "Intelligence Reports", path: "/sdi", icon: Eye, description: "Strategic Defense Initiative reports" },
  { name: "Population Analytics", path: "/dashboard", icon: Activity, description: "Demographic and population insights" },
  { name: "Global Rankings", path: "/countries", icon: Crown, description: "Compare countries by various metrics" },
  { name: "Time Controls", path: "/admin", icon: Activity, description: "IxTime system management" },
];
