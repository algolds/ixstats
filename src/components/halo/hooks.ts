import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Globe, BarChart3, Settings, Activity, TrendingUp, Crown, Gauge, Eye, Target, Plus, Home, LogIn, LogOut, BookOpen, History, Shuffle, Search } from "lucide-react";
import { createAbsoluteUrl } from "~/lib/utils";
import { OnomaNavIcon } from "~/app/labs/onoma/components/shared/OnomaBrandLogo";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { usePathname } from "next/navigation";
import type { ViewMode, SearchFilter, SearchResult } from "./types";
import { extractCountriesList } from "./types";
import { useActiveDIPlugin } from "./plugin-context";

// Development-only logger to suppress Dynamic Island logs in production
const devLog = (...args: unknown[]) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(...args);
  }
};

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
        group: "Navigation",
        items: [
          {
            title: "Go to Countries",
            icon: Globe,
            action: () => (window.location.href = createAbsoluteUrl("/countries/new")),
          },
          {
            title: "View Analytics",
            icon: BarChart3,
            action: () => (window.location.href = createAbsoluteUrl("/analytics")),
          },
          {
            title: "Open Settings",
            icon: Settings,
            action: () => (window.location.href = createAbsoluteUrl("/settings")),
          },
        ],
      },
      {
        group: "Quick Actions",
        items: [
          { title: "Refresh Data", icon: Activity, action: () => window.location.reload() },
          {
            title: "Export Statistics",
            icon: TrendingUp,
            action: () => console.log("Export statistics"),
          },
        ],
      },
    ];

    if (userProfile?.countryId) {
      baseItems.splice(1, 0, {
        group: "Dashboard Sections",
        items: [
          {
            title: "Go to MyCountry",
            icon: Crown,
            action: () => (window.location.href = createAbsoluteUrl("/mycountry")),
          },
          {
            title: "Open ECI Suite",
            icon: Gauge,
            action: () => (window.location.href = createAbsoluteUrl("/eci")),
          },
          {
            title: "Access SDI Intelligence",
            icon: Eye,
            action: () => (window.location.href = createAbsoluteUrl("/sdi")),
          },
        ],
      });
    } else {
      baseItems.splice(1, 0, {
        group: "Setup Required",
        items: [
          {
            title: "Complete Setup",
            icon: Target,
            action: () => (window.location.href = createAbsoluteUrl("/setup")),
          },
          {
            title: "Configure Settings",
            icon: Settings,
            action: () => (window.location.href = createAbsoluteUrl("/settings")),
          },
        ],
      });
    }

    return baseItems;
  }, [userProfile?.countryId]);
}

// Shared state management hook for Dynamic Island
export function useDynamicIslandState() {
  const { user, isLoaded, isSignedIn } = useUser();
  const pathname = usePathname();
  const activePlugin = useActiveDIPlugin();
  const isWikiActive = activePlugin?.id === "wiki";
  const [mode, setMode] = useState<ViewMode>("compact");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<ViewMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [isUserInteracting, setIsUserInteracting] = useState(false);

  // Lazy-load countries only when search is expanded (not on mount)
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 30 * 60 * 1000, enabled: isExpanded }
  );

  // Get user profile for contextual search
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Wiki full-text search — only fires when query is active and relevant filter
  const { data: wikiSearchData } = api.wikios.advancedSearch.useQuery(
    { query: debouncedSearchQuery, limit: searchFilter === "wiki" ? 12 : 5 },
    {
      enabled:
        debouncedSearchQuery.length >= 2 && (searchFilter === "all" || searchFilter === "wiki"),
      staleTime: 60_000,
    }
  );

  // Enhanced keyboard shortcuts with debouncing to prevent duplicates
  const [isProcessingShortcut, setIsProcessingShortcut] = useState(false);
  const shortcutTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastTabTimestampRef = useRef<number>(0);

  // Debounce search query for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150); // 150ms debounce — fast enough for command palette feel

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Timeout cleanup refs
  const interactionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const prevActivePluginIdRef = useRef<string | undefined>(undefined);

  // Mode switching with dropdown behavior
  const switchMode = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      setIsUserInteracting(true);
      window.dispatchEvent(new CustomEvent("ix:di-mode-changed", { detail: { mode: newMode } }));

      // Clear existing timeout before setting new one
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }

      // Reset user interaction after 30 seconds
      interactionTimeoutRef.current = setTimeout(() => setIsUserInteracting(false), 30000);

      const isExpandedMode =
        newMode === "search" ||
        newMode === "notifications" ||
        newMode === "settings" ||
        newMode === "mycountry" ||
        newMode.startsWith("plugin:");

      if (isExpandedMode) {
        setIsExpanded(true);
        setExpandedMode(newMode);
      } else {
        setIsExpanded(false);
      }

      if (newMode === "search") {
        let isDynamicWikiSearchEnabled = true;
        try {
          const stored = localStorage.getItem("wikios:dynamicSearchWiki");
          if (stored !== null) {
            isDynamicWikiSearchEnabled = stored === "true";
          }
        } catch {
          // SSR or storage access error
        }
        if (isDynamicWikiSearchEnabled && isWikiActive) {
          setSearchFilter("wiki");
        } else {
          setSearchFilter("all");
        }
      }
    },
    [isWikiActive, setSearchFilter]
  );

  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: ViewMode }>;
      if (customEvent.detail?.mode) {
        switchMode(customEvent.detail.mode);
      }
    };
    window.addEventListener("ix:switch-di-mode", handleSwitch);
    return () => {
      window.removeEventListener("ix:switch-di-mode", handleSwitch);
    };
  }, [switchMode]);

  // Pre-compute lowercase search indexes for static data (avoids repeated .toLowerCase() per keystroke)
  const commandIndex = useMemo(() => {
    const ctx = [...commands];
    if (!isSignedIn || !user) {
      ctx.push(
        {
          name: "Sign In",
          path: "/sign-in",
          icon: LogIn,
          description: "Sign in to your IxStats account",
        },
        {
          name: "Sign Up",
          path: "/sign-up",
          icon: LogIn,
          description: "Create a new IxStats account",
        }
      );
    } else {
      ctx.push({
        name: "Sign Out",
        path: "/sign-out",
        icon: LogOut,
        description: "Sign out of your account",
      });
    }
    if (pathname !== "/") {
      ctx.unshift({
        name: "Home",
        path: "/",
        icon: Home,
        description: "Return to IxStats homepage",
      });
    }
    if (pathname?.includes("/countries/") && !pathname?.includes("/countries/new")) {
      const cid = pathname.split("/countries/")[1]?.split("/")[0];
      if (cid) {
        ctx.push(
          {
            name: "Country Profile",
            path: `/countries/${cid}/profile`,
            icon: Globe,
            description: "View detailed country profile",
          },
          {
            name: "Economic Modeling",
            path: `/countries/${cid}/modeling`,
            icon: BarChart3,
            description: "Economic modeling and analysis",
          }
        );
      }
    }
    return ctx.map((c) => ({ ...c, _lower: `${c.name}\t${c.description}`.toLowerCase() }));
  }, [isSignedIn, user, pathname]);

  const featureIndex = useMemo(
    () => features.map((f) => ({ ...f, _lower: `${f.name}\t${f.description}`.toLowerCase() })),
    []
  );

  const countryIndex = useMemo(() => {
    const list = extractCountriesList(countriesData as any);
    return list.map((c) => ({ ...c, _lower: c.name.toLowerCase() }));
  }, [countriesData]);

  // Generate search results based on query and filter
  const searchResults: SearchResult[] = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];

    const query = debouncedSearchQuery.toLowerCase();

    // Separate matches by category
    const matchedCountries: SearchResult[] = [];
    const matchedCommands: SearchResult[] = [];
    const matchedFeatures: SearchResult[] = [];
    const matchedWiki: SearchResult[] = [];

    // Gather Countries
    if (searchFilter === "all" || searchFilter === "countries") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const country of countryIndex) {
        if (country._lower.includes(query)) {
          const slug = country.slug ?? country.id;
          matchedCountries.push({
            id: `country-${country.id}`,
            type: "country",
            title: country.name,
            subtitle: `Economic Tier: ${country.economicTier || "Unknown"}`,
            description: country.economicTier
              ? `Tier: ${country.economicTier}`
              : "View country profile",
            metadata: {
              countryName: country.name,
              flagUrl: (country as any).flagUrl || (country as any).flag || undefined,
              economicTier: country.economicTier,
            },
            action: () => (window.location.href = createAbsoluteUrl(`/countries/${slug}`)),
          });
        }
        if (matchedCountries.length >= limit) break;
      }
    }

    // Gather Commands
    if (searchFilter === "all" || searchFilter === "commands") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const cmd of commandIndex) {
        if (cmd._lower.includes(query)) {
          matchedCommands.push({
            id: `command-${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
            type: "command",
            title: cmd.name,
            description: cmd.description,
            icon: cmd.icon,
            action: () => {
              window.location.href = createAbsoluteUrl(cmd.path === "/sign-out" ? "/" : cmd.path);
            },
          });
        }
        if (matchedCommands.length >= limit) break;
      }
    }

    // Gather Features
    if (searchFilter === "all" || searchFilter === "features") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const feat of featureIndex) {
        if (feat._lower.includes(query)) {
          matchedFeatures.push({
            id: `feature-${feat.name.toLowerCase().replace(/\s+/g, "-")}`,
            type: "feature",
            title: feat.name,
            description: feat.description,
            icon: feat.icon,
            action: () => {
              if (feat.path === "#refresh") {
                window.location.reload();
                return;
              }
              if (feat.path === "#search") {
                (
                  document.querySelector('[data-command-palette-search="true"]') as HTMLInputElement
                )?.focus();
                return;
              }
              if (feat.path === "#notifications") {
                switchMode("notifications");
                return;
              }
              window.location.href = createAbsoluteUrl(feat.path);
            },
          });
        }
        if (matchedFeatures.length >= limit) break;
      }
    }

    // Gather Wiki
    if (searchFilter === "all" || searchFilter === "wiki") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const article of wikiSearchData?.results ?? []) {
        matchedWiki.push({
          id: `wiki-${article.title}`,
          type: "wiki",
          title: article.title,
          description: article.snippet
            ? article.snippet.replace(/<[^>]*>/g, "").slice(0, 120)
            : "Wiki article",
          icon: BookOpen,
          action: () => {
            window.location.href = createAbsoluteUrl(
              `/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`
            );
          },
        });
        if (matchedWiki.length >= limit) break;
      }
    }

    // Combine and order results
    let results: SearchResult[] = [];
    if (searchFilter === "all") {
      if (isWikiActive) {
        // Prepend Wiki articles when on a wiki page
        results = [...matchedWiki, ...matchedCountries, ...matchedCommands, ...matchedFeatures];
      } else {
        // Default combined ordering
        results = [...matchedCountries, ...matchedCommands, ...matchedFeatures, ...matchedWiki];
      }
    } else {
      // Single category filter mode
      results = [...matchedCountries, ...matchedCommands, ...matchedFeatures, ...matchedWiki];
    }

    return results.slice(0, 12);
  }, [
    debouncedSearchQuery,
    searchFilter,
    countryIndex,
    commandIndex,
    featureIndex,
    switchMode,
    wikiSearchData,
    isWikiActive,
  ]);

  // Cycling timeout and logic removed in favor of static date display

  // When active plugin changes, default expanded mode to plugin view
  useEffect(() => {
    const pluginIdChanged = activePlugin?.id !== prevActivePluginIdRef.current;
    prevActivePluginIdRef.current = activePlugin?.id;

    if (pluginIdChanged && activePlugin?.expandedViews) {
      const firstViewKey = Object.keys(activePlugin.expandedViews)[0];
      if (firstViewKey) {
        setExpandedMode(`plugin:${firstViewKey}`);
      }
    } else if (!activePlugin) {
      // If the active plugin does not have expanded views and we are currently in a plugin mode, collapse!
      if (typeof mode === "string" && mode.startsWith("plugin:")) {
        setMode("compact");
        setIsExpanded(false);
      }
    }
  }, [activePlugin, setIsExpanded, setMode, mode]);

  // Forum pages use their own ForumLayout sidebar — no DI forum mode needed.

  // Enhanced GLOBAL keyboard shortcuts - work everywhere
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent duplicate processing
      if (isProcessingShortcut) {
        e.preventDefault();
        return;
      }

      // Only skip shortcuts if user is typing in inputs (except search inputs)
      const activeElement = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.closest('[contenteditable="true"]') != null ||
        activeElement?.closest(".cm-editor") != null ||
        activeElement?.closest("[data-slate-editor]") != null;

      // Debug active element
      devLog(
        "[DynamicIsland] Key event - key:",
        e.key,
        "activeElement:",
        activeElement?.tagName,
        "id:",
        activeElement?.id,
        "data-attr:",
        activeElement?.getAttribute("data-command-palette-search")
      );

      // Allow typing in our search inputs or command palette - DO NOT INTERCEPT REGULAR KEYS
      const isOurSearchInput =
        activeElement?.closest("[data-command-palette-search]") ||
        activeElement?.closest("[data-command-palette]");
      const hasSearchAttribute = activeElement?.hasAttribute("data-command-palette-search");

      devLog(
        "[DynamicIsland] Search input detection - isOurSearchInput:",
        isOurSearchInput,
        "hasSearchAttribute:",
        hasSearchAttribute
      );

      // If we're typing in our search input and it's NOT a shortcut key, let it through
      if ((isOurSearchInput || hasSearchAttribute) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        devLog("[DynamicIsland] ALLOWING typing in search input, key:", e.key);
        return; // Don't intercept regular typing
      }

      devLog("[DynamicIsland] INTERCEPTING key:", e.key);

      // GLOBAL SHORTCUT: Cmd+K / Ctrl+K - Always works unless typing in other inputs
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        devLog("[DynamicIsland] Cmd+K detected, mode:", mode);
        if (!isInputFocused || isOurSearchInput) {
          devLog("[DynamicIsland] Processing Cmd+K shortcut");
          e.preventDefault();
          e.stopPropagation();

          // Don't prevent further processing if we're already processing
          if (isProcessingShortcut) {
            devLog("[DynamicIsland] Already processing, ignoring");
            return;
          }
          setIsProcessingShortcut(true);

          if (mode === "search") {
            devLog("[DynamicIsland] Closing search mode");
            // Already in search mode, close it
            switchMode("compact");
          } else {
            devLog("[DynamicIsland] Opening search mode");
            // Switch to search mode - focus will be handled by SearchView component
            switchMode("search");
          }

          // Clear processing flag after animation
          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => {
            setIsProcessingShortcut(false);
          }, 300);
        } else {
          devLog("[DynamicIsland] Input focused, ignoring Cmd+K");
        }
        return;
      }

      // Other shortcuts only work when not in other inputs
      if (isInputFocused && !isOurSearchInput && e.key !== "Escape") {
        return;
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "notifications" ? "compact" : "notifications");

            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => {
              setIsProcessingShortcut(false);
            }, 500);
            break;
          case ",":
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
      if (e.key === "Tab" && mode === "search" && !isProcessingShortcut && !isInputFocused) {
        e.preventDefault();
        const filters: SearchFilter[] = ["all", "countries", "commands", "features"];
        const currentIndex = filters.indexOf(searchFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        const nextFilter = filters[nextIndex];
        if (nextFilter) {
          setSearchFilter(nextFilter);
        }
      }

      // Tab (no modifiers, not in input) — wiki mode toggle only
      // Only activates when wiki plugin is active.
      // Double-tap Tab within 400ms on wiki — enter editor mode
      if (
        e.key === "Tab" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !isInputFocused &&
        mode !== "search" &&
        !isProcessingShortcut &&
        isWikiActive
      ) {
        e.preventDefault();
        e.stopPropagation();

        const now = Date.now();
        const timeSinceLastTab = now - (lastTabTimestampRef.current ?? 0);
        lastTabTimestampRef.current = now;

        if (timeSinceLastTab < 400 && mode === "plugin:wiki") {
          // Double-tap on wiki: close wiki mode
          setIsProcessingShortcut(true);
          switchMode("compact");
          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => {
            setIsProcessingShortcut(false);
          }, 500);
        } else {
          // Single tap: toggle wiki mode
          setIsProcessingShortcut(true);
          switchMode(mode === "plugin:wiki" ? "compact" : "plugin:wiki");
          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => {
            setIsProcessingShortcut(false);
          }, 500);
        }
      }

      if (e.key === "Escape" && !isProcessingShortcut && !isInputFocused) {
        e.preventDefault();
        if (mode === "search" && searchQuery) {
          setSearchQuery("");
          setSearchFilter("all");
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
    window.addEventListener("keydown", handleKeyPress, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyPress, { capture: true });
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, switchMode, searchFilter, searchQuery, isProcessingShortcut]);

  // Tour integration: react to step transitions from HaloTourContext
  useEffect(() => {
    const handleTourStep = (e: Event) => {
      const customEvent = e as CustomEvent<{ step: number; active: boolean }>;
      if (!customEvent.detail || !customEvent.detail.active) return;

      const { step } = customEvent.detail;
      switch (step) {
        case 1:
          switchMode("compact");
          break;
        case 2:
          switchMode("mycountry");
          break;
        case 3:
          switchMode("compact");
          // Trigger mock toast via non-hook companion function in useNotify
          import("~/hooks/useNotify")
            .then(({ notifyFromStore }) => {
              notifyFromStore({
                title: "Security Operations Notice",
                message: "Border patrol units have completed routine defense audits in Sector 7.",
                type: "warning",
                priority: "critical",
                category: "defense",
              });
            })
            .catch(console.error);
          break;
        case 4:
          switchMode("mycountry");
          break;
        case 5:
          switchMode("settings");
          break;
      }
    };

    window.addEventListener("ix:halo-tour-step", handleTourStep);
    return () => {
      window.removeEventListener("ix:halo-tour-step", handleTourStep);
    };
  }, [switchMode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      if (shortcutTimeoutRef.current) {
        clearTimeout(shortcutTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    isUserInteracting,
    searchResults,
    countriesData,

    // Actions
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    switchMode,
  };
}

// Enhanced static data for commands and features - comprehensive and up-to-date
export const commands = [
  // Core pages
  {
    name: "Dashboard",
    path: "/dashboard",
    icon: BarChart3,
    description: "Main analytics dashboard with economic overview",
  },
  {
    name: "Countries",
    path: "/countries",
    icon: Globe,
    description: "Browse and explore all world countries",
  },
  {
    name: "Explore Countries",
    path: "/explore",
    icon: Globe,
    description: "Advanced country exploration and discovery",
  },
  {
    name: "MyCountry®",
    path: "/mycountry",
    icon: Crown,
    description: "Your national dashboard and executive command center",
  },
  {
    name: "MyCountry Editor",
    path: "/mycountry/editor",
    icon: Crown,
    description: "Edit and customize your country profile",
  },

  // Intelligence & Strategic Systems
  {
    name: "ECI Suite",
    path: "/eci",
    icon: Gauge,
    description: "Economic Command Interface and strategic tools",
  },
  {
    name: "ECI Focus",
    path: "/eci/focus",
    icon: Target,
    description: "Focused ECI analysis and planning",
  },
  {
    name: "SDI Intelligence",
    path: "/sdi",
    icon: Eye,
    description: "Strategic Defense Initiative and intelligence reports",
  },
  {
    name: "SDI Diplomatic",
    path: "/sdi/diplomatic",
    icon: Eye,
    description: "Diplomatic intelligence and relations",
  },

  // Knowledge & Communication
  {
    name: "ThinkPages",
    path: "/dashboard",
    icon: TrendingUp,
    description: "Knowledge management and collaborative thinking",
  },
  {
    name: "IxWiki",
    path: "/wiki/Main_Page",
    icon: BookOpen,
    description: "IxWiki main page (WikiOS)",
  },
  {
    name: "Wiki Recent Changes",
    path: "/wiki/recent-changes",
    icon: History,
    description: "Latest wiki edits and activity",
  },
  {
    name: "Wiki Random Article",
    path: "/wiki/random",
    icon: Shuffle,
    description: "Discover a random wiki article",
  },
  {
    name: "Wiki Search",
    path: "/wiki/search",
    icon: Search,
    description: "Search wiki articles",
  },

  // Tools & Creation
  {
    name: "Country Builder",
    path: "/builder",
    icon: Plus,
    description: "Create and design your own country",
  },
  {
    name: "Import Tool",
    path: "/builder/import",
    icon: Plus,
    description: "Import country data from external sources",
  },
  {
    name: "Trading Cards",
    path: "/vault/cards",
    icon: Activity,
    description: "Collect and trade country cards",
  },

  // User & Admin
  {
    name: "Account Settings",
    path: "/settings",
    icon: Settings,
    description: "Manage your account and preferences",
  },
  {
    name: "Setup Wizard",
    path: "/setup",
    icon: Target,
    description: "Complete initial account and country setup",
  },
  {
    name: "Admin Panel",
    path: "/admin",
    icon: Settings,
    description: "Administrative tools and controls",
  },
  {
    name: "Storyteller Dashboard",
    path: "/dm-dashboard",
    icon: Settings,
    description: "Storyteller administrative dashboard",
  },

  // Labs & Generators (only built routes; others 404)
  {
    name: "Onoma",
    path: "/labs/onoma",
    icon: OnomaNavIcon,
    description: "Linguistic Engine",
  },
];

export const features = [
  // Dashboard & Analytics
  {
    name: "Economic Analysis",
    path: "/dashboard",
    icon: BarChart3,
    description: "Detailed economic metrics, GDP, and financial projections",
  },
  {
    name: "Population Analytics",
    path: "/dashboard",
    icon: Activity,
    description: "Demographics, population trends, and social statistics",
  },
  {
    name: "Global Rankings",
    path: "/countries",
    icon: Crown,
    description: "Compare countries by economic tier and performance",
  },
  {
    name: "Economic Modeling",
    path: "/dashboard",
    icon: BarChart3,
    description: "Advanced economic forecasting and scenario modeling",
  },

  // MyCountry Intelligence System
  {
    name: "Executive Dashboard",
    path: "/mycountry",
    icon: Crown,
    description: "National command center with real-time intelligence",
  },
  {
    name: "Country Profile Editor",
    path: "/mycountry/editor",
    icon: Crown,
    description: "Customize your nation's profile and settings",
  },
  {
    name: "Economic Overview",
    path: "/mycountry",
    icon: TrendingUp,
    description: "Your country's economic performance and growth",
  },
  {
    name: "National Intelligence",
    path: "/mycountry",
    icon: Eye,
    description: "Comprehensive national intelligence briefings",
  },

  // Strategic Systems
  {
    name: "Strategic Planning",
    path: "/eci",
    icon: Gauge,
    description: "Long-term strategic planning and policy tools",
  },
  {
    name: "Focus Areas",
    path: "/eci/focus",
    icon: Target,
    description: "Strategic focus management and priority setting",
  },
  {
    name: "Intelligence Reports",
    path: "/sdi",
    icon: Eye,
    description: "Strategic defense and intelligence analysis",
  },
  {
    name: "Diplomatic Relations",
    path: "/sdi/diplomatic",
    icon: Eye,
    description: "International diplomatic intelligence and analysis",
  },

  // Country Discovery & Analysis
  {
    name: "Country Exploration",
    path: "/countries",
    icon: Globe,
    description: "Discover and analyze countries worldwide",
  },
  {
    name: "Advanced Search",
    path: "/explore",
    icon: Globe,
    description: "Advanced country search with filtering and comparison",
  },
  {
    name: "Country Profiles",
    path: "/countries",
    icon: Globe,
    description: "Detailed individual country analysis and data",
  },
  {
    name: "Economic Comparison",
    path: "/countries",
    icon: BarChart3,
    description: "Compare economic metrics across nations",
  },

  // Knowledge & Documentation
  {
    name: "Knowledge Management",
    path: "/dashboard",
    icon: TrendingUp,
    description: "Collaborative wiki and documentation system",
  },
  {
    name: "Wiki Integration",
    path: "/wiki",
    icon: Activity,
    description: "Access integrated IxWiki knowledge base",
  },
  {
    name: "Documentation",
    path: "/dashboard",
    icon: Activity,
    description: "Platform documentation and guides",
  },

  // Content Creation & Tools
  {
    name: "Country Creation",
    path: "/builder",
    icon: Plus,
    description: "Build and design custom countries from scratch",
  },
  {
    name: "Data Import",
    path: "/builder/import",
    icon: Plus,
    description: "Import country data from external wiki sources",
  },
  {
    name: "Trading Cards",
    path: "/vault/cards",
    icon: Activity,
    description: "Country trading card collection and management",
  },

  // Creative Labs & Generators (only built routes; others 404)
  {
    name: "Onoma",
    path: "/labs/onoma",
    icon: OnomaNavIcon,
    description: "Linguistic Engine",
  },

  // Administrative & System Tools
  {
    name: "Account Setup",
    path: "/setup",
    icon: Target,
    description: "Initial account configuration and country linking",
  },
  {
    name: "Profile Management",
    path: "/settings",
    icon: Settings,
    description: "Personal account settings and preferences",
  },
  {
    name: "System Administration",
    path: "/admin",
    icon: Settings,
    description: "Platform administration and management tools",
  },
  {
    name: "Storyteller Tools",
    path: "/dm-dashboard",
    icon: Settings,
    description: "Storyteller tools and administrative controls",
  },
  {
    name: "IxTime System",
    path: "/admin",
    icon: Settings,
    description: "Time synchronization and temporal management",
  },
  {
    name: "User Management",
    path: "/admin",
    icon: Settings,
    description: "User administration and role management",
  },
  {
    name: "Data Export",
    path: "/dashboard",
    icon: TrendingUp,
    description: "Export economic data and statistical reports",
  },

  // Quick Actions & Utilities
  {
    name: "Refresh Data",
    path: "#refresh",
    icon: Activity,
    description: "Refresh current page data and statistics",
  },
  {
    name: "Global Search",
    path: "#search",
    icon: Activity,
    description: "Search across all countries, features, and content",
  },
  {
    name: "Notifications",
    path: "#notifications",
    icon: Activity,
    description: "View system notifications and alerts",
  },
];
