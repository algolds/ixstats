/**
 * Who sees the World tab of the world editor, and which tab the editor opens on: the realm's map editors on any
 * realm but Ixnay, and never the country editor.
 */

import {
  initialSidebarTab,
  sidebarTabsFor,
  worldTabAvailable,
} from "~/components/maps/editor/utils/world-tab";
import type { TabId } from "~/components/maps/editor/EditorPanel";

const editor = { isWorldMode: true, canEdit: true, isIxnay: false };
const TABS: TabId[] = ["linkages", "sovereignty", "layers", "world"];

describe("worldTabAvailable", () => {
  it("is for the realm's map editors on a realm of their own", () => {
    expect(worldTabAvailable(editor)).toBe(true);
  });

  it("is never offered to someone who can't edit the realm's map", () => {
    expect(worldTabAvailable({ ...editor, canEdit: false })).toBe(false);
  });

  it("is never offered on Ixnay", () => {
    expect(worldTabAvailable({ ...editor, isIxnay: true })).toBe(false);
  });

  it("is never offered in the country editor", () => {
    expect(worldTabAvailable({ ...editor, isWorldMode: false })).toBe(false);
  });
});

describe("sidebarTabsFor", () => {
  it("keeps the World tab where the layout put it for a map editor", () => {
    expect(sidebarTabsFor(TABS, editor)).toEqual(TABS);
    expect(sidebarTabsFor(["properties", "world"], editor)).toEqual(["properties", "world"]);
  });

  it("drops the World tab for Ixnay, for a viewer and in the country editor, leaving the rest", () => {
    const rest = ["linkages", "sovereignty", "layers"];
    expect(sidebarTabsFor(TABS, { ...editor, isIxnay: true })).toEqual(rest);
    expect(sidebarTabsFor(TABS, { ...editor, canEdit: false })).toEqual(rest);
    expect(sidebarTabsFor(TABS, { ...editor, isWorldMode: false })).toEqual(rest);
  });
});

describe("initialSidebarTab", () => {
  it("opens the country editor on Layers and the world editor on Links", () => {
    expect(initialSidebarTab({ isWorldMode: false, wantsWorldTab: false })).toBe("layers");
    expect(initialSidebarTab({ isWorldMode: true, wantsWorldTab: false })).toBe("linkages");
  });

  it("opens the world editor on the World tab when the address asks", () => {
    expect(initialSidebarTab({ isWorldMode: true, wantsWorldTab: true })).toBe("world");
  });

  it("does not take the country editor to a tab it doesn't have", () => {
    expect(initialSidebarTab({ isWorldMode: false, wantsWorldTab: true })).toBe("layers");
  });
});
