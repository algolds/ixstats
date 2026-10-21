/**
 * Forum pagination is links (ctrl-click opens a page in a new tab, crawlers follow pages). Desktop shows a
 * windowed row; below `sm` only Previous / "Page 3 of 9" / Next. Both rows are in the markup (CSS picks one), so
 * queries that mean "the row" use getAllBy.
 */
import "react";
import { render, screen } from "@testing-library/react";

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
