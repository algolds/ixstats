/**
 * Forum pagination is links (ctrl-click opens a page in a new tab, crawlers follow pages). Desktop shows a
 * windowed row; below `sm` only Previous / "Page 3 of 9" / Next. Both rows are in the markup (CSS picks one), so
 * queries that mean "the row" use getAllBy.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});

import { Pagination, pageHref } from "~/components/thinkpages-forum/Pagination";

const hrefFor = (n: number) => `/thinkpages/c/general?page=${n}`;

describe("pageHref", () => {
  it("adds ?page= to a plain path", () => {
    expect(pageHref("/thinkpages/c/general", 3)).toBe("/thinkpages/c/general?page=3");
  });

  it("keeps a query the path carries", () => {
    expect(pageHref("/thinkpages/mod?tab=bans", 2)).toBe("/thinkpages/mod?tab=bans&page=2");
  });
});

describe("forum Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} last={1} hrefFor={hrefFor} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and links the others", () => {
    render(<Pagination page={2} last={3} hrefFor={hrefFor} />);
    const current = screen.getByRole("link", { name: "2" });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("href", hrefFor(1));
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("href", hrefFor(3));
    expect(screen.getAllByRole("link", { name: "Previous" })[0]).toHaveAttribute("href", hrefFor(1));
    expect(screen.getAllByRole("link", { name: "Next" })[0]).toHaveAttribute("href", hrefFor(3));
  });

  it("shows only the window of a long list, with gaps", () => {
    render(<Pagination page={5} last={9} hrefFor={hrefFor} />);
    for (const n of [1, 4, 5, 6, 9]) expect(screen.getByRole("link", { name: String(n) })).toBeInTheDocument();
    for (const n of [2, 3, 7, 8]) expect(screen.queryByRole("link", { name: String(n) })).toBeNull();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("carries the phone summary, Page 3 of 9, with Previous and Next", () => {
    render(<Pagination page={3} last={9} hrefFor={hrefFor} />);
    expect(screen.getByText("Page 3 of 9")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Previous" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Next" })).toHaveLength(2);
  });

  it("shows the optional summary and a Latest link to the last page", () => {
    render(<Pagination page={2} last={4} hrefFor={hrefFor} summary="Posts 21-40 of 87" />);
    expect(screen.getByText("Posts 21-40 of 87")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Latest" })).toHaveAttribute("href", hrefFor(4));
  });

  it("omits the summary when none is given and Latest on the last page", () => {
    render(<Pagination page={4} last={4} hrefFor={hrefFor} />);
    expect(screen.queryByText(/Posts/)).toBeNull();
    expect(screen.queryByRole("link", { name: "Latest" })).toBeNull();
  });

  it("wraps its row", () => {
    render(<Pagination page={2} last={4} hrefFor={hrefFor} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "3" }).closest(".flex-wrap")).not.toBeNull();
  });

  it("disables Previous on the first page and Next on the last, as buttons", () => {
    const { unmount } = render(<Pagination page={1} last={2} hrefFor={hrefFor} />);
    for (const button of screen.getAllByRole("button", { name: "Previous" })) expect(button).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    unmount();
    render(<Pagination page={2} last={2} hrefFor={hrefFor} />);
    for (const button of screen.getAllByRole("button", { name: "Next" })) expect(button).toBeDisabled();
  });

  it("clamps a page past the end to the last page", () => {
    render(<Pagination page={20} last={3} hrefFor={hrefFor} />);
    expect(screen.getByRole("link", { name: "3" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });
});
