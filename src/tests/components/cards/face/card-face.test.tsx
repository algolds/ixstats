import fs from "fs";
import path from "path";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { CardFace } from "~/components/cards/face/CardFace";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import type { CardFaceData, CardRealmBadge } from "~/lib/cards/face/types";

const IXNAY = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const face = (overrides: Partial<CardFaceData> = {}): CardFaceData => ({
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC",
  cardType: "LORE",
  realm: IXNAY,
  artwork: "/images/cards/caphiria.png",
  uncollected: false,
  number: 42,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish: "FOIL", serialNumber: 7, level: 4 },
  ...overrides,
});

describe("CardFace", () => {
  it("is a real button named by title, rarity, finish and realm, and opens the card", () => {
    const onOpen = jest.fn();
    render(<CardFace face={face()} onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Caphiria, Epic, Foil, Ixnay" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("aria-pressed");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledWith(face());
  });
  it("links to another page when given an href", () => {
    render(<CardFace face={face()} href="/vault/cards/mine?card=c1" />);
    expect(screen.getByRole("link", { name: "Caphiria, Epic, Foil, Ixnay" })).toHaveAttribute(
      "href",
      "/vault/cards/mine?card=c1"
    );
  });

  it("shows an uncollected card's art muted, with its number, and says it is not collected", () => {
    const { container } = render(
      <CardFace face={face({ uncollected: true, copy: null })} size="S" />
    );
    const art = container.querySelector("img");
    expect(art?.getAttribute("src")).toContain("/images/cards/caphiria.png");
    expect(art).toHaveClass("card-face-uncollected");
    expect(screen.getByText("No. 42")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Caphiria, Epic, Ixnay, not collected" })
    ).toBeInTheDocument();
    // The crest by the title stays in colour: the art carries the mark
    expect(screen.getByText("I")).not.toHaveClass("grayscale");
  });

  it("shows a held copy in full colour, with no number note", () => {
    const { container } = render(<CardFace face={face()} size="S" />);
    expect(container.querySelector("img")).not.toHaveClass("card-face-uncollected");
    expect(screen.queryByText("No. 42")).toBeNull();
  });

  it("greys the realm crests of an uncollected card only when it has no art", () => {
    const { rerender } = render(
      <CardFace face={face({ artwork: null, uncollected: true, copy: null })} />
    );
    // The crest on the rarity tint and the one beside the title
    expect(screen.getAllByText("I")).toHaveLength(2);
    for (const crest of screen.getAllByText("I")) expect(crest).toHaveClass("grayscale");
    rerender(<CardFace face={face({ artwork: null, uncollected: false })} />);
    for (const crest of screen.getAllByText("I")) expect(crest).not.toHaveClass("grayscale");
  });

  it("mutes the art in card-art.css by a light desaturation, never a glow", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../../../styles/card-art.css"), "utf8");
    const rule = /\.card-face-uncollected \{([^}]*)\}/.exec(css)?.[1] ?? "";
    const saturation = /saturate\(([\d.]+)\)/.exec(rule);
    expect(Number(saturation?.[1])).toBeGreaterThan(0);
    expect(Number(saturation?.[1])).toBeLessThan(1);
    expect(rule).not.toMatch(/shadow|glow|blur/);
  });
  it("falls back to the realm crest when the art fails to load", () => {
    const { container } = render(<CardFace face={face()} />);
    expect(container.querySelector(".card-face-tint")).toBeNull();
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    // The crest on the rarity tint joins the one beside the title.
    expect(container.querySelector(".card-face-tint")).toHaveTextContent("I");
    expect(screen.getAllByText("I")).toHaveLength(2);
  });

  it("tries new art again after the old art failed", () => {
    const { container, rerender } = render(<CardFace face={face()} />);
    fireEvent.error(container.querySelector("img")!);
    rerender(<CardFace face={face({ artwork: "/images/cards/caphiria-2.png" })} />);
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "/images/cards/caphiria-2.png"
    );
  });

  it("is a link, a button or a picture, never two at once", () => {
    // Type pins: typecheck:tests fails if any of these compiles.
    // @ts-expect-error a link face cannot also open as a button
    const linkAndButton = <CardFace face={face()} href="/x" onOpen={jest.fn()} />;
    // @ts-expect-error only the button form can be picked
    const pickedLink = <CardFace face={face()} href="/x" selected />;
    // @ts-expect-error only the button form can be picked
    const pickedPicture = <CardFace face={face()} selected />;
    expect([linkAndButton, pickedLink, pickedPicture]).toHaveLength(3);
  });
});

describe("RealmCrest", () => {
  const realm = (overrides: Partial<CardRealmBadge> = {}): CardRealmBadge => ({
    ...IXNAY,
    ...overrides,
  });
  it("falls back to the initial when the emblem fails to load", () => {
    const { container } = render(
      <RealmCrest realm={realm({ crestUrl: "/images/realms/broken.png" })} />
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("I")).toBeInTheDocument();
  });
});
