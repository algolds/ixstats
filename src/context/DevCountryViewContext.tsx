"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { api } from "~/trpc/react";

const STORAGE_KEY = "ixstats:devCountryView";
const QUERY_PARAM = "viewCountry";
const EXPIRY_HOURS = 24;

// Only available in development mode
const isDevelopment = process.env.NODE_ENV === "development";

interface StoredViewState {
  countryId: string;
  countryName: string;
  timestamp: number;
}

interface DevCountryViewContextValue {
  /** Current override country ID (or null if viewing own country) */
  viewCountryId: string | null;
  /** True if viewing a country other than the user's own */
  isViewingOtherCountry: boolean;
  /** The name of the country being viewed (for display) */
  viewCountryName: string | null;
  /** True if the user has permission to use this feature */
  canUseDevView: boolean;
  /** Set the country to view (dev mode only) */
  setViewCountry: (countryId: string, countryName?: string) => void;
  /** Clear the override and return to own country */
  clearViewCountry: () => void;
  /** The user's actual country ID (never changes) */
  actualCountryId: string | null;
  /** Whether the toolbar is expanded */
  isToolbarExpanded: boolean;
  /** Toggle toolbar expansion */
  setToolbarExpanded: (expanded: boolean) => void;
}

const DevCountryViewContext = createContext<DevCountryViewContextValue | null>(null);

function getStoredViewState(): StoredViewState | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as StoredViewState;

    // Check expiry
    const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000;
    if (Date.now() - parsed.timestamp > expiryMs) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function setStoredViewState(countryId: string, countryName: string): void {
  if (typeof window === "undefined") return;

  const state: StoredViewState = {
    countryId,
    countryName,
    timestamp: Date.now(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function clearStoredViewState(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function DevCountryViewProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [viewCountryId, setViewCountryIdState] = useState<string | null>(null);
  const [viewCountryName, setViewCountryName] = useState<string | null>(null);
  const [isToolbarExpanded, setToolbarExpanded] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Get user's actual country from profile
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id && isLoaded,
  });

  const actualCountryId = userProfile?.countryId ?? null;

  // Check if user can use dev view (dev mode + system owner)
  const canUseDevView = useMemo(() => {
    if (!isDevelopment) return false;
    if (!isLoaded || !user?.id) return false;
    return isSystemOwner(user.id);
  }, [isLoaded, user?.id]);

  // Initialize from URL param or localStorage
  useEffect(() => {
    if (!canUseDevView || initialized) return;

    const urlCountryId = searchParams.get(QUERY_PARAM);
    const stored = getStoredViewState();

    if (urlCountryId) {
      setViewCountryIdState(urlCountryId);
      setViewCountryName(stored?.countryId === urlCountryId ? stored.countryName : null);
    } else if (stored) {
      setViewCountryIdState(stored.countryId);
      setViewCountryName(stored.countryName);
    }

    setInitialized(true);
  }, [canUseDevView, searchParams, initialized]);

  // Fetch country name if we have an ID but no name
  const { data: viewedCountry } = api.countries.getByIdBasic.useQuery(
    { id: viewCountryId ?? "" },
    {
      enabled: !!viewCountryId && !viewCountryName && canUseDevView,
    }
  );

  // Update country name when fetched
  useEffect(() => {
    if (viewedCountry?.name && viewCountryId) {
      setViewCountryName(viewedCountry.name);
      setStoredViewState(viewCountryId, viewedCountry.name);
    }
  }, [viewedCountry?.name, viewCountryId]);

  const setViewCountry = useCallback(
    (countryId: string, countryName?: string) => {
      if (!canUseDevView) return;

      setViewCountryIdState(countryId);
      setViewCountryName(countryName ?? null);

      if (countryName) {
        setStoredViewState(countryId, countryName);
      }

      // Update URL
      const params = new URLSearchParams(searchParams.toString());
      params.set(QUERY_PARAM, countryId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });

      console.log(`[DEV] Country view switch: to=${countryId} (${countryName ?? "loading..."})`);
    },
    [canUseDevView, pathname, router, searchParams]
  );

  const clearViewCountry = useCallback(() => {
    setViewCountryIdState(null);
    setViewCountryName(null);
    clearStoredViewState();

    // Remove URL param
    const params = new URLSearchParams(searchParams.toString());
    params.delete(QUERY_PARAM);
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(newUrl, { scroll: false });

    console.log("[DEV] Country view cleared, returning to own country");
  }, [pathname, router, searchParams]);

  const isViewingOtherCountry = useMemo(() => {
    if (!viewCountryId) return false;
    if (!actualCountryId) return true;
    return viewCountryId !== actualCountryId;
  }, [viewCountryId, actualCountryId]);

  const value = useMemo<DevCountryViewContextValue>(
    () => ({
      viewCountryId,
      isViewingOtherCountry,
      viewCountryName,
      canUseDevView,
      setViewCountry,
      clearViewCountry,
      actualCountryId,
      isToolbarExpanded,
      setToolbarExpanded,
    }),
    [
      viewCountryId,
      isViewingOtherCountry,
      viewCountryName,
      canUseDevView,
      setViewCountry,
      clearViewCountry,
      actualCountryId,
      isToolbarExpanded,
    ]
  );

  return <DevCountryViewContext.Provider value={value}>{children}</DevCountryViewContext.Provider>;
}

export function useDevCountryView(): DevCountryViewContextValue {
  const context = useContext(DevCountryViewContext);

  // Return safe defaults if context is not available (e.g., in production or outside provider)
  if (!context) {
    return {
      viewCountryId: null,
      isViewingOtherCountry: false,
      viewCountryName: null,
      canUseDevView: false,
      setViewCountry: () => {},
      clearViewCountry: () => {},
      actualCountryId: null,
      isToolbarExpanded: false,
      setToolbarExpanded: () => {},
    };
  }

  return context;
}
