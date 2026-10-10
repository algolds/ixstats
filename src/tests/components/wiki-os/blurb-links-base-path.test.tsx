import React from "react";
import { render, screen } from "@testing-library/react";

// The real CountryPortal and InfoboxWithMap; only the data layer, the map embed and next/link are replaced. next/link
// is replaced by what Next does with a plain path: it puts the base path in front, once, with no check for a prefix.
jest.mock("~/trpc/react", () => ({
  api: {
    mycountry: { getNationalSummary: { useQuery: () => ({ data: undefined }) } },
    countries: {
      getSelectList: { useQuery: () => ({ data: [{ id: "c1", name: "Urcea" }] }) },
    },
    blurbs: {
      getResponsesForCountry: {
        useInfiniteQuery: () => ({
          data: {
            pages: [
              {
                nextCursor: undefined,
                responses: [
                  { id: "r1", content: "Hello", prompt: { slug: "first-prompt", title: "First" } },
                ],
              },
            ],
          },
        }),
      },
    },
  },
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => () => null,
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={/^https?:/.test(href) ? href : `/projects/ixstates${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { CountryPortal } from "~/components/wiki-os/categories/CountryPortal";
import { InfoboxWithMap } from "~/components/wiki-os/reader/InfoboxWithMap";

const BASE = "/projects/ixstates";
let savedBase: string | undefined;

beforeAll(() => {
  savedBase = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
  // withBasePath only applies the base when the page is served under it.
  window.history.pushState({}, "", `${BASE}/wiki/Urcea`);
});

afterAll(() => {
  if (savedBase === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBase;
  window.history.pushState({}, "", "/");
});

function hrefOf(name: string | RegExp): string | null {
  return screen.getByRole("link", { name }).getAttribute("href");
}

describe("blurb links under a base path", () => {
  it("InfoboxWithMap links each blurb and 'View all blurbs' with the base path once", () => {
    render(<InfoboxWithMap infoboxHtml="<table></table>" articleTitle="Urcea" />);

    expect(hrefOf(/First/)).toBe(`${BASE}/blurbs/first-prompt`);
    expect(hrefOf(/View all blurbs/)).toBe(`${BASE}/blurbs`);
  });

  it("CountryPortal links the country profile, each blurb and 'All blurbs' with the base path once", () => {
    render(
      <CountryPortal
        country={{ id: "c1", name: "Urcea", slug: "urcea" }}
        subcategories={[]}
        pages={[]}
      />
    );

    expect(hrefOf(/First/)).toBe(`${BASE}/blurbs/first-prompt`);
    expect(hrefOf(/All blurbs/)).toBe(`${BASE}/blurbs`);
    const profile = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"))
      .filter((href) => href?.includes("/countries/"));
    expect(profile).toEqual([`${BASE}/countries/urcea`]);
  });
});
