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
  type: "country" | "command" | "feature" | "wiki";
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

// View modes — includes plugin-provided views via template literal
export type ViewMode =
  | "compact"
  | "search"
  | "notifications"
  | "settings"
  | "mycountry"
  | `plugin:${string}`;
export type SearchFilter = "all" | "countries" | "commands" | "features" | "wiki";

// ── Plugin System Types ─────────────────────────────────────────────

/** Props passed to plugin-provided expanded views */
export interface DIViewProps {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
  filter?: Record<string, any>;
  context?: any;
}

/** An action button a plugin can inject into the pill */
export interface DIAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number;
}

/** A badge indicator (colored dot) on the pill */
export interface DIBadge {
  color: string;
  pulse?: boolean;
}

/** A plugin registration object — pages call useDIPlugin() with this */
export interface DIPlugin {
  id: string;
  priority?: number;
  center?: React.ReactNode;
  actions?: DIAction[];
  expandedViews?: Record<string, React.ComponentType<DIViewProps>>;
  badge?: DIBadge;
  accentColor?: string;
  stickyLabel?: string;
  filter?: Record<string, any>;
  context?: any;
}

// Current time state interface
export interface CurrentTimeState {
  greeting: string;
  dateDisplay: string;
  timeDisplay: string;
  multiplier: number;
}

// Setup status type
export type SetupStatus = "loading" | "unauthenticated" | "needs-setup" | "complete";

// Component prop interfaces
export interface CompactViewProps {
  mode?: ViewMode;
  isSticky?: boolean;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  setIsUserInteracting: (interacting: boolean) => void;
  onSwitchMode: (mode: ViewMode) => void;
  scrollY?: number;
  activePlugin?: DIPlugin | null;
  // Plugin system props
  pluginCenter?: React.ReactNode;
  pluginActions?: DIAction[];
  pluginBadge?: DIBadge;
}

export type CountriesData =
  | Array<{
      id: string;
      name: string;
      slug?: string;
      flagUrl?: string;
      coatOfArmsUrl?: string;
      economicTier?: string;
      currentGdpPerCapita?: number | null;
    }>
  | {
      countries: Array<{
        id: string;
        name: string;
        slug?: string;
        flagUrl?: string;
        coatOfArmsUrl?: string;
        economicTier?: string;
        currentGdpPerCapita?: number | null;
      }>;
    };

export interface SearchViewProps {
  searchQuery: string;
  setSearchQuery?: (query: string) => void; // Made optional
  searchFilter: SearchFilter;
  setSearchFilter?: (filter: SearchFilter) => void; // Made optional
  debouncedSearchQuery: string;
  searchResults: SearchResult[];
  countriesData?: CountriesData; // Made optional as it might not always be present
  closeDropdown: () => void;
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
  onSwitchMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchFilter: SearchFilter;
  setSearchFilter: (filter: SearchFilter) => void;
  debouncedSearchQuery: string;
  searchResults: SearchResult[];
  countriesData?: CountriesData;
}
