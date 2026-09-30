"use client";

import React from "react";
import { useSportsFocus } from "./SportsFocusProvider";
import { SportsFocusSheet } from "./SportsFocusPanel";

export interface SportsFocusOverlayProps {
  sportPreset?: string;
}

export function SportsFocusOverlay({ sportPreset }: SportsFocusOverlayProps) {
  const { focus } = useSportsFocus();

  if (!focus) return null;

  return <SportsFocusSheet sportPreset={sportPreset} />;
}

