/**
 * The wanted pages inspector: each red link reads the title its links name, links to that title, and counts its links
 * in the singular for one.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { DiagnosticSection } from "~/components/wiki-os/utilities/domain/DiagnosticSection";

jest.mock("~/trpc/react", () => {
  const query = (data: object[] = []) => ({ useQuery: () => ({ data, isLoading: false }) });
  return {
    api: {
      wikios: {
        getOrphanArticles: query(),
        getWantedPages: query([
          { targetSlug: "treaty_of_oakhaven", title: "Treaty of Oakhaven", linkCount: 1 },
          { targetSlug: "old_gap", title: "Old gap", linkCount: 4 },
        ]),
        getDeadEndArticles: query(),
        getBrokenRedirects: query(),
        getShortestArticles: query(),
        getLongestArticles: query(),
      },
    },
  };
});

describe("DiagnosticSection wanted pages", () => {
  it("links each wanted page by its title and pluralises its link count", () => {
    render(<DiagnosticSection searchFilter="" />);
    fireEvent.click(screen.getByRole("radio", { name: /Wanted pages/ }));

    const treaty = screen.getByRole("link", { name: "Treaty of Oakhaven" });
    expect(treaty.getAttribute("href")).toBe("/wiki/Treaty_of_Oakhaven");
    expect(screen.getByText("1 link")).toBeTruthy();
    expect(screen.getByText("4 links")).toBeTruthy();
  });
});
