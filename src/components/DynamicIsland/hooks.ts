import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Globe,
  BarChart3,
  Settings,
  Activity,
  TrendingUp,
  Crown,
  Gauge,
  Eye,
  Target,
  Plus,
  Home,
  LogIn,
  LogOut,
} from "lucide-react";
import { createAbsoluteUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { usePathname } from "next/navigation";
import type { ViewMode, SearchFilter, SearchResult } from "./types";

// Development-only logger to suppress Dynamic Island logs in production
const devLog = (...args: any[]) => {
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
            title: "Configure Profile",
            icon: Settings,
            action: () => (window.location.href = createAbsoluteUrl("/profile")),
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
  const [mode, setMode] = useState<ViewMode>("compact");
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<ViewMode>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [timeDisplayMode, setTimeDisplayMode] = useState<"time" | "date" | "both">("time");

  // Get countries data for search
  const { data: countriesData } = api.countries.getAll.useQuery({ limit: 200 });

  // Get user profile for contextual search
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, { enabled: !!user?.id });

  // Get crisis events
  const { data: crisisEvents } = api.unifiedIntelligence.getCrisisEvents.useQuery();

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

  // Timeout cleanup refs
  const interactionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Mode switching with dropdown behavior
  const switchMode = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    setIsUserInteracting(true);

    // Clear existing timeout before setting new one
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }

    // Reset user interaction after 30 seconds
    interactionTimeoutRef.current = setTimeout(() => setIsUserInteracting(false), 30000);

    if (newMode === "compact") {
      setIsExpanded(false);
    } else {
      setIsExpanded(true);
      setExpandedMode(newMode);
    }
  }, []);

  // Generate search results based on query and filter
  const searchResults: SearchResult[] = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];

    const query = debouncedSearchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search countries
    if (searchFilter === "all" || searchFilter === "countries") {
      countriesData?.countries?.forEach((country) => {
        if (country.name.toLowerCase().includes(query)) {
          results.push({
            id: `country-${country.id}`,
            type: "country",
            title: country.name,
            subtitle: `Economic Tier: ${country.economicTier || "Unknown"}`,
            description: `Population: ${country.currentPopulation?.toLocaleString() || "Unknown"} | GDP/Capita: $${country.currentGdpPerCapita?.toLocaleString() || "Unknown"}`,
            metadata: {
              countryName: country.name,
              population: country.currentPopulation,
              gdpPerCapita: country.currentGdpPerCapita,
              economicTier: country.economicTier,
            },
            action: () => (window.location.href = createAbsoluteUrl(`/countries/${country.slug}`)),
          });
        }
      });
    }

    // Search commands/pages
    if (searchFilter === "all" || searchFilter === "commands") {
      // Add contextual commands based on current page and user state
      const contextualCommands = [...commands];

      // Add authentication commands
      if (!isSignedIn || !user) {
        contextualCommands.push(
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
        contextualCommands.push({
          name: "Sign Out",
          path: "/sign-out",
          icon: LogOut,
          description: "Sign out of your account",
        });
      }

      // Add home command if not on home page
      if (pathname !== "/") {
        contextualCommands.unshift({
          name: "Home",
          path: "/",
          icon: Home,
          description: "Return to IxStats homepage",
        });
      }

      // Add current page specific commands
      if (pathname?.includes("/countries/") && !pathname?.includes("/countries/new")) {
        const countryId = pathname.split("/countries/")[1]?.split("/")[0];
        if (countryId) {
          contextualCommands.push(
            {
              name: "Country Profile",
              path: `/countries/${countryId}/profile`,
              icon: Globe,
              description: "View detailed country profile",
            },
            {
              name: "Economic Modeling",
              path: `/countries/${countryId}/modeling`,
              icon: BarChart3,
              description: "Economic modeling and analysis",
            }
          );
        }
      }

      contextualCommands.forEach((command, index) => {
        if (
          command.name.toLowerCase().includes(query) ||
          command.description.toLowerCase().includes(query)
        ) {
          results.push({
            id: `command-${command.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
            type: "command",
            title: command.name,
            description: command.description,
            icon: command.icon,
            action: () => {
              if (command.path === "/sign-out") {
                // Handle sign out
                window.location.href = createAbsoluteUrl("/");
              } else {
                window.location.href = createAbsoluteUrl(command.path);
              }
            },
          });
        }
      });
    }

    // Search features
    if (searchFilter === "all" || searchFilter === "features") {
      features.forEach((feature, index) => {
        if (
          feature.name.toLowerCase().includes(query) ||
          feature.description.toLowerCase().includes(query)
        ) {
          results.push({
            id: `feature-${feature.name.toLowerCase().replace(/\s+/g, "-")}-${index}`,
            type: "feature",
            title: feature.name,
            description: feature.description,
            icon: feature.icon,
            action: () => {
              // Handle special actions
              if (feature.path === "#refresh") {
                window.location.reload();
              } else if (feature.path === "#search") {
                // Focus on command palette search (this is already open)
                const searchInput = document.querySelector(
                  '[data-command-palette-search="true"]'
                ) as HTMLInputElement;
                if (searchInput) searchInput.focus();
              } else if (feature.path === "#notifications") {
                // Switch to notifications mode in Dynamic Island
                switchMode("notifications");
              } else {
                // Normal navigation
                window.location.href = createAbsoluteUrl(feature.path);
              }
            },
          });
        }
      });
    }

    return results.slice(0, 10); // Limit to 10 results
  }, [debouncedSearchQuery, searchFilter, countriesData?.countries, switchMode, user, pathname]);

  // Cycling timeout ref
  const cyclingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Start cycling mode after inactivity; relax on wide screens
  useEffect(() => {
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 0;
    const isWide = viewportWidth >= 1440; // 1440p and up
    const idleMs = isWide ? 20000 : 10000;
    // Clear existing cycling timeout
    if (cyclingTimeoutRef.current) {
      clearTimeout(cyclingTimeoutRef.current);
    }

    if (mode === "compact" && !isUserInteracting) {
      cyclingTimeoutRef.current = setTimeout(() => {
        switchMode("cycling");
      }, idleMs);
    }

    return () => {
      if (cyclingTimeoutRef.current) {
        clearTimeout(cyclingTimeoutRef.current);
      }
    };
  }, [mode, isUserInteracting, switchMode]);

  // Enhanced GLOBAL keyboard shortcuts - work everywhere
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Prevent duplicate processing
      if (isProcessingShortcut) {
        e.preventDefault();
        return;
      }

      // Only skip shortcuts if user is typing in inputs (except search inputs)
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true";

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
      if (e.key === "Tab" && mode === "search" && !isProcessingShortcut) {
        e.preventDefault();
        const filters: SearchFilter[] = ["all", "countries", "commands", "features"];
        const currentIndex = filters.indexOf(searchFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        const nextFilter = filters[nextIndex];
        if (nextFilter) {
          setSearchFilter(nextFilter);
        }
      }

      if (e.key === "Escape" && !isProcessingShortcut) {
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
  }, [mode, switchMode, searchFilter, searchQuery, isProcessingShortcut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      if (cyclingTimeoutRef.current) {
        clearTimeout(cyclingTimeoutRef.current);
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
    timeDisplayMode,
    searchResults,
    countriesData,
    crisisEvents,

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
    path: "/thinkpages",
    icon: TrendingUp,
    description: "Knowledge management and collaborative thinking",
  },
  {
    name: "IxWiki",
    path: "/wiki",
    icon: Activity,
    description: "Access the IxWiki knowledge base",
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
    path: "/cards",
    icon: Activity,
    description: "Collect and trade country cards",
  },

  // User & Admin
  {
    name: "Profile Settings",
    path: "/profile",
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
    name: "DM Dashboard",
    path: "/dm-dashboard",
    icon: Settings,
    description: "Dungeon Master administrative dashboard",
  },

  // Labs & Generators
  {
    name: "Vexel Lab",
    path: "/labs/vexel",
    icon: Target,
    description: "Heraldry and coat of arms generator",
  },
  {
    name: "Onoma Lab",
    path: "/labs/onoma",
    icon: Activity,
    description: "Markov-based name generator",
  },
  {
    name: "Strata Lab",
    path: "/labs/strata",
    icon: Plus,
    description: "City and roadmap generator",
  },
  {
    name: "Dynas Lab",
    path: "/labs/dynas",
    icon: Crown,
    description: "Family and dynasty generator",
  },
  {
    name: "Nomora Lab",
    path: "/labs/nomora",
    icon: Globe,
    description: "Constructed language generator",
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
    path: "/thinkpages",
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
    path: "/thinkpages",
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
    path: "/cards",
    icon: Activity,
    description: "Country trading card collection and management",
  },

  // Creative Labs & Generators
  {
    name: "Heraldry Design",
    path: "/labs/vexel",
    icon: Target,
    description: "Create custom coats of arms and flags",
  },
  {
    name: "Name Generation",
    path: "/labs/onoma",
    icon: Activity,
    description: "Generate names using Markov chains",
  },
  {
    name: "City Planning",
    path: "/labs/strata",
    icon: Plus,
    description: "Design cities and infrastructure layouts",
  },
  {
    name: "Dynasty Building",
    path: "/labs/dynas",
    icon: Crown,
    description: "Create family trees and royal lineages",
  },
  {
    name: "Language Creation",
    path: "/labs/nomora",
    icon: Globe,
    description: "Construct artificial languages and linguistics",
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
    path: "/profile",
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
    name: "DM Tools",
    path: "/dm-dashboard",
    icon: Settings,
    description: "Dungeon Master tools and administrative controls",
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
