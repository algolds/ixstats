/** @jest-environment node */
/** The page tools menu offers Move, Protect and Delete for the rights held, and none on a page classic owns (A8). */
import { pageAdminActions } from "~/lib/wiki-os/page-admin-ui";
import type { Right } from "~/lib/wiki-os/rights";

const ALL: Right[] = ["move", "protect", "delete"];
const ids = (title: string, rights: Right[] = ALL) =>
  pageAdminActions(title, rights).map((action) => action.id);

describe("pageAdminActions", () => {
  it("offers one action per right held, linked to its screen with the title", () => {
    expect(ids("Caphiria")).toEqual(["move", "protect", "delete"]);
    expect(ids("Caphiria", ["delete"])).toEqual(["delete"]);
    expect(pageAdminActions("A & B", ["move"])[0]?.href).toBe("/util/move?title=A%20%26%20B");
  });

  it.each(["MediaWiki:Sidebar", "mediawiki:Common.js", "MediaWiki:Gadgets-definition"])(
    "offers nothing on %s: classic is the authority for MediaWiki: pages",
    (title) => {
      expect(ids(title)).toEqual([]);
    }
  );

  it("still offers the actions on a MediaWiki talk page", () => {
    expect(ids("MediaWiki talk:Sidebar")).toEqual(["move", "protect", "delete"]);
  });
});
