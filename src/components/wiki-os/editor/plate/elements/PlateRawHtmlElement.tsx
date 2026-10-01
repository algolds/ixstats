"use client";
import React from "react";

// Shared callback context for Plate custom wiki elements.

export interface PlateWikiCallbacks {
  openTemplateEditor: (id: string) => void;
  deleteNode: (id: string) => void;
}

const CallbacksCtx = React.createContext<PlateWikiCallbacks | null>(null);
export const PlateWikiCallbacksProvider = CallbacksCtx.Provider;

/** The callbacks of the enclosing editor, or null for an element rendered outside any `PlateWikiCallbacksProvider`. */
export function useOptionalPlateWikiCallbacks(): PlateWikiCallbacks | null {
  return React.useContext(CallbacksCtx);
}

export function usePlateWikiCallbacks(): PlateWikiCallbacks {
  const ctx = useOptionalPlateWikiCallbacks();
  if (!ctx) throw new Error("PlateWikiCallbacks missing from tree");
  return ctx;
}

