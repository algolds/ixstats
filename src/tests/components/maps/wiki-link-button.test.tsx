import React from "react";
import { render, screen } from "@testing-library/react";

// next/link is replaced by what Next does with a plain path: it puts the base path in front, once, with no check
// for a prefix.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={/^https?:/.test(href) ? href : `/projects/ixstates${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { WikiAnchor, WikiLinkButton } from "~/components/maps/shared/WikiLinkButton";

const BASE = "/projects/ixstates";
let savedBase: string | undefined;

beforeAll(() => {
  savedBase = process.env.NEXT_PUBLIC_BASE_PATH;
  process.env.NEXT_PUBLIC_BASE_PATH = BASE;
});

afterAll(() => {
  if (savedBase === undefined) delete process.env.NEXT_PUBLIC_BASE_PATH;
  else process.env.NEXT_PUBLIC_BASE_PATH = savedBase;
});

describe("WikiAnchor", () => {
  it.each([
    ["a plain wiki path", "/wiki/Urcea"],
    ["a path that already carries the base path", `${BASE}/wiki/Urcea`],
  ])("renders %s with the base path once", (_name, href) => {
    render(<WikiAnchor href={href}>Urcea</WikiAnchor>);

    expect(screen.getByRole("link", { name: "Urcea" })).toHaveAttribute(
      "href",
      `${BASE}/wiki/Urcea`
    );
  });

  it("opens a sister wiki's address in a new tab, untouched", () => {
    render(<WikiAnchor href="https://iiwiki.com/foo">Out</WikiAnchor>);

    const link = screen.getByRole("link", { name: "Out" });
    expect(link).toHaveAttribute("href", "https://iiwiki.com/foo");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("leaves an absolute address of a wiki page as it is", () => {
    render(<WikiAnchor href="https://ixwiki.com/wiki/Urcea">Abs</WikiAnchor>);

    expect(screen.getByRole("link", { name: "Abs" })).toHaveAttribute(
      "href",
      "https://ixwiki.com/wiki/Urcea"
    );
  });
});

describe("WikiLinkButton", () => {
  it.each([
    ["a plain wiki path", "/wiki/Urcea"],
    ["a path that already carries the base path", `${BASE}/wiki/Urcea`],
  ])("renders %s with the base path once", (_name, url) => {
    render(<WikiLinkButton url={url}>Read</WikiLinkButton>);

    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute(
      "href",
      `${BASE}/wiki/Urcea`
    );
  });
});
