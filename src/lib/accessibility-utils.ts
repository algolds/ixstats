/**
 * Accessibility Utilities for IxStats
 *
 * Provides utility functions and constants for implementing comprehensive
 * accessibility features across the platform. Ensures WCAG 2.1 AA compliance.
 *
 * @fileoverview Accessibility utilities and helpers
 * @author IxStats Development Team
 * @since 2025-01-05
 * @version 1.0.0
 */

/**
 * Generates accessible IDs for form controls and their labels
 * @param prefix - Prefix for the ID (e.g., 'atomic-component', 'economic-input')
 * @returns Unique accessible ID
 */
export function generateAccessibleId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Standard ARIA labels for common IxStats interface elements
 */
export const ARIA_LABELS = {
  // Atomic Components
  ATOMIC_COMPONENT_SELECTOR: "Select atomic government component",
  ATOMIC_EFFECTIVENESS_DISPLAY: "Government effectiveness score display",
  ATOMIC_SYNERGY_INDICATOR: "Component synergy indicator",
  ATOMIC_CONFLICT_WARNING: "Component conflict warning",

  // Economic Systems
  ECONOMIC_INDICATOR: "Economic performance indicator",
  GDP_GROWTH_DISPLAY: "GDP growth rate display",
  TAX_EFFICIENCY_METER: "Tax collection efficiency meter",
  TRADE_PERFORMANCE: "International trade performance",

  // Dashboard Elements
  DASHBOARD_CARD: "Dashboard information card",
  PERFORMANCE_METRIC: "Performance metric display",
  TREND_CHART: "Performance trend chart",
  VITALITY_RING: "National vitality indicator ring",

  // Intelligence System
  INTELLIGENCE_ALERT: "Intelligence system alert",
  RECOMMENDATION_CARD: "AI recommendation card",
  RISK_INDICATOR: "Risk level indicator",
  OPPORTUNITY_HIGHLIGHT: "Opportunity highlight",

  // Navigation
  PRIMARY_NAVIGATION: "Primary navigation menu",
  SECTION_NAVIGATION: "Section navigation",
  BREADCRUMB_NAVIGATION: "Breadcrumb navigation",

  // Actions
  SUBMIT_FORM: "Submit form",
  CANCEL_ACTION: "Cancel current action",
  SAVE_CHANGES: "Save changes",
  DELETE_ITEM: "Delete item",
  EDIT_ITEM: "Edit item",
  VIEW_DETAILS: "View detailed information",
  CLOSE_MODAL: "Close modal dialog",
  EXPAND_SECTION: "Expand section",
  COLLAPSE_SECTION: "Collapse section",
} as const;

/**
 * Standard ARIA descriptions for complex interface elements
 */
export const ARIA_DESCRIPTIONS = {
  ATOMIC_COMPONENT_SELECTION:
    "Selecting this component will update government effectiveness, economic performance, and generate new intelligence insights",
  ECONOMIC_IMPACT_CALCULATION:
    "This metric is calculated in real-time based on your selected government components and their synergies",
  INTELLIGENCE_RECOMMENDATION:
    "AI-generated recommendation based on your current government configuration and performance metrics",
  PERFORMANCE_TREND: "Historical performance data showing trends over time with projections",
  SYNERGY_EXPLANATION:
    "These components work together to create enhanced effectiveness beyond their individual contributions",
} as const;

/**
 * Accessibility roles for custom components
 */
export const ARIA_ROLES = {
  DASHBOARD: "main",
  METRIC_DISPLAY: "status",
  ALERT_PANEL: "alert",
  PROGRESS_INDICATOR: "progressbar",
  TAB_PANEL: "tabpanel",
  DIALOG: "dialog",
  TOOLTIP: "tooltip",
  MENU: "menu",
  MENUITEM: "menuitem",
  BUTTON: "button",
  LINK: "link",
} as const;

/**
 * Keyboard navigation key codes for interactive elements
 */
export const KEYBOARD_KEYS = {
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  TAB: "Tab",
  HOME: "Home",
  END: "End",
} as const;

/**
 * Creates accessible props for interactive elements
 * @param type - Type of element ('button', 'link', 'form-control', etc.)
 * @param label - Accessible label
 * @param description - Optional extended description
 * @returns Object with accessibility props
 */
export function createAccessibleProps(
  type: "button" | "link" | "form-control" | "metric" | "chart",
  label: string,
  description?: string
) {
  const baseProps = {
    "aria-label": label,
    ...(description && { "aria-describedby": generateAccessibleId("desc") }),
  };

  switch (type) {
    case "button":
      return {
        ...baseProps,
        role: ARIA_ROLES.BUTTON,
        tabIndex: 0,
      };

    case "link":
      return {
        ...baseProps,
        role: ARIA_ROLES.LINK,
        tabIndex: 0,
      };

    case "form-control":
      return {
        ...baseProps,
        "aria-required": true,
        "aria-invalid": false,
      };

    case "metric":
      return {
        ...baseProps,
        role: ARIA_ROLES.METRIC_DISPLAY,
        "aria-live": "polite",
      };

    case "chart":
      return {
        ...baseProps,
        role: "img",
        "aria-live": "polite",
      };

    default:
      return baseProps;
  }
}

/**
 * Handles keyboard navigation for interactive elements
 * @param event - Keyboard event
 * @param onActivate - Function to call when element is activated
 * @param onEscape - Optional function to call on escape key
 */
export function handleKeyboardNavigation(
  event: React.KeyboardEvent,
  onActivate: () => void,
  onEscape?: () => void
) {
  switch (event.key) {
    case KEYBOARD_KEYS.ENTER:
    case KEYBOARD_KEYS.SPACE:
      event.preventDefault();
      onActivate();
      break;

    case KEYBOARD_KEYS.ESCAPE:
      if (onEscape) {
        event.preventDefault();
        onEscape();
      }
      break;
  }
}

/**
 * Focus management utilities
 */
export const FocusManager = {
  /**
   * Sets focus to an element by ID with error handling
   * @param elementId - ID of element to focus
   * @param delay - Optional delay before focusing (useful for modal opening)
   */
  focusElement(elementId: string, delay = 0) {
    setTimeout(() => {
      const element = document.getElementById(elementId);
      if (element && typeof element.focus === "function") {
        element.focus();
      }
    }, delay);
  },

  /**
   * Creates a focus trap for modal dialogs
   * @param containerElement - Container element for focus trap
   * @returns Cleanup function to remove focus trap
   */
  createFocusTrap(containerElement: HTMLElement): () => void {
    const focusableSelector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = containerElement.querySelectorAll(
      focusableSelector
    ) as NodeListOf<HTMLElement>;

    if (focusableElements.length === 0) return () => {};

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
        }
      }
    }

    containerElement.addEventListener("keydown", handleTabKey);
    firstElement.focus();

    return () => {
      containerElement.removeEventListener("keydown", handleTabKey);
    };
  },
};

/**
 * Validates color contrast for accessibility compliance
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns Contrast ratio and WCAG compliance level
 */
export function validateColorContrast(foreground: string, background: string) {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map((c) => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const fgRgb = hexToRgb(foreground);
  const bgRgb = hexToRgb(background);

  if (!fgRgb || !bgRgb) {
    return { ratio: 0, level: "invalid" };
  }

  const fgLuminance = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLuminance = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const ratio =
    (Math.max(fgLuminance, bgLuminance) + 0.05) / (Math.min(fgLuminance, bgLuminance) + 0.05);

  let level: "fail" | "aa" | "aaa" = "fail";
  if (ratio >= 7) level = "aaa";
  else if (ratio >= 4.5) level = "aa";

  return { ratio: Math.round(ratio * 100) / 100, level };
}

/**
 * Screen reader utilities
 */
export const ScreenReader = {
  /**
   * Announces a message to screen readers
   * @param message - Message to announce
   * @param priority - Priority level ('polite' or 'assertive')
   */
  announce(message: string, priority: "polite" | "assertive" = "polite") {
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", priority);
    announcement.setAttribute("aria-atomic", "true");
    announcement.style.position = "absolute";
    announcement.style.left = "-10000px";
    announcement.textContent = message;

    document.body.appendChild(announcement);

    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  },
};

/**
 * Live region manager for dynamic content updates
 */
export class LiveRegionManager {
  private static instance: LiveRegionManager;
  private liveRegion: HTMLElement | null = null;

  static getInstance(): LiveRegionManager {
    if (!LiveRegionManager.instance) {
      LiveRegionManager.instance = new LiveRegionManager();
    }
    return LiveRegionManager.instance;
  }

  private constructor() {
    this.createLiveRegion();
  }

  private createLiveRegion() {
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("aria-atomic", "false");
    this.liveRegion.style.position = "absolute";
    this.liveRegion.style.left = "-10000px";
    this.liveRegion.style.width = "1px";
    this.liveRegion.style.height = "1px";
    this.liveRegion.style.overflow = "hidden";

    document.body.appendChild(this.liveRegion);
  }

  /**
   * Announces dynamic content changes
   * @param message - Message to announce
   */
  announce(message: string) {
    if (this.liveRegion) {
      this.liveRegion.textContent = message;

      // Clear after announcement
      setTimeout(() => {
        if (this.liveRegion) {
          this.liveRegion.textContent = "";
        }
      }, 500);
    }
  }
}

/**
 * Motion preference utilities
 */
export const MotionPreferences = {
  /**
   * Checks if user prefers reduced motion
   * @returns Boolean indicating reduced motion preference
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  /**
   * Applies motion preferences to animation configuration
   * @param normalDuration - Normal animation duration
   * @param reducedDuration - Reduced animation duration (or 0 to disable)
   * @returns Appropriate duration based on user preferences
   */
  getDuration(normalDuration: number, reducedDuration: number = 0): number {
    return this.prefersReducedMotion() ? reducedDuration : normalDuration;
  },
};

export default {
  generateAccessibleId,
  createAccessibleProps,
  handleKeyboardNavigation,
  FocusManager,
  validateColorContrast,
  ScreenReader,
  LiveRegionManager,
  MotionPreferences,
  ARIA_LABELS,
  ARIA_DESCRIPTIONS,
  ARIA_ROLES,
  KEYBOARD_KEYS,
};
