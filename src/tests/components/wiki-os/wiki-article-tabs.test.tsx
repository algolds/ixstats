import { render, screen } from "@testing-library/react";
import { WikiArticleTabs } from "~/components/wiki-os/reader/WikiArticleTabs";

const hrefs = () =>
  Object.fromEntries(
    screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("href")])
  );

describe("WikiArticleTabs", () => {
  it("links Read, Edit, History and Talk to MediaWiki's own URL forms", () => {
    render(<WikiArticleTabs title="Foo bar" active="read" canEdit />);
    expect(hrefs()).toEqual({
      Read: "/wiki/Foo_bar",
      Edit: "/wiki/Foo_bar?action=edit",
      History: "/wiki/Foo_bar?action=history",
      Talk: "/wiki/Talk:Foo_bar",
    });
  });

  it("marks the current view selected", () => {
    render(<WikiArticleTabs title="Talk:Aurelia" active="talk" canEdit />);
    expect(screen.getByRole("tab", { name: "Talk" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Read" }).getAttribute("aria-selected")).toBe("false");
  });

  it("on a talk page Read is the subject page and Add topic opens the editor on a new section", () => {
    render(<WikiArticleTabs title="User talk:Jane" active="talk" canEdit />);
    expect(hrefs()).toMatchObject({
      Read: "/wiki/User:Jane",
      Talk: "/wiki/User_talk:Jane",
      "Add topic": "/wiki/User_talk:Jane?action=edit&section=new",
    });
  });

  it("offers no Edit or Add topic to a reader who cannot edit", () => {
    render(<WikiArticleTabs title="Talk:Aurelia" active="talk" canEdit={false} />);
    expect(screen.queryByRole("tab", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("tab", { name: "Add topic" })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("shows nothing for a title that is not one", () => {
    const { container } = render(<WikiArticleTabs title="" active="read" canEdit />);
    expect(container).toBeEmptyDOMElement();
  });
});
