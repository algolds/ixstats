// Main CommandPalette props interface
export interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
}

// User Profile interface
export interface UserProfile {
  id: string;
  countryId: string | null;
  country?: {
    id: string;
    name: string;
    currentGdpPerCapita: number | null;
  } | null;
}

// Search Result interface
export interface SearchResult {
  id: string;
  type: "country" | "command" | "feature";
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

// View modes
export type ViewMode = "compact" | "search" | "notifications" | "settings" | "cycling";
export type SearchFilter = "all" | "countries" | "commands" | "features";
export type TimeDisplayMode = 'time' | 'date' | 'both';

// Current time state interface
export interface CurrentTimeState {
  greeting: string;
  dateDisplay: string;
  timeDisplay: string;
  multiplier: number;
}

// Setup status type
export type SetupStatus = 'loading' | 'unauthenticated' | 'needs-setup' | 'complete';

// Component prop interfaces
export interface CompactViewProps {
  isSticky?: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsUserInteracting: (interacting: boolean) => void;
  timeDisplayMode: TimeDisplayMode;
  setTimeDisplayMode: (mode: TimeDisplayMode) => void;
  onSwitchMode: (mode: ViewMode) => void;
  scrollY?: number;
}

export interface SearchViewProps {
  onClose: () => void;
}

export interface NotificationsViewProps {
  onClose: () => void;
}

export interface SettingsViewProps {
  onClose: () => void;
}

export interface ExpandedViewProps {
  mode: ViewMode;
  onClose: () => void;
}