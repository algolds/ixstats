/**
 * The reader's failure state for a page it could not show (ArticleBusy). WikiOS busy offers a retry. Another wiki that
 * could not be reached says so, offers a retry and the page on that wiki. A page that wiki answered for but could not
 * render (`refused`, BAD_GATEWAY) is no outage: it says the page could not be shown here, as an embed does, and offers
 * only the page on that wiki.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { ArticleBusy } from "~/components/wiki-os/reader/ArticleBusy";
import { WIKI_SOURCES } from "~/lib/wiki-os/config";

const II = WIKI_SOURCES.iiwiki.name;
const external = { name: II, href: "https://iiwiki.com/wiki/Caphiria" };

describe("ArticleBusy", () => {
  it("a wiki that could not be reached says so, with a retry and the page on that wiki", () => {
    const retry = jest.fn();
    render(<ArticleBusy title="Caphiria" onRetry={retry} external={external} />);

    expect(screen.getByRole("heading")).toHaveTextContent(`${II} could not be reached`);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: `Open on ${II}` })).toHaveAttribute(
      "href",
      external.href
    );
  });

  it("a page the wiki could not render could not be shown here: the page on that wiki, no retry, no outage", () => {
    render(<ArticleBusy title="Caphiria" onRetry={jest.fn()} external={external} refused />);

    expect(screen.getByRole("heading")).toHaveTextContent("“Caphiria” could not be shown here");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Open on ${II}` })).toHaveAttribute(
      "href",
      external.href
    );
  });

  it("WikiOS busy offers a retry and no other wiki", () => {
    render(<ArticleBusy title="Caphiria" onRetry={jest.fn()} />);

    expect(screen.getByRole("heading")).toHaveTextContent("WikiOS is busy");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
