/** @jest-environment node */
import { contentModelFor } from "~/lib/wiki-os/xml/content-model";

const wikitext = { model: "wikitext", format: "text/x-wiki" };

describe("contentModelFor", () => {
  it.each([
    ["Module:Foo", { model: "Scribunto", format: "text/plain" }],
    ["module:foo_bar/sandbox", { model: "Scribunto", format: "text/plain" }],
    ["Module:Foo/doc", wikitext],
    ["MediaWiki:Common.css", { model: "css", format: "text/css" }],
    ["MediaWiki:Common.js", { model: "javascript", format: "text/javascript" }],
    ["MediaWiki:Gadgets/Foo.JSON", { model: "json", format: "application/json" }],
    ["User:Jane/common.css", { model: "css", format: "text/css" }],
    ["User:Jane/vector.js", { model: "javascript", format: "text/javascript" }],
    ["User:Jane/data.json", { model: "json", format: "application/json" }],
  ])("%s", (title, expected) => {
    expect(contentModelFor(title)).toEqual(expected);
  });

  it.each([
    "Main Page",
    "Node.js",
    "Styles.css",
    "Talk:Node.js",
    "Template:Foo.css",
    "User:Jane.css",
    "MediaWiki:Mainpage",
    "MediaWiki:Sidebar",
    "Help:Module:Foo",
    "",
    "Bad|title.css",
  ])("is wikitext for %j", (title) => {
    expect(contentModelFor(title)).toEqual(wikitext);
  });
});
