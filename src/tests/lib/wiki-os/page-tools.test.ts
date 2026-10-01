import { pageEditHref, pageTalkPair } from "~/lib/wiki-os/page-tools";

describe("pageEditHref (plan 412: the Edit tool is ?action=edit)", () => {
  it("is /wiki/<title>?action=edit with the canonical URL path, subpages and namespaces literal", () => {
    expect(pageEditHref("Foo bar", "Foo_bar")).toBe("/wiki/Foo_bar?action=edit");
    expect(pageEditHref("Template:Foo/doc", "Template%3AFoo%2Fdoc")).toBe(
      "/wiki/Template:Foo/doc?action=edit"
    );
    expect(pageEditHref("foo_bar", null)).toBe("/wiki/Foo_bar?action=edit");
  });

  it("keeps the page's own slug for a text that is not a title", () => {
    expect(pageEditHref("a[b", "a%5Bb")).toBe("/wiki/a%5Bb?action=edit");
    expect(pageEditHref("a[b", null)).toBe("/wiki/?action=edit");
  });
});

describe("pageTalkPair (Discussion and Subject Page)", () => {
  it("is the talk page of a page, and the subject of a talk page", () => {
    expect(pageTalkPair("Foo bar")).toMatchObject({
      page: { title: "Talk:Foo bar" },
      isTalk: false,
    });
    expect(pageTalkPair("User:Jane")).toMatchObject({
      page: { title: "User talk:Jane" },
      isTalk: false,
    });
    expect(pageTalkPair("Talk:Foo bar")).toMatchObject({
      page: { title: "Foo bar" },
      isTalk: true,
    });
  });

  it("is null where there is no talk namespace, and for a text that is not a title", () => {
    expect(pageTalkPair("Special:Random")).toBeNull();
    expect(pageTalkPair("a[b")).toBeNull();
  });
});
