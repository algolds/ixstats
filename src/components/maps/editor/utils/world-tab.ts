/**
 * Who sees the World tab, and which sidebar tab the editor opens on. Pure, so the rules are tested apart from the
 * panels that apply them.
 *
 * The tab is for the realm's map editors in the world editor, on any realm but Ixnay. Saved panel layouts always
 * carry the tab, so this is applied when the panels render, never stored.
 */
import type { TabId } from "~/components/maps/editor/EditorPanel";

interface WorldTabContext {
  isWorldMode: boolean;
  /** Site admin, or the realm's founder or an officer with the Map power */
  canEdit: boolean;
  isIxnay: boolean;
}

export function worldTabAvailable({ isWorldMode, canEdit, isIxnay }: WorldTabContext) {
  return isWorldMode && canEdit && !isIxnay;
}

/** The tabs a panel shows: its saved tabs without the World tab where it is not offered. */
export function sidebarTabsFor(tabs: readonly TabId[], context: WorldTabContext): TabId[] {
  return worldTabAvailable(context) ? [...tabs] : tabs.filter((tab) => tab !== "world");
}

/** The tab panel A opens on. */
export function initialSidebarTab(options: {
  isWorldMode: boolean;
  wantsWorldTab: boolean;
}): TabId {
  if (!options.isWorldMode) return "layers";
  return options.wantsWorldTab ? "world" : "linkages";
}
