/**
 * Who sees the World tab, and which sidebar tab the editor opens on. Pure, so the rules are tested apart from the
 * panels that apply them.
 *
 * The tab is for the realm's map editors in the world editor, on any realm but Ixnay. The admin studio's sandbox
 * (`?sandbox=1`) is the exception: it never changes a realm, so it is open on Ixnay too, and it shows the World tab
 * alone. Saved panel layouts always carry the tab, so this is applied when the panels render, never stored.
 */
import type { TabId } from "~/components/maps/editor/EditorPanel";

interface WorldTabContext {
  isWorldMode: boolean;
  /** Site admin, or the realm's founder or an officer with the Map power */
  canEdit: boolean;
  isIxnay: boolean;
  sandbox: boolean;
}

export function worldTabAvailable({ isWorldMode, canEdit, isIxnay, sandbox }: WorldTabContext) {
  return isWorldMode && canEdit && (sandbox || !isIxnay);
}

/** The tabs a panel shows: its saved tabs without the World tab where it is not offered; in the sandbox, only that tab. */
export function sidebarTabsFor(
  panelId: "panelA" | "panelB",
  tabs: readonly TabId[],
  context: WorldTabContext
): TabId[] {
  const available = worldTabAvailable(context);
  if (context.sandbox && context.isWorldMode) {
    return available && panelId === "panelA" ? ["world"] : [];
  }
  return available ? [...tabs] : tabs.filter((tab) => tab !== "world");
}

/** The tab panel A opens on. */
export function initialSidebarTab(options: {
  isWorldMode: boolean;
  wantsWorldTab: boolean;
  sandbox: boolean;
}): TabId {
  if (!options.isWorldMode) return "layers";
  return options.wantsWorldTab || options.sandbox ? "world" : "linkages";
}
