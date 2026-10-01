import React from "react";
import { render, screen } from "@testing-library/react";
import { EditorialSection } from "~/components/wiki-os/utilities/domain/EditorialSection";

describe("EditorialSection tool links (F4)", () => {
  it("opens the Special:Export page, never the export API without a slug (always a 400)", () => {
    render(<EditorialSection searchFilter="" />);
    const card = screen.getByText("Special:Export").closest("a")!;
    expect(card.getAttribute("href")).toMatch(/\/util\/export$/);
    expect(card.getAttribute("target")).toBeNull();
  });

  it("links no tool to the export API", () => {
    const { container } = render(<EditorialSection searchFilter="" />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href") ?? "");
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.filter((href) => href.includes("/api/wiki/export"))).toEqual([]);
  });
});
