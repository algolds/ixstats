/**
 * MissingPage, the 404 of /wiki/<title>. Its "Create this page" leads to the same path with `?action=edit&redlink=1`.
 * A client-side (next/link) navigation that keeps the pathname leaves Next's not-found boundary showing this page (it
 * resets only when the pathname changes), so the editor never opened: the link is a plain anchor, a document load.
 */
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MissingPage } from "~/components/wiki-os/reader/MissingPage";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href} data-next-link="">
      {children}
    </a>
  ),
}));

describe("MissingPage", () => {
  it("Create this page is a document load of the edit URL, not a client-side navigation", () => {
    render(
      <MissingPage
        title="New Page"
        createHref="/wiki/New_Page?action=edit&redlink=1"
        searchHref="/util/search?q=New%20Page"
      />
    );
    const create = screen.getByRole("link", { name: "Create this page" });
    expect(create).toHaveAttribute("href", "/wiki/New_Page?action=edit&redlink=1");
    expect(create).not.toHaveAttribute("data-next-link");
  });

  it("offers no create link to a reader who may not create the page", () => {
    render(<MissingPage title="New Page" createHref={null} searchHref="/util/search?q=x" />);
    expect(screen.queryByRole("link", { name: "Create this page" })).toBeNull();
    expect(screen.getByRole("link", { name: "Search for this title" })).toBeInTheDocument();
  });
});
