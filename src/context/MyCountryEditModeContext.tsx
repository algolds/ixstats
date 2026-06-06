"use client";

import React, { createContext, useContext, useMemo } from "react";

export type EditLockReason = "premium" | "viewing" | null;

interface EditModeValue {
  /** Whether the current user may perform mutations in this section. */
  canEdit: boolean;
  /** Why editing is locked, if it is. */
  reason: EditLockReason;
}

/**
 * Default: editing allowed. Components NOT wrapped in a provider behave exactly
 * as before — so this context is additive and safe to introduce incrementally.
 */
const MyCountryEditModeContext = createContext<EditModeValue>({ canEdit: true, reason: null });

export function MyCountryEditModeProvider({
  canEdit,
  reason = null,
  children,
}: {
  canEdit: boolean;
  reason?: EditLockReason;
  children: React.ReactNode;
}) {
  const value = useMemo<EditModeValue>(() => ({ canEdit, reason }), [canEdit, reason]);
  return (
    <MyCountryEditModeContext.Provider value={value}>{children}</MyCountryEditModeContext.Provider>
  );
}

/**
 * Read edit permission for the current section. Creator sheets / mutation CTAs
 * call this and, when `canEdit` is false, show an upgrade prompt instead of
 * firing the mutation (the server also enforces premium, so this is UX-only).
 */
export function useCanEdit(): EditModeValue {
  return useContext(MyCountryEditModeContext);
}
