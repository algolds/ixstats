/**
 * CommonsCategoryBrowser: the wiki sources pass no `onToggleCategory`, so rows only browse and offer no
 * "Add ... filter" button; the Commons source keeps the filter toggle.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";

jest.mock("~/trpc/react", () => {
  const idle = () => ({ data: undefined });
  return {
    api: {
      commons: {
        autocompleteCategories: { useQuery: idle },
        getCategoryTotalCounts: { useQuery: idle },
        getSubcategories: { useQuery: idle },
      },
      wikios: {
        getCategories: { useQuery: idle },
        autocompleteCategories: { useQuery: idle },
        getCategoryTotalCounts: { useQuery: idle },
        getSubcategories: { useQuery: idle },
      },
    },
  };
});

describe("CommonsCategoryBrowser", () => {
  it("renders no filter toggle when onToggleCategory is absent, but rows still browse", () => {
    const onBrowseCategory = jest.fn();
    render(
      <CommonsCategoryBrowser
        activeCategories={[]}
        browsingCategory={null}
        onBrowseCategory={onBrowseCategory}
      />
    );
    expect(screen.queryByRole("button", { name: /Add .* filter/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Crowns" }));
    expect(onBrowseCategory).toHaveBeenCalledWith("Crowns");
  });

  it("renders the filter toggle, with an accessible name, when onToggleCategory is given", () => {
    const onToggleCategory = jest.fn();
    render(
      <CommonsCategoryBrowser
        activeCategories={["Crowns"]}
        browsingCategory={null}
        onToggleCategory={onToggleCategory}
        onBrowseCategory={jest.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "Remove Crowns filter" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    fireEvent.click(screen.getByRole("button", { name: "Add Thrones filter" }));
    expect(onToggleCategory).toHaveBeenCalledWith("Thrones");
    expect(screen.getByRole("textbox", { name: "Search categories" })).toBeInTheDocument();
  });
});
