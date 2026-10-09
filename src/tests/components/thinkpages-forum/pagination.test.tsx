/**
 * U8: forum pagination is links (ctrl-click opens a page in a new tab, crawlers follow pages), each to `?page=` on
 * the list's path, keeping a query the path carries. The ends are disabled buttons, not links.
 */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => {
  const router = { push: jest.fn(), replace: jest.fn() };
  return { router, useRouter: () => router };
});

import { Pagination } from "~/components/thinkpages-forum/Pagination";

const hrefOf = (name: string) => screen.getByRole("link", { name }).getAttribute("href");

describe("forum Pagination", () => {
  it("links every page, previous and next to ?page=", () => {
    render(<Pagination basePath="/thinkpages/c/general" page={2} totalPages={3} />);
    expect(hrefOf("Previous")).toBe("/thinkpages/c/general?page=1");
    expect(hrefOf("1")).toBe("/thinkpages/c/general?page=1");
    expect(hrefOf("3")).toBe("/thinkpages/c/general?page=3");
    expect(hrefOf("Next")).toBe("/thinkpages/c/general?page=3");
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("disables previous on the first page and next on the last, as buttons", () => {
    const { unmount } = render(<Pagination basePath="/thinkpages/c/general" page={1} totalPages={2} />);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(hrefOf("Next")).toBe("/thinkpages/c/general?page=2");
    unmount();
    render(<Pagination basePath="/thinkpages/c/general" page={2} totalPages={2} />);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("keeps the query the path carries", () => {
    render(<Pagination basePath="/thinkpages/mod?tab=bans" page={1} totalPages={2} />);
    expect(hrefOf("2")).toBe("/thinkpages/mod?tab=bans&page=2");
  });

  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination basePath="/thinkpages/c/general" page={1} totalPages={1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
