import { render, screen } from "@testing-library/react";
import { WatchButton } from "~/components/wiki-os/reader/WatchButton";
import { api } from "~/trpc/react";

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

describe("WatchButton marks a watched page visited (plan 416, WK-19)", () => {
  const mutate = jest.fn();

  beforeEach(() => {
    mutate.mockClear();
    (api.wikios.markWatchedVisited.useMutation as jest.Mock).mockReturnValue({ mutate });
  });

  it("tells the server the page was viewed when the reader watches it", () => {
    (api.wikios.isPageWatched.useQuery as jest.Mock).mockReturnValue({ data: true });

    render(<WatchButton title="Aurelia_Major" />);

    expect(mutate).toHaveBeenCalledWith({ pageTitle: "Aurelia Major" });
  });

  it("does not, for a page the reader does not watch", () => {
    (api.wikios.isPageWatched.useQuery as jest.Mock).mockReturnValue({ data: false });

    render(<WatchButton title="Aurelia" />);

    expect(mutate).not.toHaveBeenCalled();
  });
});
