/**
 * `GlobalLinkTooltips` previews a hovered link through `wikiLinkTarget`, reading the deployment's base path: on
 * IxStates's deployment the reader's links are `/projects/ixstates/wiki/Title`, and a sister page carries `?source=`.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getIntro: { useQuery: jest.fn() } } },
}));

import { api } from "~/trpc/react";
import { GlobalLinkTooltips } from "~/components/wiki-os/shared/GlobalLinkTooltipProvider";

const saved = process.env.NEXT_PUBLIC_BASE_PATH;

beforeEach(() => {
  jest.useFakeTimers();
  jest.mocked(api.wikios.getIntro.useQuery).mockReturnValue({ data: undefined } as never);
  process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
  if (saved === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = saved;
});

/** Hovers a link with `href` next to the provider and lets the show delay pass. */
function hover(href: string) {
  render(
    <>
      <a href={href}>link</a>
      <GlobalLinkTooltips />
    </>
  );
  fireEvent.mouseOver(screen.getByText("link"));
  act(() => {
    jest.advanceTimersByTime(400);
  });
}

describe("GlobalLinkTooltips", () => {
  it("previews a sister article linked under the base path", () => {
    hover("/projects/ixstates/wiki/Foo?source=althistory");
    expect(api.wikios.getIntro.useQuery).toHaveBeenCalledWith(
      { title: "Foo", wiki: "althistory" },
      expect.anything()
    );
  });

  it.each([
    [
      "https://iiwiki.com/index.php?title=Portal:Eurth",
      "Portal:Eurth",
      "iiwiki",
      "/wiki/Portal%3AEurth?source=iiwiki",
    ],
    ["https://ixwiki.com/wiki/IxWiki:Policy", "IxWiki:Policy", "ixwiki", "/wiki/IxWiki%3APolicy"],
    [
      "https://ixwiki.com/index.php?title=Project:About",
      "Project:About",
      "ixwiki",
      "/wiki/Project%3AAbout",
    ],
  ])(
    "previews %s, a page the reader reads, and opens it in the reader",
    (href, title, wiki, path) => {
      jest
        .mocked(api.wikios.getIntro.useQuery)
        .mockReturnValue({
          data: { title, intro: "", text: "", source: wiki, missing: false },
        } as never);
      hover(href);

      expect(api.wikios.getIntro.useQuery).toHaveBeenCalledWith({ title, wiki }, expect.anything());
      expect(screen.getByRole("link", { name: "Read full article" })).toHaveAttribute("href", path);
      expect(screen.getByText("No summary for this page.")).toBeInTheDocument();
    }
  );

  it("does not preview a file link", () => {
    hover("/projects/ixstates/wiki/File:Flag.svg");
    expect(api.wikios.getIntro.useQuery).not.toHaveBeenCalled();
  });
});
