"use client";
import React from "react";

// Shared callback context for Plate custom wiki elements.

export interface PlateWikiCallbacks {
  openTemplateEditor: (id: string) => void;
  deleteNode: (id: string) => void;
  updateInfoboxFields?: (id: string, fields: Array<{ label: string; value: string }>) => void;
}

const CallbacksCtx = React.createContext<PlateWikiCallbacks | null>(null);
export const PlateWikiCallbacksProvider = CallbacksCtx.Provider;

export function usePlateWikiCallbacks(): PlateWikiCallbacks {
  const ctx = React.useContext(CallbacksCtx);
  if (!ctx) throw new Error("PlateWikiCallbacks missing from tree");
  return ctx;
}

