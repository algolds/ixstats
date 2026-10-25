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

  it("does not preview a file link", () => {
    hover("/projects/ixstates/wiki/File:Flag.svg");
    expect(api.wikios.getIntro.useQuery).not.toHaveBeenCalled();
  });
});
