/** @jest-environment node */
import {
  exportQuery,
  MAX_EXPORT_URL_LENGTH,
  MAX_HISTORY_PAGES,
  MAX_XML_PAGES,
  pageLimit,
  parseTitleList,
} from "~/lib/wiki-os/xml/export-request";

describe("parseTitleList", () => {
  it("splits on line breaks and pipes, trims, drops blanks and repeats, keeps order", () => {
    expect(parseTitleList("  Foo \n\nBar|Baz\r\nFoo\n | \n")).toEqual(["Foo", "Bar", "Baz"]);
    expect(parseTitleList("")).toEqual([]);
  });
});

describe("exportQuery", () => {
  it("builds the query the route reads", () => {
    const query = new URLSearchParams(exportQuery(["Foo bar", "Talk:Baz & <x>"], false));
    expect(query.get("format")).toBe("xml");
    expect(query.get("pages")).toBe("Foo bar|Talk:Baz & <x>");
    expect(query.has("history")).toBe(false);
  });

  it("asks for history only when told to", () => {
    expect(new URLSearchParams(exportQuery(["Foo"], true)).get("history")).toBe("1");
  });
});

describe("limits", () => {
  it("are the ones the plan sets", () => {
    expect(pageLimit(false)).toBe(MAX_XML_PAGES);
    expect(pageLimit(true)).toBe(MAX_HISTORY_PAGES);
    expect([MAX_XML_PAGES, MAX_HISTORY_PAGES, MAX_EXPORT_URL_LENGTH]).toEqual([500, 50, 7000]);
  });
});
