import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    wikios: {
      getIntro: { useQuery: () => ({ data: { text: "An intro." } }) },
      getForumThreadPreview: { useQuery: () => ({ data: undefined }) },
    },
  },
}));

// The popover itself is Radix; only what it shows is under test.
jest.mock("~/components/ui/hover-card", () => ({
  VirtualAnchorHoverCard: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
    open ? <div>{children}</div> : null,
}));

import { GlobalLinkTooltips } from "~/components/wiki-os/shared/GlobalLinkTooltipProvider";

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

describe("the wiki link tooltip", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("opens a main wiki article in WikiOS, badged WikiOS", () => {
    hover("https://ixwiki.com/wiki/Urcea");
    const read = screen.getByRole("link", { name: "Read full article" });
    expect(read.getAttribute("href")).toMatch(/\/wiki\/Urcea$/);
    expect(read).not.toHaveAttribute("target");
    expect(screen.getByText("WikiOS")).toBeInTheDocument();
  });

  it("opens a sister wiki article in WikiOS as well, badged with its own name", () => {
    hover("https://iiwiki.com/wiki/Tagmatine_Empire");
    const read = screen.getByRole("link", { name: "Read full article" });
    expect(read.getAttribute("href")).toMatch(/\/wiki\/Tagmatine_Empire\?source=iiwiki$/);
    expect(read).not.toHaveAttribute("target");
    expect(screen.getByText("IIWiki")).toBeInTheDocument();
  });
});
