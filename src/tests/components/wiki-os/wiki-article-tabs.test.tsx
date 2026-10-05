import { render, screen } from "@testing-library/react";
import { WikiArticleTabs } from "~/components/wiki-os/reader/WikiArticleTabs";

describe("WikiArticleTabs", () => {
  it("links Read, Edit, History and Talk to the article's own routes", () => {
    render(<WikiArticleTabs slug="Aurelia" active="read" canEdit />);
    const hrefs = Object.fromEntries(
      screen.getAllByRole("tab").map((tab) => [tab.textContent, tab.getAttribute("href")])
    );
    expect(hrefs).toEqual({
      Read: "/wiki/Aurelia",
      Edit: "/wiki/Aurelia/edit",
      History: "/util/history/Aurelia",
      Talk: "/wiki/Aurelia/talk",
    });
  });

  it("marks the current view selected", () => {
    render(<WikiArticleTabs slug="Aurelia" active="talk" canEdit />);
    expect(screen.getByRole("tab", { name: "Talk" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Read" }).getAttribute("aria-selected")).toBe("false");
  });

  it("offers no Edit tab to a reader who cannot edit", () => {
    render(<WikiArticleTabs slug="Aurelia" active="read" canEdit={false} />);
    expect(screen.queryByRole("tab", { name: "Edit" })).toBeNull();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });
});
