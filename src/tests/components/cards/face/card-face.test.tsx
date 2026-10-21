import "fs";
import "path";
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
  silhouette: false,
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
