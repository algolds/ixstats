/**
 * Who sees the World tab of the world editor, and which tab the editor opens on: the realm's map editors on any
 * realm but Ixnay, never the country editor, and in the studio's sandbox that tab alone.
 */

import {
  initialSidebarTab,
  sidebarTabsFor,
  worldTabAvailable,
} from "~/components/maps/editor/utils/world-tab";
import type { TabId } from "~/components/maps/editor/EditorPanel";

const editor = { isWorldMode: true, canEdit: true, isIxnay: false, sandbox: false };
const TABS: TabId[] = ["linkages", "sovereignty", "layers", "world"];

describe("worldTabAvailable", () => {
  it("is for the realm's map editors on a realm of their own", () => {
    expect(worldTabAvailable(editor)).toBe(true);
  });

  it("is never offered to someone who can't edit the realm's map", () => {
    expect(worldTabAvailable({ ...editor, canEdit: false })).toBe(false);
    expect(worldTabAvailable({ ...editor, canEdit: false, sandbox: true })).toBe(false);
  });

  it("is never offered on Ixnay", () => {
    expect(worldTabAvailable({ ...editor, isIxnay: true })).toBe(false);
  });

  it("is never offered in the country editor", () => {
    expect(worldTabAvailable({ ...editor, isWorldMode: false })).toBe(false);
  });

  it("is offered in the studio's sandbox even on Ixnay, which it never changes", () => {
    expect(worldTabAvailable({ ...editor, isIxnay: true, sandbox: true })).toBe(true);
  });
});

describe("sidebarTabsFor", () => {
  it("keeps the World tab where the layout put it for a map editor", () => {
    expect(sidebarTabsFor("panelA", TABS, editor)).toEqual(TABS);
    expect(sidebarTabsFor("panelB", ["properties", "world"], editor)).toEqual([
      "properties",
      "world",
    ]);
  });

  it("drops the World tab for Ixnay, for a viewer and in the country editor, leaving the rest", () => {
    const rest = ["linkages", "sovereignty", "layers"];
    expect(sidebarTabsFor("panelA", TABS, { ...editor, isIxnay: true })).toEqual(rest);
    expect(sidebarTabsFor("panelA", TABS, { ...editor, canEdit: false })).toEqual(rest);
    expect(sidebarTabsFor("panelA", TABS, { ...editor, isWorldMode: false })).toEqual(rest);
  });

  it("shows the World tab alone in the sandbox, and no second panel", () => {
    const sandbox = { ...editor, sandbox: true };
    expect(sidebarTabsFor("panelA", TABS, sandbox)).toEqual(["world"]);
    expect(sidebarTabsFor("panelB", ["properties", "history"], sandbox)).toEqual([]);
  });

  it("shows nothing in the sandbox to someone who can't edit", () => {
    expect(sidebarTabsFor("panelA", TABS, { ...editor, sandbox: true, canEdit: false })).toEqual(
      []
    );
  });
});

describe("initialSidebarTab", () => {
  it("opens the country editor on Layers and the world editor on Links", () => {
    expect(initialSidebarTab({ isWorldMode: false, wantsWorldTab: false, sandbox: false })).toBe(
      "layers"
    );
    expect(initialSidebarTab({ isWorldMode: true, wantsWorldTab: false, sandbox: false })).toBe(
      "linkages"
    );
  });

  it("opens the world editor on the World tab when the address or the sandbox asks", () => {
    expect(initialSidebarTab({ isWorldMode: true, wantsWorldTab: true, sandbox: false })).toBe(
      "world"
    );
    expect(initialSidebarTab({ isWorldMode: true, wantsWorldTab: false, sandbox: true })).toBe(
      "world"
    );
  });

  it("does not take the country editor to a tab it doesn't have", () => {
    expect(initialSidebarTab({ isWorldMode: false, wantsWorldTab: true, sandbox: true })).toBe(
      "layers"
    );
  });
});
