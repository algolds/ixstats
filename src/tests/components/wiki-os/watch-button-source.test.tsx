import { render, screen } from "@testing-library/react";
import { WatchButton } from "~/components/wiki-os/reader/WatchButton";

jest.mock("~/lib/wiki-os/use-wiki-auth", () => ({ useWikiAuth: () => ({ isSignedIn: true }) }));

describe("WatchButton (ruling E-l′)", () => {
  it("is not offered on another wiki's page — the watchlist is IxWiki's", () => {
    render(<WatchButton title="Portal:Eurth" wikiSource="iiwiki" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("is offered on an IxWiki page", () => {
    render(<WatchButton title="Aurelia" />);
    expect(screen.getByRole("button", { name: /watch/i })).toBeInTheDocument();
  });
});
