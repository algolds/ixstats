"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface RealmInfo {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  status: string;
}

interface RealmContextValue {
  /** Current realm ID — "default" for IxWorld */
  realmId: string;
  /** Full realm info (null when using the default IxWorld realm) */
  realmInfo: RealmInfo | null;
  /** Whether we're in the default IxWorld realm */
  isDefaultRealm: boolean;
  /** Switch to a different realm */
  setRealm: (realmId: string, info?: RealmInfo) => void;
  /** Reset back to the default IxWorld realm */
  resetToDefault: () => void;
}

// ──────────────────────────────────────────────
// Context
// ──────────────────────────────────────────────

const RealmContext = createContext<RealmContextValue | null>(null);

// ──────────────────────────────────────────────
// Provider
// ──────────────────────────────────────────────

interface RealmProviderProps {
  children: ReactNode;
  /** Initial realm ID — defaults to "default" (IxWorld) */
  initialRealmId?: string;
  /** Initial realm info for non-default realms */
  initialRealmInfo?: RealmInfo;
}

export function RealmProvider({
  children,
  initialRealmId = "default",
  initialRealmInfo,
}: RealmProviderProps) {
  const [realmId, setRealmIdState] = useState(initialRealmId);
  const [realmInfo, setRealmInfo] = useState<RealmInfo | null>(
    initialRealmInfo ?? null
  );

  const isDefaultRealm = realmId === "default";

  const setRealm = useCallback((newRealmId: string, info?: RealmInfo) => {
    setRealmIdState(newRealmId);
    setRealmInfo(info ?? null);
  }, []);

  const resetToDefault = useCallback(() => {
    setRealmIdState("default");
    setRealmInfo(null);
  }, []);

  const value = useMemo<RealmContextValue>(
    () => ({
      realmId,
      realmInfo,
      isDefaultRealm,
      setRealm,
      resetToDefault,
    }),
    [realmId, realmInfo, isDefaultRealm, setRealm, resetToDefault]
  );

  return (
    <RealmContext.Provider value={value}>{children}</RealmContext.Provider>
  );
}

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

export function useRealm(): RealmContextValue {
  const ctx = useContext(RealmContext);
  if (!ctx) {
    // Outside a RealmProvider — return default realm (safe fallback)
    return {
      realmId: "default",
      realmInfo: null,
      isDefaultRealm: true,
      setRealm: () => {},
      resetToDefault: () => {},
    };
  }
  return ctx;
}
