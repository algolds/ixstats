import * as React from "react";
import type { SpringPreset } from "../shared/constants";
import type { TextureType } from "~/components/ui/texture-overlay";
import type { FacetTabsTone } from "./constants";

export interface FacetTabItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: React.ReactNode | number;
  className?: string;
  // Custom styling overrides
  activeIndicatorClassName?: string;
  activeTextClassName?: string;
  activeIconClassName?: string;
  glowClassName?: string;
  /**
   * Any CSS colour (data-driven, e.g. a country's or article's colour): tints the indicator when
   * this tab is active (12% fill, 28% edge via `color-mix`), blending between tabs while dragging.
   */
  themeColor?: string;
}

export interface FacetTabsProps {
  tabs: FacetTabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  /** @default "md" */
  size?: "sm" | "md" | "lg";
  /** @default "accent" */
  tone?: FacetTabsTone;
  /** @default "fluid" */
  springPreset?: SpringPreset;
  /** Tactile texture pattern for track and indicator @default "dots" */
  texture?: TextureType;
  /** Whether to render texture overlay @default true */
  showTexture?: boolean;
  className?: string;
  /** Extra classes merged onto the moving active indicator (e.g. to match the
   * container's corner radius at the edge tabs). twMerge lets this override defaults. */
  indicatorClassName?: string;
  /** Accessible name for the tablist. */
  "aria-label"?: string;
}
