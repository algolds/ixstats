import type { AppDefinition } from "~/lib/navigation/app-sections";

export interface CommandPaletteProps {
  className?: string;
  trayApps?: readonly AppDefinition[];
  searchApps?: readonly AppDefinition[];
}

// Search Result interface
export interface SearchResult {
  id: string;
  type: "country" | "realm" | "command" | "wiki";
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

// View modes — includes plugin-provided views via template literal
type BuiltinViewMode = "compact" | "search" | "notifications" | "settings" | "mycountry";
type PluginViewMode = `plugin:${string}`;
export type ViewMode = BuiltinViewMode | PluginViewMode;

export type SearchFilter = "all" | "wiki" | "countries" | "realms" | "commands";

// Plugin System Types

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
  onClick?: () => void;
  /** Opens `plugin:${pluginView}` when clicked if `onClick` is omitted. */
  pluginView?: string;
  badge?: number;
}

/** A badge indicator (colored dot) on the pill */
interface DIBadge {
  color: string;
}

/** A command contributed to Halo Search by the active page plugin ("On this page"). */
export interface PluginCommand {
  key: string;
  title: string;
  description?: string;
  keywords?: readonly string[];
  icon?: React.ComponentType<{ className?: string }>;
  /** In-page stateful callback (e.g. BuilderHalo section jump, WikiHalo heading jump or narrator toggle). */
  run?: () => void;
  /** Same-origin route navigated via `navigateWithBasePath(path, router)`. */
  path?: string;
  /** Plugin expanded-view key opened as `plugin:${pluginView}` (e.g. `"sports-live"`). */
  pluginView?: string;
}

/** A plugin registration object — pages call useDIPlugin() with this */
export interface DIPlugin<F = unknown, C = unknown> {
  id: string;
  priority?: number;
  center?: React.ReactNode;
  centerActions?: React.ReactNode;
  // oxlint-disable-next-line typescript/no-explicit-any
  expandedViews?: Record<string, React.ComponentType<DIViewProps<any, any>>>;
  badge?: DIBadge;
  actions?: DIAction[];
  commands?: readonly PluginCommand[];
  /**
   * Places or records the page can find for a query (two characters or more), listed after its commands.
   * Already matched by the source, so Halo shows them as returned.
   */
  search?: (query: string) => Promise<readonly PluginCommand[]>;
  accentColor?: string;
  filter?: F;
  context?: C;
}

// Current time state interface
// Setup status type
// Component prop interfaces
export interface CompactViewProps {
  mode?: ViewMode;
  isNavLoading?: boolean;
  onSwitchMode: (mode: ViewMode, triggerOverride?: string) => void;
  activePlugin?: DIPlugin | null;
  // Plugin system props
  pluginCenter?: React.ReactNode;
  pluginCenterActions?: React.ReactNode;
  pluginActions?: DIAction[];
  pluginBadge?: DIBadge;
  // Chromeless quick-navigation tray trigger
  showNavTrayTrigger?: boolean;
  navTrayOpen?: boolean;
  onToggleNavTray?: () => void;
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

export interface SearchViewProps {
  searchQuery: string;
  setSearchQuery?: (query: string) => void;
  searchFilter: SearchFilter;
  setSearchFilter?: (filter: SearchFilter) => void;
  debouncedSearchQuery: string;
  searchResults: SearchResult[];
  /** True while a debounce, the countries list or the wiki query is still in flight. */
  isSearchPending?: boolean;
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
  isSearchPending?: boolean;
  countriesData?: CountriesData;
  activePlugin?: DIPlugin | null;
}
