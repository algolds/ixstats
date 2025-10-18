/**
 * useDashboardState Hook
 *
 * Centralized state management for the dashboard, including:
 * - Card expansion states with cookie persistence
 * - Global animation states (collapse, ripple)
 * - Focus management for card interactions
 */

import { useState, useEffect } from "react";

export interface DashboardState {
  // Expansion states
  expandedCards: Set<string>;
  setExpandedCards: (cards: Set<string>) => void;
  toggleCardExpansion: (cardId: string) => void;

  // Individual card expansions (legacy support)
  isEciExpanded: boolean;
  setIsEciExpanded: (value: boolean) => void;
  toggleEciExpansion: () => void;

  isSdiExpanded: boolean;
  setIsSdiExpanded: (value: boolean) => void;
  toggleSdiExpansion: () => void;

  // Global card states
  isGlobalCardSlid: boolean;
  setIsGlobalCardSlid: (value: boolean) => void;
  isGlobalCardHovered: boolean;
  setIsGlobalCardHovered: (value: boolean) => void;
  isGlobalCollapsing: boolean;
  setIsGlobalCollapsing: (value: boolean) => void;
  isRippleActive: boolean;
  setIsRippleActive: (value: boolean) => void;
  collapseGlobalCard: () => void;

  // Focus management
  focusedCard: string | null;
  setFocusedCard: (cardId: string | null) => void;

  // Activity popover
  activityPopoverOpen: number | null;
  setActivityPopoverOpen: (index: number | null) => void;

  // Command palette
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
}

export function useDashboardState(): DashboardState {
  // Expansion states with cookie persistence
  const [expandedCards, setExpandedCardsState] = useState<Set<string>>(new Set());

  // Individual expansions
  const [isEciExpanded, setIsEciExpanded] = useState(false);
  const [isSdiExpanded, setIsSdiExpanded] = useState(false);

  // Global card animation states
  const [isGlobalCardSlid, setIsGlobalCardSlid] = useState(false);
  const [isGlobalCardHovered, setIsGlobalCardHovered] = useState(false);
  const [isGlobalCollapsing, setIsGlobalCollapsing] = useState(false);
  const [isRippleActive, setIsRippleActive] = useState(false);

  // Focus and interaction states
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [activityPopoverOpen, setActivityPopoverOpen] = useState<number | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  // Load expanded cards from cookie on mount
  useEffect(() => {
    const savedExpanded = document.cookie
      .split('; ')
      .find(row => row.startsWith('dashboardExpanded='))
      ?.split('=')[1];

    if (savedExpanded) {
      try {
        const expanded = JSON.parse(decodeURIComponent(savedExpanded));
        setExpandedCardsState(new Set(expanded));
      } catch (e) {
        console.warn('Failed to parse saved expanded cards:', e);
      }
    }
  }, []);

  // Save expanded cards to cookie whenever it changes
  useEffect(() => {
    const expandedArray = Array.from(expandedCards);
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
    document.cookie = `dashboardExpanded=${encodeURIComponent(JSON.stringify(expandedArray))}; expires=${expires.toUTCString()}; path=/`;
  }, [expandedCards]);

  // Helper to toggle individual card expansion
  const toggleCardExpansion = (cardId: string) => {
    const newExpanded = new Set(expandedCards);
    if (newExpanded.has(cardId)) {
      newExpanded.delete(cardId);
    } else {
      newExpanded.add(cardId);
    }
    setExpandedCardsState(newExpanded);
  };

  // Individual toggle functions
  const toggleEciExpansion = () => {
    setIsEciExpanded(prev => !prev);
  };

  const toggleSdiExpansion = () => {
    setIsSdiExpanded(prev => !prev);
  };

  // Apple Intelligence-style collapse animation for global card
  const collapseGlobalCard = () => {
    // Start ripple effect on MyCountry card
    setIsRippleActive(true);

    // Phase 1: Begin visual collapse
    setIsGlobalCollapsing(true);

    // Phase 2: Complete merge after ripple
    setTimeout(() => {
      setIsGlobalCardSlid(true);
      setIsRippleActive(false);

      // Phase 3: Cleanup
      setTimeout(() => {
        setIsGlobalCollapsing(false);
      }, 600);
    }, 1200); // Align with new ripple timing
  };

  // Wrapper for setExpandedCards that accepts a Set
  const setExpandedCards = (cards: Set<string>) => {
    setExpandedCardsState(cards);
  };

  return {
    expandedCards,
    setExpandedCards,
    toggleCardExpansion,
    isEciExpanded,
    setIsEciExpanded,
    toggleEciExpansion,
    isSdiExpanded,
    setIsSdiExpanded,
    toggleSdiExpansion,
    isGlobalCardSlid,
    setIsGlobalCardSlid,
    isGlobalCardHovered,
    setIsGlobalCardHovered,
    isGlobalCollapsing,
    setIsGlobalCollapsing,
    isRippleActive,
    setIsRippleActive,
    collapseGlobalCard,
    focusedCard,
    setFocusedCard,
    activityPopoverOpen,
    setActivityPopoverOpen,
    commandOpen,
    setCommandOpen
  };
}
