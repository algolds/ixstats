// Main CommandPalette props interface
export interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
  scrollY?: number;
}

// Branded string type helper for plugin & view identifiers
export type Brand<T, B extends string> = T & { readonly __brand: B };
export type PluginId = Brand<string, "PluginId">;

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
  metadata?: Record<string, unknown>;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

// View modes — includes plugin-provided views via template literal
export type BuiltinViewMode = "compact" | "search" | "notifications" | "settings" | "mycountry";
export type PluginViewMode = `plugin:${string}`;
export type ViewMode = BuiltinViewMode | PluginViewMode;

export type SearchFilter = "all" | "countries" | "commands" | "features" | "wiki";

// ── Plugin System Types ─────────────────────────────────────────────

/** Props passed to plugin-provided expanded views */
export interface DIViewProps<F = unknown, C = unknown> {
  onClose: () => void;
  onSwitchMode?: (mode: ViewMode) => void;
  filter?: F;
  context?: C;
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
export interface DIPlugin<F = unknown, C = unknown> {
  id: string;
  priority?: number;
  center?: React.ReactNode;
  actions?: DIAction[];
  expandedViews?: Record<string, React.ComponentType<DIViewProps<F, C>>>;
  badge?: DIBadge;
  accentColor?: string;
  stickyLabel?: string;
  filter?: F;
  context?: C;
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

export type CountrySummary = {
  id: string;
  name: string;
  slug?: string;
  flagUrl?: string | null;
  flag?: string | null;
  coatOfArmsUrl?: string;
  economicTier?: string;
  continent?: string;
  currentGdpPerCapita?: number | null;
};

export type CountriesData =
  | CountrySummary[]
  | {
      countries: CountrySummary[];
    };

/** Type guard to safely extract a list of country summaries from CountriesData */
export function extractCountriesList(data: CountriesData | undefined): CountrySummary[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.countries ?? [];
}

/** Type guard to check if a mode string is a plugin-provided view mode */
export function isPluginViewMode(mode: string): mode is PluginViewMode {
  return mode.startsWith("plugin:");
}

export interface SearchViewProps {
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  searchFilter: SearchFilter;
  setSearchFilter?: (filter: SearchFilter) => void;
  debouncedSearchQuery: string;
  searchResults: SearchResult[];
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
  activePlugin?: DIPlugin | null;
}
