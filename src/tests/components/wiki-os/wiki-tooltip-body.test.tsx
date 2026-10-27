/**
 * C2b (plan 2026-10-25 sister wikis, Task 9): a hover preview always resolves. A page's intro shows with its wiki's
 * name; a page with no intro says so, a page the wiki does not have says that, and a wiki that cannot be reached
 * (SERVICE_UNAVAILABLE, or busy: TOO_MANY_REQUESTS) says it could not be reached, with a plain link to the page on a
 * sister wiki, where the reader's browser can get through. None of them is a skeleton for ever.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { getIntro: { useQuery: jest.fn() } } },
}));

import { api } from "~/trpc/react";
import { WikiTooltipBody } from "~/components/wiki-os/shared/WikiTooltipBody";
import { publicArticleUrl, WIKI_SOURCES } from "~/lib/wiki-os/config";

type IntroRead = {
  data?: { title: string; intro: string; text: string; source: string; missing: boolean };
  error?: { data: { code: string } } | null;
};

const useIntro = () => jest.mocked(api.wikios.getIntro.useQuery);
const answer = (read: IntroRead) => useIntro().mockReturnValue(read as never);
const intro = (text: string, missing = false) => ({
  data: { title: "Bashan", intro: text, text, source: "iiwiki", missing },
  error: null,
});
const failed = (code: string) => ({ data: undefined, error: { data: { code } } });

const skeleton = (container: HTMLElement) => container.querySelector('[data-slot="skeleton"]');

afterEach(() => jest.clearAllMocks());

describe("WikiTooltipBody", () => {
  it("an unreachable sister wiki says so and links to the page there", () => {
    answer(failed("SERVICE_UNAVAILABLE"));
    const { container } = render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText("IIWiki could not be reached just now.")).toBeInTheDocument();
    const open = screen.getByRole("link", { name: "Open on IIWiki" });
    expect(open).toHaveAttribute("href", publicArticleUrl("Bashan", "iiwiki"));
    expect(open).toHaveAttribute("rel", "noreferrer");
    expect(skeleton(container)).toBeNull();
    expect(screen.getByRole("link", { name: "Read full article" })).toHaveAttribute(
      "href",
      "/wiki/Bashan?source=iiwiki"
    );
  });

  it("a busy wiki is unreachable too", () => {
    answer(failed("TOO_MANY_REQUESTS"));
    render(<WikiTooltipBody title="Kingdom of Bohemia" wiki="althistory" />);

    expect(
      screen.getByText(`${WIKI_SOURCES.althistory.name} could not be reached just now.`)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: `Open on ${WIKI_SOURCES.althistory.name}` })
    ).toHaveAttribute("href", publicArticleUrl("Kingdom of Bohemia", "althistory"));
  });

  it("IxWiki unreachable says so, with no link off the app", () => {
    answer(failed("SERVICE_UNAVAILABLE"));
    render(<WikiTooltipBody title="Burgundie" wiki="ixwiki" />);

    expect(
      screen.getByText(`${WIKI_SOURCES.ixwiki.name} could not be reached just now.`)
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Open on/ })).toBeNull();
  });

  it("an empty intro says no summary, not a skeleton for ever", () => {
    answer(intro(""));
    const { container } = render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText("No summary for this page.")).toBeInTheDocument();
    expect(skeleton(container)).toBeNull();
  });

  it("a page the wiki does not have says so", () => {
    answer(intro("", true));
    const { container } = render(<WikiTooltipBody title="Nowhere" wiki="iiwiki" />);

    expect(screen.getByText("IIWiki has no page with this title.")).toBeInTheDocument();
    expect(screen.queryByText("No summary for this page.")).toBeNull();
    expect(skeleton(container)).toBeNull();
  });

  it("a page the reader may not see reads as no such page", () => {
    answer(failed("NOT_FOUND"));
    render(<WikiTooltipBody title="Caphiria" wiki="ixwiki" />);

    expect(
      screen.getByText(`${WIKI_SOURCES.ixwiki.name} has no page with this title.`)
    ).toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/)).toBeNull();
  });

  it("any other failure says no summary, never could not be reached", () => {
    answer(failed("INTERNAL_SERVER_ERROR"));
    const { container } = render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText("No summary for this page.")).toBeInTheDocument();
    expect(screen.queryByText(/could not be reached/)).toBeNull();
    expect(skeleton(container)).toBeNull();
  });

  it("an intro shows with the wiki's name", () => {
    answer(intro("Bashan is a city on the coast."));
    const { container } = render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText("Bashan is a city on the coast.")).toBeInTheDocument();
    expect(screen.getByText("IIWiki")).toBeInTheDocument();
    expect(screen.getByText("Bashan")).toBeInTheDocument();
    expect(skeleton(container)).toBeNull();
  });

  it("a long intro is cut at 300 characters", () => {
    answer(intro("a".repeat(301)));
    render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText(`${"a".repeat(300)}…`)).toBeInTheDocument();
  });

  it("an intro of exactly 300 characters is not cut", () => {
    answer(intro("b".repeat(300)));
    render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(screen.getByText("b".repeat(300))).toBeInTheDocument();
  });

  it("while loading, the skeleton", () => {
    answer({ data: undefined, error: null });
    const { container } = render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    expect(skeleton(container)).not.toBeNull();
    expect(screen.queryByText("No summary for this page.")).toBeNull();
  });

  it("asks once for an outage, keeps an intro for half an hour", () => {
    answer({ data: undefined, error: null });
    render(<WikiTooltipBody title="Bashan" wiki="iiwiki" />);

    const [input, options] = useIntro().mock.calls[0]!;
    expect(input).toEqual({ title: "Bashan", wiki: "iiwiki" });
    expect(options).toMatchObject({ staleTime: 30 * 60_000 });
    const retry = options!.retry as (count: number, error: { data: { code: string } }) => boolean;
    expect(retry(0, { data: { code: "SERVICE_UNAVAILABLE" } })).toBe(false);
    expect(retry(0, { data: { code: "TOO_MANY_REQUESTS" } })).toBe(false);
    expect(retry(0, { data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(true);
    expect(retry(1, { data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(true);
    expect(retry(2, { data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(false);
  });
});
