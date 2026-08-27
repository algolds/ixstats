import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Book, Globe, HomeSimple, LogIn, LogOut } from "iconoir-react";
import { createAbsoluteUrl } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { useTheme } from "~/context/theme-context";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { useNotificationStore } from "~/stores/notificationStore";
import { useNotify } from "~/hooks/useNotify";
import { soundEffects } from "~/lib/sound/cuelume";
import { usePathname } from "next/navigation";
import type { ViewMode, SearchFilter, SearchResult, CountriesData } from "./types";
import { extractCountriesList } from "./types";
import { useActiveDIPlugin } from "./plugin-context";
import { CORE_COMMANDS, CORE_FEATURES } from "./halo-registry";

export { CORE_COMMANDS as commands, CORE_FEATURES as features } from "./halo-registry";

/**
 * Shared state management hook for the Halo (Dynamic Island) system.
 * Handles mode transitions, debounced search, keyboard navigation shortcuts,
 * and external event synchronization.
 */
export function useDynamicIslandState() {
  const { user, isSignedIn } = useUser();
  const { toggleTheme, toggleCompactMode } = useTheme();
  const soundSettings = useSoundSettings();
  const notify = useNotify();
  const markAllNotificationsAsRead = useNotificationStore((s) => s.markAllAsRead);
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

  // Lazy-load countries only when expanded
  const { data: countriesData } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 30 * 60 * 1000, enabled: isExpanded }
  );

  // Wiki search query
  const { data: wikiSearchData } = api.wikios.advancedSearch.useQuery(
    { query: debouncedSearchQuery, limit: searchFilter === "wiki" ? 12 : 5 },
    {
      enabled:
        debouncedSearchQuery.length >= 2 && (searchFilter === "all" || searchFilter === "wiki"),
      staleTime: 60_000,
    }
  );

  // Shortcut debounce refs
  const [isProcessingShortcut, setIsProcessingShortcut] = useState(false);
  const shortcutTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const lastTabTimestampRef = useRef<number>(0);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const prevActivePluginIdRef = useRef<string | undefined>(undefined);

  // Debounce search input
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 150);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Mode switching with auto-expand management
  const switchMode = useCallback(
    (newMode: ViewMode) => {
      setMode(newMode);
      setIsUserInteracting(true);
      window.dispatchEvent(new CustomEvent("ix:di-mode-changed", { detail: { mode: newMode } }));

      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
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
          // SSR fallback
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

  // Listen to external mode change triggers
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

  // Pre-compute lowercase command index with category & keywords
  const commandIndex = useMemo(() => {
    const ctx = [...CORE_COMMANDS];
    if (!isSignedIn || !user) {
      ctx.push(
        {
          name: "Sign In",
          path: "/sign-in",
          icon: LogIn,
          category: "System",
          description: "Sign in to your IxStates account",
          keywords: ["login", "auth", "signin", "session"],
        },
        {
          name: "Sign Up",
          path: "/sign-up",
          icon: LogIn,
          category: "System",
          description: "Create a new IxStates account",
          keywords: ["register", "signup", "join", "new account"],
        }
      );
    } else {
      ctx.push({
        name: "Sign Out",
        path: "/sign-out",
        icon: LogOut,
        category: "System",
        description: "Sign out of your account",
        keywords: ["logout", "exit", "signoff"],
      });
    }

    if (pathname !== "/") {
      ctx.unshift({
        name: "Home",
        path: "/",
        icon: HomeSimple,
        category: "System",
        description: "Return to IxStates homepage",
        keywords: ["home", "landing", "main"],
      });
    }

    if (pathname?.includes("/countries/") && !pathname?.includes("/countries/new")) {
      const cid = pathname.split("/countries/")[1]?.split("/")[0];
      if (cid) {
        ctx.push({
          name: "Country Profile",
          path: `/countries/${cid}`,
          icon: Globe,
          category: "Geography",
          description: "View detailed country profile and economy",
          keywords: ["profile", "showcase", "country"],
        });
      }
    }

    return ctx.map((c) => ({
      ...c,
      _lower:
        `${c.name}\t${c.description}\t${c.category}\t${c.keywords?.join(" ") ?? ""}`.toLowerCase(),
    }));
  }, [isSignedIn, user, pathname]);

  const featureIndex = useMemo(
    () =>
      CORE_FEATURES.map((f) => ({
        ...f,
        _lower:
          `${f.name}\t${f.description}\t${f.category}\t${f.keywords?.join(" ") ?? ""}`.toLowerCase(),
      })),
    []
  );

  const countryIndex = useMemo(() => {
    const list = extractCountriesList(countriesData as CountriesData | undefined);
    return list.map((c) => ({ ...c, _lower: c.name.toLowerCase() }));
  }, [countriesData]);

  // Combined and filtered search results
  const searchResults: SearchResult[] = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];

    const query = debouncedSearchQuery.toLowerCase();
    const matchedCountries: SearchResult[] = [];
    const matchedCommands: SearchResult[] = [];
    const matchedFeatures: SearchResult[] = [];
    const matchedWiki: SearchResult[] = [];

    const handleExecute = (actionId?: string, targetPath?: string) => {
      if (actionId) {
        switch (actionId) {
          case "toggle-theme": {
            toggleTheme();
            return;
          }
          case "toggle-sound": {
            const next = !soundSettings.enabled;
            soundSettings.setEnabled(next);
            if (next) soundEffects.toggle();
            return;
          }
          case "toggle-compact": {
            toggleCompactMode();
            return;
          }
          case "mark-all-read": {
            markAllNotificationsAsRead();
            notify.success("All notifications marked as read");
            return;
          }
          case "reload-data": {
            window.location.reload();
            return;
          }
          case "random-wiki": {
            window.location.href = createAbsoluteUrl("/wiki/random");
            return;
          }
          case "random-country": {
            if (countryIndex.length > 0) {
              const random = countryIndex[Math.floor(Math.random() * countryIndex.length)];
              const slug = random?.slug ?? random?.id;
              if (slug) window.location.href = createAbsoluteUrl(`/countries/${slug}`);
            }
            return;
          }
        }
      }
      if (targetPath === "#search") {
        (
          document.querySelector('[data-command-palette-search="true"]') as HTMLInputElement
        )?.focus();
        return;
      }
      if (targetPath === "#notifications") {
        switchMode("notifications");
        return;
      }
      if (targetPath === "#settings") {
        switchMode("settings");
        return;
      }
      if (targetPath) {
        window.location.href = createAbsoluteUrl(targetPath === "/sign-out" ? "/" : targetPath);
      }
    };

    // 1. Gather Countries
    if (searchFilter === "all" || searchFilter === "countries") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const country of countryIndex) {
        if (country._lower.includes(query)) {
          const slug = country.slug ?? country.id;
          matchedCountries.push({
            id: `country-${country.id}`,
            type: "country",
            title: country.name,
            subtitle: `Economic Tier: ${country.economicTier || "Standard"}`,
            description: country.economicTier
              ? `Tier: ${country.economicTier}`
              : "View country profile",
            metadata: {
              countryName: country.name,
              category: "Country",
              flagUrl: country.flagUrl || country.flag || undefined,
              economicTier: country.economicTier,
            },
            action: () => (window.location.href = createAbsoluteUrl(`/countries/${slug}`)),
          });
        }
        if (matchedCountries.length >= limit) break;
      }
    }

    // 2. Gather Commands
    if (searchFilter === "all" || searchFilter === "commands") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const cmd of commandIndex) {
        if (cmd._lower.includes(query)) {
          // oxlint-disable-next-line
          matchedCommands.push({
            id: `command-${cmd.name.toLowerCase().replace(/\s+/g, "-")}`,
            type: "command",
            title: cmd.name,
            description: cmd.description,
            icon: cmd.icon,
            metadata: {
              category: cmd.category,
            },
            action: () => handleExecute(cmd.actionId, cmd.path),
          });
        }
        if (matchedCommands.length >= limit) break;
      }
    }

    // 3. Gather Features
    if (searchFilter === "all" || searchFilter === "features") {
      const limit = searchFilter === "all" ? 3 : 12;
      for (const feat of featureIndex) {
        if (feat._lower.includes(query)) {
          // oxlint-disable-next-line
          matchedFeatures.push({
            id: `feature-${feat.name.toLowerCase().replace(/\s+/g, "-")}`,
            type: "feature",
            title: feat.name,
            description: feat.description,
            icon: feat.icon,
            metadata: {
              category: feat.category,
            },
            action: () => handleExecute(feat.actionId, feat.path),
          });
        }
        if (matchedFeatures.length >= limit) break;
      }
    }

    // 4. Gather Wiki Articles
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
          icon: Book,
          metadata: {
            category: "Wiki",
          },
          action: () => {
            window.location.href = createAbsoluteUrl(
              `/wiki/${encodeURIComponent(article.title.replace(/ /g, "_"))}`
            );
          },
        });
        if (matchedWiki.length >= limit) break;
      }
    }

    // Combine results
    if (searchFilter === "all") {
      if (isWikiActive) {
        return [...matchedWiki, ...matchedCountries, ...matchedCommands, ...matchedFeatures].slice(
          0,
          12
        );
      }
      return [...matchedCountries, ...matchedCommands, ...matchedFeatures, ...matchedWiki].slice(
        0,
        12
      );
    }

    return [...matchedCountries, ...matchedCommands, ...matchedFeatures, ...matchedWiki].slice(
      0,
      12
    );
  }, [
    debouncedSearchQuery,
    searchFilter,
    countryIndex,
    commandIndex,
    featureIndex,
    switchMode,
    wikiSearchData,
    isWikiActive,
    toggleTheme,
    soundSettings,
    toggleCompactMode,
    markAllNotificationsAsRead,
    notify,
  ]);

  // Plugin view sync
  useEffect(() => {
    const pluginIdChanged = activePlugin?.id !== prevActivePluginIdRef.current;
    prevActivePluginIdRef.current = activePlugin?.id;

    if (pluginIdChanged && activePlugin?.expandedViews) {
      const firstViewKey = Object.keys(activePlugin.expandedViews)[0];
      if (firstViewKey) {
        // oxlint-disable-next-line
        setExpandedMode(`plugin:${firstViewKey}`);
      }
    } else if (!activePlugin) {
      if (typeof mode === "string" && mode.startsWith("plugin:")) {
        setMode("compact");
        setIsExpanded(false);
      }
    }
  }, [activePlugin, setIsExpanded, setMode, mode]);

  // Global Keyboard Shortcuts (Cmd+K, Tab, Esc)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isProcessingShortcut) {
        e.preventDefault();
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.getAttribute("contenteditable") === "true" ||
        activeElement?.closest('[contenteditable="true"]') != null ||
        activeElement?.closest(".cm-editor") != null ||
        activeElement?.closest("[data-slate-editor]") != null;

      const isOurSearchInput =
        activeElement?.closest("[data-command-palette-search]") ||
        activeElement?.closest("[data-command-palette]");
      const hasSearchAttribute = activeElement?.hasAttribute("data-command-palette-search");

      if ((isOurSearchInput || hasSearchAttribute) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        return;
      }

      // Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        if (!isInputFocused || isOurSearchInput) {
          e.preventDefault();
          e.stopPropagation();

          if (isProcessingShortcut) return;
          setIsProcessingShortcut(true);

          if (mode === "search") {
            switchMode("compact");
          } else {
            switchMode("search");
          }

          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => {
            setIsProcessingShortcut(false);
          }, 300);
        }
        return;
      }

      if (isInputFocused && !isOurSearchInput && e.key !== "Escape") {
        return;
      }

      // Secondary shortcuts
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "n":
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "notifications" ? "compact" : "notifications");
            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => setIsProcessingShortcut(false), 500);
            break;
          case ",":
            e.preventDefault();
            e.stopPropagation();
            setIsProcessingShortcut(true);
            switchMode(mode === "settings" ? "compact" : "settings");
            if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
            shortcutTimeoutRef.current = setTimeout(() => setIsProcessingShortcut(false), 500);
            break;
        }
      }

      // Tab filter cycling
      if (e.key === "Tab" && mode === "search" && !isProcessingShortcut && !isInputFocused) {
        e.preventDefault();
        const filters: SearchFilter[] = ["all", "countries", "commands", "features", "wiki"];
        const currentIndex = filters.indexOf(searchFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        const nextFilter = filters[nextIndex];
        if (nextFilter) setSearchFilter(nextFilter);
      }

      // Wiki mode toggle
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

        setIsProcessingShortcut(true);
        if (timeSinceLastTab < 400 && mode === "plugin:wiki") {
          switchMode("compact");
        } else {
          switchMode(mode === "plugin:wiki" ? "compact" : "plugin:wiki");
        }
        if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
        shortcutTimeoutRef.current = setTimeout(() => setIsProcessingShortcut(false), 500);
      }

      // Escape to close
      if (e.key === "Escape" && !isProcessingShortcut && !isInputFocused) {
        e.preventDefault();
        if (mode === "search" && searchQuery) {
          setSearchQuery("");
          setSearchFilter("all");
        } else {
          setIsProcessingShortcut(true);
          switchMode("compact");
          if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
          shortcutTimeoutRef.current = setTimeout(() => setIsProcessingShortcut(false), 500);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyPress, { capture: true });
      if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
    };
  }, [mode, switchMode, searchFilter, searchQuery, isProcessingShortcut, isWikiActive]);

  // Tour step transitions
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) clearTimeout(interactionTimeoutRef.current);
      if (shortcutTimeoutRef.current) clearTimeout(shortcutTimeoutRef.current);
    };
  }, []);

  return {
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    isUserInteracting,
    searchResults,
    countriesData,
    setMode,
    setIsExpanded,
    setExpandedMode,
    setSearchQuery,
    setSearchFilter,
    setIsUserInteracting,
    switchMode,
  };
}
