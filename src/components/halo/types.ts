// Main CommandPalette props interface
// Branded string type helper for plugin & view identifiers
// User Profile interface
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
type BuiltinViewMode = "compact" | "search" | "notifications" | "settings" | "mycountry";
type PluginViewMode = `plugin:${string}`;
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
interface DIAction {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  badge?: number;
}

/** A badge indicator (colored dot) on the pill */
interface DIBadge {
  color: string;
  pulse?: boolean;
}

/** A plugin registration object — pages call useDIPlugin() with this */
export interface DIPlugin<F = unknown, C = unknown> {
  id: string;
  priority?: number;
  center?: React.ReactNode;
  // oxlint-disable-next-line typescript/no-explicit-any
  expandedViews?: Record<string, React.ComponentType<DIViewProps<any, any>>>;
  badge?: DIBadge;
  actions?: DIAction[];
  accentColor?: string;
  stickyLabel?: string;
  filter?: F;
  context?: C;
}

// Current time state interface
// Setup status type
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

type CountrySummary = {
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
