/**
 * C4b (plan 2026-10-25 sister wikis, Task 11): the reader's live embed of a `Template:Sister` box. Each state keeps the
 * line "From <Wiki>: <title>" linking to the page in the reader; the html part sits in a contained prose card, a card
 * part in an entity card, and a page or part the wiki does not have says so. An outage says the wiki could not be
 * reached and links to the page there; any other failure (a page the wiki answered but could not render) offers the
 * page there without blaming the wiki.
 */
import { render, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: { wikios: { sisterEmbed: { useQuery: jest.fn() } } },
}));

import { api } from "~/trpc/react";
import { SisterEmbed } from "~/components/wiki-os/reader/SisterEmbed";
import { publicArticleUrl, WIKI_SOURCES } from "~/lib/wiki-os/config";
import type { SisterEmbedRequest } from "~/lib/wiki-os/sister-embed";

type EmbedRead = {
  data?: Record<string, string | boolean | null>;
  error?: { data: { code: string } } | null;
  isLoading?: boolean;
};

const useEmbed = () => jest.mocked(api.wikios.sisterEmbed.useQuery);
const answer = (read: EmbedRead) => useEmbed().mockReturnValue(read as never);
const ok = (data: Record<string, string | boolean | null>) => answer({ data, error: null });
const failed = (code: string) => answer({ data: undefined, error: { data: { code } } });

const II = WIKI_SOURCES.iiwiki.name;
const AH = WIKI_SOURCES.althistory.name;

function request(overrides: Partial<SisterEmbedRequest> = {}): SisterEmbedRequest {
  return { wiki: "iiwiki", title: "Caphiria", mode: "page", section: null, ...overrides };
}

const skeleton = (container: HTMLElement) => container.querySelector('[data-slot="skeleton"]');
/** The line every state keeps: "From <Wiki>: " and the title linking to the page in the reader. */
function expectSourceLine(title = "Caphiria", wiki: "iiwiki" | "althistory" = "iiwiki") {
  const link = screen.getByRole("link", { name: title });
  expect(link).toHaveAttribute("href", `/wiki/${title.replace(/ /g, "_")}?source=${wiki}`);
  expect(link.parentElement?.textContent).toBe(`From ${WIKI_SOURCES[wiki].name}: ${title}`);
}

let savedBasePath: string | undefined;
beforeEach(() => {
  savedBasePath = process.env.NEXT_PUBLIC_BASE_PATH;
});
afterEach(() => {
  if (savedBasePath === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBasePath;
  jest.clearAllMocks();
});

describe("SisterEmbed", () => {
  it("asks once an hour, never retries, and leaves the section out when there is none", () => {
    answer({ data: undefined, error: null, isLoading: true });
    render(<SisterEmbed request={request()} />);
    expect(useEmbed()).toHaveBeenCalledWith(
      { wiki: "iiwiki", title: "Caphiria", mode: "page" },
      { staleTime: 3_600_000, retry: false }
    );
    expect(useEmbed().mock.calls[0]?.[0]).not.toHaveProperty("section");

    render(<SisterEmbed request={request({ mode: "section", section: "History" })} />);
    expect(useEmbed()).toHaveBeenLastCalledWith(
      { wiki: "iiwiki", title: "Caphiria", mode: "section", section: "History" },
      { staleTime: 3_600_000, retry: false }
    );
  });

  it("loading: the line and a skeleton", () => {
    answer({ data: undefined, error: null, isLoading: true });
    const { container } = render(<SisterEmbed request={request()} />);
    expectSourceLine();
    expect(skeleton(container)).toHaveClass("h-24");
  });

  it("html: a contained prose card with the part, capped in height, the line as its footer", () => {
    ok({ status: "ok", kind: "html", title: "Caphiria", html: "<p>Caphiria is a nation.</p>" });
    const { container } = render(<SisterEmbed request={request()} />);

    const card = container.querySelector(".wikios-sister-embed");
    expect(card).toHaveAttribute("data-content", "prose");
    const body = card?.querySelector(".wikios-sister-article");
    expect(body?.innerHTML).toBe("<p>Caphiria is a nation.</p>");
    expect(body).toHaveClass("max-h-[48rem]", "overflow-y-auto");
    expectSourceLine();
    // the line comes after the part
    const line = screen.getByRole("link", { name: "Caphiria" }).parentElement!;
    expect(body!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(skeleton(container)).toBeNull();
  });

  it("html links get the base path once; its media-proxy images, which already carry it, are left alone", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    ok({
      status: "ok",
      kind: "html",
      title: "Caphiria",
      html:
        '<p><a href="/wiki/Urceopolis?source=iiwiki">Urceopolis</a>' +
        '<img src="/projects/ixstates/api/mediawiki/iiwiki/images/a/ab/Flag.png"></p>',
    });
    const { container } = render(<SisterEmbed request={request()} />);

    expect(screen.getByRole("link", { name: "Urceopolis" })).toHaveAttribute(
      "href",
      "/projects/ixstates/wiki/Urceopolis?source=iiwiki"
    );
    expect(container.querySelector(".wikios-sister-article img")).toHaveAttribute(
      "src",
      "/projects/ixstates/api/mediawiki/iiwiki/images/a/ab/Flag.png"
    );
  });

  it("html: the line links the title the wiki answered with (after a redirect)", () => {
    ok({ status: "ok", kind: "html", title: "Holy Caphiric Empire", html: "<p>x</p>" });
    render(<SisterEmbed request={request({ title: "Caphiria" })} />);
    expectSourceLine("Holy Caphiric Empire");
  });

  it("a cut html part offers the rest on the wiki", () => {
    ok({ status: "ok", kind: "html", title: "Caphiria", html: "<p>x</p>", truncated: true });
    render(<SisterEmbed request={request()} />);
    const more = screen.getByRole("link", { name: `Continue on ${II}` });
    expect(more).toHaveAttribute("href", publicArticleUrl("Caphiria", "iiwiki"));
    expect(more).toHaveAttribute("rel", "noreferrer");
  });

  it("a whole html part offers nothing more", () => {
    ok({ status: "ok", kind: "html", title: "Caphiria", html: "<p>x</p>", truncated: false });
    render(<SisterEmbed request={request()} />);
    expect(screen.queryByText(/Continue on/)).toBeNull();
  });

  it("card: an entity card with the image, the title link, the summary and the wiki's name", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/projects/ixstates";
    const imageUrl = "/projects/ixstates/api/mediawiki/iiwiki/images/f/f0/Seal.png";
    ok({ status: "ok", kind: "card", title: "Caphiria", summary: "An empire.", imageUrl });
    const { container } = render(<SisterEmbed request={request({ mode: "card" })} />);

    const card = container.querySelector(".wikios-sister-embed");
    expect(card).toHaveAttribute("data-content", "entity");
    expect(card).toHaveClass("wikios-sister-article");
    const image = card!.querySelector("img")!;
    expect(image).toHaveAttribute("src", imageUrl);
    expect(image).toHaveAttribute("loading", "lazy");
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(image).toHaveAttribute("alt", "");
    expect(screen.getByRole("link", { name: "Caphiria" })).toHaveAttribute(
      "href",
      "/wiki/Caphiria?source=iiwiki"
    );
    expect(screen.getByText("An empire.")).toBeInTheDocument();
    expect(screen.getByText(`From ${II}`)).toBeInTheDocument();
  });

  it("card with no image shows none", () => {
    ok({ status: "ok", kind: "card", title: "Caphiria", summary: "An empire.", imageUrl: null });
    const { container } = render(<SisterEmbed request={request({ mode: "card" })} />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("missing: says the page does not exist on that wiki", () => {
    ok({ status: "missing" });
    render(<SisterEmbed request={request({ wiki: "althistory", title: "Main Page" })} />);
    expectSourceLine("Main Page", "althistory");
    expect(screen.getByText(`“Main Page” does not exist on ${AH}.`)).toBeInTheDocument();
  });

  it("no-part: names the missing section, or the missing infobox", () => {
    ok({ status: "no-part", part: "section" });
    const { unmount } = render(
      <SisterEmbed request={request({ mode: "section", section: "History" })} />
    );
    expectSourceLine();
    expect(screen.getByText(`${II} has no section “History” in “Caphiria”.`)).toBeInTheDocument();
    unmount();

    ok({ status: "no-part", part: "infobox" });
    render(
      <SisterEmbed request={request({ wiki: "althistory", title: "Main Page", mode: "infobox" })} />
    );
    expect(screen.getByText(`“Main Page” on ${AH} has no infobox.`)).toBeInTheDocument();
  });

  it.each(["SERVICE_UNAVAILABLE", "TOO_MANY_REQUESTS"])(
    "the fallback says could not be reached and links to the page there, with no em dash (%s)",
    (code) => {
      failed(code);
      const { container } = render(<SisterEmbed request={request()} />);
      expectSourceLine();
      expect(screen.getByText(`${II} could not be reached just now.`)).toBeInTheDocument();
      const open = screen.getByRole("link", { name: `Open on ${II}` });
      expect(open).toHaveAttribute("href", publicArticleUrl("Caphiria", "iiwiki"));
      expect(open).toHaveAttribute("rel", "noreferrer");
      expect(container.textContent).not.toMatch(/—/);
      expect(skeleton(container)).toBeNull();
    }
  );

  it("a page the wiki answered but could not render offers it there, without saying the wiki is down", () => {
    failed("INTERNAL_SERVER_ERROR");
    const { container } = render(<SisterEmbed request={request()} />);
    expectSourceLine();
    expect(screen.queryByText(/could not be reached/)).toBeNull();
    expect(screen.getByText(`“Caphiria” on ${II} could not be shown here.`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Open on ${II}` })).toHaveAttribute(
      "href",
      publicArticleUrl("Caphiria", "iiwiki")
    );
    expect(container.textContent).not.toMatch(/—/);
  });

  it("an unrenderable answer is the same: the page offered there", () => {
    ok({ status: "unrenderable" });
    render(<SisterEmbed request={request()} />);
    expectSourceLine();
    expect(screen.getByText(`“Caphiria” on ${II} could not be shown here.`)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: `Open on ${II}` })).toHaveAttribute(
      "href",
      publicArticleUrl("Caphiria", "iiwiki")
    );
  });

  it("links are /wiki/<title>?source=iiwiki", () => {
    ok({ status: "missing" });
    render(<SisterEmbed request={request({ title: "Kingdom of Urcea" })} />);
    expect(screen.getByRole("link", { name: "Kingdom of Urcea" })).toHaveAttribute(
      "href",
      "/wiki/Kingdom_of_Urcea?source=iiwiki"
    );
  });
});
