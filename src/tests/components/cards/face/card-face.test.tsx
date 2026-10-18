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
import { CardFaceDown } from "~/components/cards/face/CardFaceDown";
import { RarityMark } from "~/components/cards/face/RarityMark";
import { RealmCrest } from "~/components/cards/face/RealmCrest";
import { CARD_FACE_WIDTH } from "~/lib/cards/face/face-size";
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

  it("carries the rarity and finish for the art sheet, and draws the art", () => {
    const { container } = render(<CardFace face={face()} />);
    const root = screen.getByRole("img", { name: "Caphiria, Epic, Foil, Ixnay" });
    expect(root).toHaveAttribute("data-card-rarity", "EPIC");
    expect(root).toHaveAttribute("data-card-finish", "FOIL");
    expect(container.querySelector("img")?.getAttribute("src")).toContain(
      "/images/cards/caphiria.png"
    );
  });

  it("puts the sheen and the face gem under the element that carries the finish", () => {
    render(<CardFace face={face()} />);
    const root = screen.getByRole("img");
    expect(root).toHaveAttribute("data-card-face");
    expect(root.querySelector(".card-face-sheen")).not.toBeNull();
    expect(root.querySelector(".card-face-gem")).not.toBeNull();
  });

  it("gives a catalogue entry the standard finish", () => {
    render(<CardFace face={face({ copy: null })} />);
    expect(screen.getByRole("img")).toHaveAttribute("data-card-finish", "STANDARD");
  });

  it("links to another page when given an href", () => {
    render(<CardFace face={face()} href="/vault/cards/mine?card=c1" />);
    expect(screen.getByRole("link", { name: "Caphiria, Epic, Foil, Ixnay" })).toHaveAttribute(
      "href",
      "/vault/cards/mine?card=c1"
    );
  });

  it("shows a silhouette's number and no art", () => {
    const { container } = render(
      <CardFace face={face({ artwork: null, silhouette: true, copy: null })} size="S" />
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("No. 42")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Caphiria, Epic, Ixnay, not collected" })
    ).toBeInTheDocument();
  });

  it("shows a season chip only for cards that have a season", () => {
    const { rerender } = render(<CardFace face={face({ cardType: "NS", season: 3 })} />);
    expect(screen.getByText("S3")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Caphiria, Epic, Foil, Ixnay, season 3" })
    ).toBeInTheDocument();
    rerender(<CardFace face={face()} />);
    expect(screen.queryByText(/^S\d+$/)).toBeNull();
  });

  it("shows level and serial only at size L", () => {
    const { rerender } = render(<CardFace face={face()} size="M" />);
    expect(screen.queryByText(/Level 4/)).toBeNull();
    rerender(<CardFace face={face()} size="L" />);
    expect(screen.getByText("Level 4 · #7")).toBeInTheDocument();
  });

  it("puts nothing else on the front: no value, excerpt, country or category", () => {
    const { container } = render(<CardFace face={face()} size="L" />);
    // The realm initial (Ixnay has no emblem), the title, and the size-L level line: nothing more.
    expect(container.textContent).toBe("ICaphiriaLevel 4 · #7");
  });

  it("marks a picked face in select mode", () => {
    const { rerender } = render(<CardFace face={face()} onOpen={jest.fn()} selected />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
    rerender(<CardFace face={face()} onOpen={jest.fn()} selected={false} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");
  });

  it("says a retired card is retired", () => {
    render(<CardFace face={face({ isRetired: true, artwork: null })} />);
    expect(screen.getByText("Retired")).toBeInTheDocument();
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

  it("draws the NationStates logo for the NationStates realm", () => {
    render(
      <RealmCrest
        realm={realm({ id: "nationstates", slug: "nationstates", name: "NationStates" })}
      />
    );
    expect(screen.getByAltText("NationStates")).toBeInTheDocument();
  });

  it("draws the IIWiki logo for the IIWiki realm", () => {
    render(<RealmCrest realm={realm({ id: "iiwiki", slug: "iiwiki", name: "IIWiki" })} />);
    expect(screen.getByAltText("IIWiki")).toBeInTheDocument();
  });

  it("draws a realm's emblem when it has one", () => {
    const { container } = render(
      <RealmCrest realm={realm({ crestUrl: "/images/realms/ixnay.png" })} size="lg" />
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("/images/realms/ixnay.png");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveClass("size-16");
  });

  it("falls back to the realm's initial, greyed when muted", () => {
    render(<RealmCrest realm={realm({ name: "althistory" })} size="md" muted />);
    expect(screen.getByText("A")).toHaveClass("size-10", "grayscale");
  });

  /** White on black at `alpha`, over the lightest face behind it (white), by WCAG's contrast formula. */
  const whiteOnBlackOverWhite = (alpha: number) => {
    const grey = 1 - alpha;
    const luminance = grey <= 0.04045 ? grey / 12.92 : ((grey + 0.055) / 1.055) ** 2.4;
    return 1.05 / (luminance + 0.05);
  };

  it("darkens the initial's disc in the light theme to 4.5:1 for its white letter on any face, keeping the dark one", () => {
    render(<RealmCrest realm={realm()} size="md" />);
    expect(screen.getByText("I")).toHaveClass("card-face-initial", "text-white");
    const css = fs.readFileSync(path.resolve(__dirname, "../../../../styles/card-art.css"), "utf8");
    const disc =
      /\.card-face-initial \{\s*background-color: rgb\(0 0 0 \/ ([\d.]+)\);\s*@variant dark \{\s*background-color: rgb\(0 0 0 \/ ([\d.]+)\);/.exec(
        css
      );
    expect(whiteOnBlackOverWhite(Number(disc?.[1]))).toBeGreaterThanOrEqual(4.5);
    expect(Number(disc?.[2])).toBe(0.4);
  });

  it("falls back to the initial when the emblem fails to load", () => {
    const { container } = render(
      <RealmCrest realm={realm({ crestUrl: "/images/realms/broken.png" })} />
    );
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("I")).toBeInTheDocument();
  });

  const CRESTS: [string, Partial<CardRealmBadge>][] = [
    ["the NationStates logo", { id: "nationstates", slug: "nationstates", name: "NationStates" }],
    ["the IIWiki logo", { id: "iiwiki", slug: "iiwiki", name: "IIWiki" }],
    ["an emblem", { crestUrl: "/images/realms/ixnay.png" }],
    ["an initial", {}],
  ];

  it.each(CRESTS)("is decorative as %s, since the realm's name sits beside it", (_, overrides) => {
    const { container } = render(<RealmCrest realm={realm(overrides)} />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("CardFaceDown and RarityMark", () => {
  it("draws a face-down card that assistive tech skips", () => {
    const { container } = render(<CardFaceDown size="S" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(container.firstElementChild).toHaveClass("card-face-down", "w-32");
  });

  it("sizes a face-down card like its face", () => {
    const { container } = render(<CardFaceDown size="L" />);
    expect(container.firstElementChild).toHaveClass(CARD_FACE_WIDTH.L);
  });

  it("names the rarity next to its gem", () => {
    render(<RarityMark rarity="ULTRA_RARE" />);
    const mark = screen.getByText("Ultra Rare").closest("[data-card-rarity]");
    expect(mark).toHaveAttribute("data-card-rarity", "ULTRA_RARE");
    // Page backgrounds take the theme's paint; the raw-hue face gem is for the title scrim only.
    expect(mark?.querySelector(".card-rarity-gem")).toHaveAttribute("aria-hidden", "true");
    expect(mark?.querySelector(".card-face-gem")).toBeNull();
  });
});
