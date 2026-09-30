/** @jest-environment node */
import {
  checkEditPolicy,
  parseWikiTitle,
  type EditPolicyIdentity,
} from "~/lib/wiki-os/namespace-policy";
import type { Right } from "~/lib/wiki-os/rights";

// Plan 409: the policy asks for rights, not for "is admin". These are the rights of the groups that matter.
const userRights: ReadonlySet<Right> = new Set<Right>(["edit", "createpage", "createtalk"]);
const sysopRights: ReadonlySet<Right> = new Set<Right>([
  ...userRights,
  "editprotected",
  "editinterface",
]);
const interfaceAdminRights: readonly Right[] = [
  "editinterface",
  "editsitecss",
  "editsitejs",
  "editsitejson",
  "editusercss",
  "edituserjs",
  "edituserjson",
];
/** The owner role: sysop + interface-admin. */
const adminRights: ReadonlySet<Right> = new Set<Right>([...sysopRights, ...interfaceAdminRights]);

const user = { rights: userRights, linkedWikiUsername: "Alice" };
const unlinked = { rights: userRights, linkedWikiUsername: null };
const sysop = { rights: sysopRights, linkedWikiUsername: null };
const interfaceAdmin = {
  rights: new Set<Right>([...userRights, ...interfaceAdminRights]),
  linkedWikiUsername: null,
};
const admin = { rights: adminRights, linkedWikiUsername: null };

const allowed = (title: string, identity: EditPolicyIdentity = user) =>
  checkEditPolicy(title, identity).allowed;

describe("parseWikiTitle", () => {
  it("splits a namespace prefix the way MediaWiki does", () => {
    expect(parseWikiTitle("Template:Infobox country")).toEqual({
      namespaceId: 10,
      base: "Infobox country",
    });
    expect(parseWikiTitle("template_talk : Foo")).toEqual({ namespaceId: 11, base: "Foo" });
    expect(parseWikiTitle(":Template:Foo")).toEqual({ namespaceId: 10, base: "Foo" });
  });

  it("treats an unknown prefix as part of a main-namespace title", () => {
    expect(parseWikiTitle("Star Wars: A Story")).toEqual({
      namespaceId: 0,
      base: "Star Wars: A Story",
    });
    expect(parseWikiTitle("constructor:Foo")).toEqual({ namespaceId: 0, base: "constructor:Foo" });
  });

  it("resolves aliases and only the first prefix", () => {
    expect(parseWikiTitle("Image:Foo.png")?.namespaceId).toBe(6);
    expect(parseWikiTitle("IxWiki:Rules")?.namespaceId).toBe(4);
    expect(parseWikiTitle("Talk:Template:Foo")?.namespaceId).toBe(1);
  });

  it("refuses titles that hide a prefix behind character references, and empty titles", () => {
    expect(parseWikiTitle("Template&#58;Foo")).toBeNull();
    expect(parseWikiTitle("Module&colon;Foo")).toBeNull();
    expect(parseWikiTitle("  :  ")).toBeNull();
  });

  it("folds unicode spaces and invisible marks", () => {
    expect(parseWikiTitle("Template\u00A0:Foo")?.namespaceId).toBe(10);
    expect(parseWikiTitle("Mod\u200Bule:Foo")?.namespaceId).toBe(828);
  });
});

describe("checkEditPolicy: ordinary users", () => {
  it("may edit main-namespace articles and talk pages", () => {
    expect(allowed("Caphiria")).toBe(true);
    expect(allowed("Star Wars: A Story")).toBe(true);
    expect(allowed("Talk:Caphiria")).toBe(true);
    expect(allowed("User talk:Somebody")).toBe(true);
    expect(allowed("Template talk:Infobox")).toBe(true);
  });

  it.each([
    "Template:Infobox country",
    "Module:Foo",
    "MediaWiki:Common.js",
    "MediaWiki:Sidebar",
    "Help:Editing",
    "Category:Nations",
    "File:Flag.png",
    "Image:Flag.png",
    "IxWiki:Policy",
    "Project:Policy",
    "Gadget:Foo",
    "Gadget definition:Foo",
    "MediaWiki talk:Common.js",
    "Module talk:Foo",
    "Widget:Foo",
    ":Template:Foo",
    "template:foo",
    "TEMPLATE:foo",
    "Template :foo",
    "Template:Foo/Module:Bar",
    "Template\u00A0:Foo",
    "Template&#58;Foo",
    "Mod&#x75;le:Foo",
  ])("cannot edit %s", (title) => {
    expect(allowed(title)).toBe(false);
  });

  it("can never edit Special or Media pages, even as admin", () => {
    expect(allowed("Special:Version", admin)).toBe(false);
    expect(allowed("Media:Foo.png", admin)).toBe(false);
  });

  it("may edit only their own user page, and only with a linked wiki account", () => {
    expect(allowed("User:Alice")).toBe(true);
    expect(allowed("user:alice")).toBe(true); // first letter is case-insensitive
    expect(allowed("User:ALICE")).toBe(false);
    expect(allowed("User:Alice/Sandbox")).toBe(true);
    expect(allowed("User:Bob")).toBe(false);
    expect(allowed("User:Alice Smith")).toBe(false);
    expect(allowed("User:Alice", unlinked)).toBe(false);
  });

  it("cannot edit user script, style or data subpages, even their own", () => {
    expect(allowed("User:Alice/common.js")).toBe(false);
    expect(allowed("User:Alice/vector.css")).toBe(false);
    expect(allowed("User:Alice/data.JSON")).toBe(false);
    expect(allowed("User:Bob/common.js")).toBe(false);
  });
});

describe("checkEditPolicy: wiki admins", () => {
  it.each([
    "Caphiria",
    "Template:Infobox country",
    "Module:Foo",
    "MediaWiki:Common.js",
    "Category:Nations",
    "File:Flag.png",
    "IxWiki:Policy",
    "User:Bob/common.js",
  ])("can edit %s", (title) => {
    expect(allowed(title, admin)).toBe(true);
  });

  it("still refuses an empty title", () => {
    expect(allowed("   ", admin)).toBe(false);
  });
});

describe("checkEditPolicy: sysop versus interface-admin (plan 409)", () => {
  it.each([
    "Template:Infobox country",
    "Module:Foo",
    "MediaWiki:Sidebar",
    "MediaWiki talk:Sidebar",
    "Help:Editing",
    "Category:Nations",
    "File:Flag.png",
    "IxWiki:Policy",
    "User:Bob",
  ])("sysop can edit %s", (title) => {
    expect(allowed(title, sysop)).toBe(true);
  });

  it.each([
    "MediaWiki:Common.css",
    "MediaWiki:Common.js",
    "MediaWiki:Gadgets.json",
    "MediaWiki:Theme.less",
    "User:Bob/common.js",
    "User:Bob/vector.css",
    "User:Bob/data.json",
  ])("sysop alone cannot edit the interface page %s", (title) => {
    expect(allowed(title, sysop)).toBe(false);
  });

  it("asks for the right that matches the kind of interface page", () => {
    const only = (right: Right) => ({
      rights: new Set<Right>(["edit", right]),
      linkedWikiUsername: null,
    });
    expect(allowed("MediaWiki:Common.css", only("editsitecss"))).toBe(true);
    expect(allowed("MediaWiki:Common.js", only("editsitecss"))).toBe(false);
    expect(allowed("MediaWiki:Common.js", only("editsitejs"))).toBe(true);
    expect(allowed("MediaWiki:Data.json", only("editsitejson"))).toBe(true);
    expect(allowed("MediaWiki:Sidebar", only("editsitejs"))).toBe(false);
    expect(allowed("MediaWiki:Sidebar", only("editinterface"))).toBe(true);
    expect(allowed("User:Bob/common.js", only("edituserjs"))).toBe(true);
    expect(allowed("User:Bob/common.js", only("editsitejs"))).toBe(false);
    expect(allowed("User:Bob/vector.css", only("editusercss"))).toBe(true);
  });

  it("lets interface-admin edit script pages but not other namespaces", () => {
    expect(allowed("MediaWiki:Common.js", interfaceAdmin)).toBe(true);
    expect(allowed("MediaWiki:Sidebar", interfaceAdmin)).toBe(true);
    expect(allowed("User:Bob/common.js", interfaceAdmin)).toBe(true);
    expect(allowed("Template:Foo", interfaceAdmin)).toBe(false);
    expect(allowed("User:Bob", interfaceAdmin)).toBe(false);
  });

  it("still lets the owner of a verified link edit their own text pages but not their own scripts", () => {
    expect(allowed("User:Alice/Notes", user)).toBe(true);
    expect(allowed("User:Alice/common.js", user)).toBe(false);
    expect(allowed("User:Alice/common.js", { ...user, rights: adminRights })).toBe(true);
  });
});
