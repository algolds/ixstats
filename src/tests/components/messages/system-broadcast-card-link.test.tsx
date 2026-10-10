import React from "react";
import { render, screen } from "@testing-library/react";

// next/link is replaced by what Next does with a plain path: it puts the base path in front, once, with no check
// for a prefix.
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: React.ComponentProps<"a"> & { href: string }) => (
    <a href={`/projects/ixstates${href}`} {...rest}>
      {children}
    </a>
  ),
}));

import { SystemBroadcastCard } from "~/components/messages/MessagesChatPanel";

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

describe("SystemBroadcastCard 'Open details' link", () => {
  it.each([
    ["a stored href that carries the base path (notifications api)", `${BASE}/dashboard/post/p1`],
    ["a stored plain href", "/dashboard/post/p1"],
  ])("has the base path once for %s", (_name, href) => {
    render(<SystemBroadcastCard item={{ title: "Alert", message: "Hello", href }} />);

    expect(screen.getByRole("link", { name: /Open details/ })).toHaveAttribute(
      "href",
      `${BASE}/dashboard/post/p1`
    );
  });
});
