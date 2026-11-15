import { useEffect, useEffectEvent, useReducer, useState } from "react";
import { createAbsoluteUrl } from "~/lib/utils";
import { api } from "~/trpc/react";
import { useAuth, useUser } from "~/context/auth-context";
import { useTheme } from "~/context/theme-context";
import { useSoundSettings } from "~/hooks/useSoundSettings";
import { useNotificationStore } from "~/stores/notificationStore";
import { useNotify } from "~/hooks/useNotify";
import { useDebounce } from "~/hooks/useDebounce";
import { usePathname, useRouter } from "next/navigation";
import { navigateWithBasePath } from "~/lib/base-path";
import type { ViewMode, SearchFilter, SearchResult, CountriesData } from "./types";
import { extractCountriesList } from "./types";
import { useActiveDIPlugin } from "./plugin-context";
import { useCanOpenAdmin } from "~/hooks/usePermissions";
import { CORE_FEATURES, type SystemActionId } from "./halo-registry";
import { haloReducer, INITIAL_HALO_STATE } from "~/lib/halo/halo-state";
import {
  buildIndex,
  commandEntriesFor,
  searchCatalog,
  type CatalogDescriptor,
} from "~/lib/halo/search";

/**
 * Shared state management hook for the Halo (Dynamic Island) system.
 * Handles mode transitions, debounced search, keyboard navigation shortcuts,
 * and external event synchronization.
 */
export function useDynamicIslandState() {
  const { user, isSignedIn } = useUser();
  const { signOut } = useAuth();
  const { toggleTheme, toggleCompactMode } = useTheme();
  const soundSettings = useSoundSettings();
  const notify = useNotify();
  const markAllNotificationsAsRead = useNotificationStore((s) => s.markAllAsRead);
  const pathname = usePathname();
  const router = useRouter();
  const activePlugin = useActiveDIPlugin();
  const isWikiActive = activePlugin?.id === "wiki";
  const isAdmin = useCanOpenAdmin();

  const [haloState, dispatch] = useReducer(haloReducer, INITIAL_HALO_STATE);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 150);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [prevPluginKey, setPrevPluginKey] = useState("");

  const mode: ViewMode = haloState.status === "compact" ? "compact" : haloState.view;
  const isExpanded = haloState.status === "expanded";
  const expandedMode: ViewMode = haloState.status === "expanded" ? haloState.view : "search";

  // Sync open plugin view if the active plugin or its available views change
  const viewKeys = activePlugin?.expandedViews ? Object.keys(activePlugin.expandedViews) : [];
  const pluginKey = activePlugin ? `${activePlugin.id}:${viewKeys.join(",")}` : "";
  if (pluginKey !== prevPluginKey) {
    setPrevPluginKey(pluginKey);
    dispatch({
      type: "plugin-changed",
      firstView: viewKeys[0] ?? null,
      availableViews: viewKeys,
      pluginGone: !activePlugin,
    });
  }

  // Countries are only needed while the search view can list them
  const countriesEnabled =
    isExpanded &&
    expandedMode === "search" &&
    (searchFilter === "all" || searchFilter === "countries");
  const { data: countriesData, isLoading: countriesLoading } = api.countries.getSelectList.useQuery(
    { limit: 500 },
    { staleTime: 30 * 60 * 1000, enabled: countriesEnabled }
  );

  // Wiki search query
  const wikiEnabled =
    debouncedSearchQuery.length >= 2 && (searchFilter === "all" || searchFilter === "wiki");
  const { data: wikiSearchData, isFetching: wikiFetching } = api.wikios.advancedSearch.useQuery(
    { query: debouncedSearchQuery, limit: searchFilter === "wiki" ? 12 : 5 },
    { enabled: wikiEnabled, staleTime: 60_000 }
  );
  const isSearchPending =
    searchQuery !== debouncedSearchQuery || countriesLoading || (wikiEnabled && wikiFetching);

  const applyInitialSearchFilter = () => {
    let isDynamicWikiSearchEnabled = true;
    try {
      const stored = localStorage.getItem("wikios:dynamicSearchWiki");
      if (stored !== null) {
        isDynamicWikiSearchEnabled = stored === "true";
      }
    } catch {
      // SSR fallback
    }
    setSearchFilter(isDynamicWikiSearchEnabled && isWikiActive ? "wiki" : "all");
  };

  // Mode switching with auto-expand management
  const switchMode = (newMode: ViewMode) => {
    if (newMode === "compact") {
      dispatch({ type: "close" });
      return;
    }
    dispatch({ type: "open", view: newMode });
    if (newMode === "search") {
      applyInitialSearchFilter();
    }
  };

  const commandIndex = buildIndex(
    commandEntriesFor({
      isAdmin,
      signedIn: Boolean(isSignedIn && user),
      pathname,
    })
  );
  const featureIndex = buildIndex(CORE_FEATURES);
  const countryIndex = buildIndex(extractCountriesList(countriesData as CountriesData | undefined));

  const executeCommand = (actionId?: SystemActionId, targetPath?: string) => {
    if (actionId) {
      switch (actionId) {
        case "toggle-theme":
          toggleTheme();
          return;
        case "toggle-sound":
          soundSettings.setEnabled(!soundSettings.enabled);
          return;
        case "toggle-compact":
          toggleCompactMode();
          return;
        case "mark-all-read":
          markAllNotificationsAsRead();
          notify.success("All notifications marked as read");
          return;
        case "reload-data":
          window.location.reload();
          return;
        case "random-wiki":
          navigateWithBasePath("/util/random", router);
          return;
        case "sign-out":
          void signOut().finally(() => {
            window.location.href = createAbsoluteUrl("/");
          });
          return;
        case "random-country": {
          if (countryIndex.length > 0) {
            const random = countryIndex[Math.floor(Math.random() * countryIndex.length)];
            const slug = random?.slug ?? random?.id;
            if (slug) navigateWithBasePath(`/countries/${slug}`, router);
          }
          return;
        }
      }
    }
    if (targetPath === "#search") {
      switchMode("search");
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
      navigateWithBasePath(targetPath, router);
    }
  };

  const toSearchResult = (descriptor: CatalogDescriptor): SearchResult => {
    if (descriptor.kind === "country") {
      return {
        id: descriptor.key,
        type: "country",
        title: descriptor.title,
        description: descriptor.description,
        metadata: {
          countryName: descriptor.title,
          category: descriptor.category,
          flagUrl: descriptor.flagUrl,
          economicTier: descriptor.economicTier,
        },
        action: () => {
          if (descriptor.path) navigateWithBasePath(descriptor.path, router);
        },
      };
    }

    return {
      id: descriptor.key,
      type: descriptor.kind,
      title: descriptor.title,
      description: descriptor.description,
      icon: descriptor.icon,
      metadata: {
        category: descriptor.category,
      },
      action: () => executeCommand(descriptor.actionId, descriptor.path),
    };
  };

  const searchResults: SearchResult[] = searchCatalog(
    debouncedSearchQuery,
    searchFilter,
    {
      countries: countryIndex,
      commands: commandIndex,
      features: featureIndex,
      wiki: wikiSearchData?.results ?? [],
    },
    { wikiFirst: isWikiActive }
  ).map(toSearchResult);

  // Global Keyboard Shortcuts (Cmd+K, Cmd+comma, Esc). Never preventDefault keys we do not handle.
  const onKey = useEffectEvent((e: KeyboardEvent) => {
    // Holding a toggle chord must not flip the mode on every auto-repeat
    if (e.repeat && (e.metaKey || e.ctrlKey || e.key === "Escape")) return;

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

        if (mode === "search") {
          dispatch({ type: "close" });
        } else {
          switchMode("search");
        }
      }
      return;
    }

    if (isInputFocused && !isOurSearchInput && e.key !== "Escape") {
      return;
    }

    // Secondary shortcuts
    if ((e.metaKey || e.ctrlKey) && e.key === ",") {
      e.preventDefault();
      e.stopPropagation();
      dispatch({ type: "toggle", view: "settings" });
    }

    // Escape to close. Only claim the event when Halo has something to close, so that other
    // Escape handlers that respect `defaultPrevented` (e.g. detail rails) still run.
    if (e.key === "Escape" && !isInputFocused && mode !== "compact") {
      if (e.defaultPrevented) return;
      e.preventDefault();
      if (mode === "search" && searchQuery) {
        setSearchQuery("");
        setSearchFilter("all");
      } else {
        dispatch({ type: "close" });
      }
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Tour step transitions
  const onTourStep = useEffectEvent((e: Event) => {
    const customEvent = e as CustomEvent<{ step: number; active: boolean }>;
    if (!customEvent.detail || !customEvent.detail.active) return;

    switch (customEvent.detail.step) {
      case 1:
      case 3:
        switchMode("compact");
        break;
      case 2:
      case 4:
        switchMode("mycountry");
        break;
      case 5:
        switchMode("settings");
        break;
    }
  });

  useEffect(() => {
    window.addEventListener("ix:halo-tour-step", onTourStep);
    return () => {
      window.removeEventListener("ix:halo-tour-step", onTourStep);
    };
  }, []);

  return {
    mode,
    isExpanded,
    expandedMode,
    searchQuery,
    debouncedSearchQuery,
    searchFilter,
    searchResults,
    isSearchPending,
    countriesData,
    setSearchQuery,
    setSearchFilter,
    switchMode,
  };
}
