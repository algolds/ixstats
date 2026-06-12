import * as React from "react";
import type { SpringPreset } from "../shared/constants";

export interface FacetTabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode | number;
  // Custom styling overrides
  activeIndicatorClassName?: string;
  activeTextClassName?: string;
  activeIconClassName?: string;
  glowClassName?: string;
}

export interface FacetTabsProps {
  tabs: FacetTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** @default "accent" */
  tone?: "neutral" | "accent" | "mycountry" | "forum" | "sdi";
  /** @default "fluid" */
  springPreset?: SpringPreset;
  className?: string;
}
