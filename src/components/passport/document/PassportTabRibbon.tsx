"use client";

import { Clock, Crown, Globe, Page } from "iconoir-react";
import {
  DocumentRibbon,
  ribbonPanelId,
  ribbonTabId,
  type RibbonTab,
} from "~/components/shared/document/DocumentRibbon";
import type { PassportTabType } from "../types";

const RIBBON_TABS: readonly RibbonTab<PassportTabType>[] = [
  { id: "realms", label: "Realms", icon: Globe },
  { id: "work", label: "Work", icon: Page },
  { id: "collection", label: "Collection", icon: Crown },
  { id: "history", label: "History", icon: Clock },
];

/** The DOM id of a passport ribbon tab. */
export const passportTabId = (idBase: string, tab: PassportTabType) => ribbonTabId(idBase, tab);

/** The DOM id of the passport's tab panel. */
export const passportTabPanelId = ribbonPanelId;

/** The passport's ribbon: the shared document ribbon over its four tabs. */
export function PassportTabRibbon(props: {
  activeTab: PassportTabType;
  onSelectTab: (tab: PassportTabType) => void;
  /** Badge counts for the tabs whose totals are known without loading the tab. */
  counts: Partial<Record<PassportTabType, number>>;
  idBase: string;
}) {
  return <DocumentRibbon tabs={RIBBON_TABS} label="Passport sections" {...props} />;
}
