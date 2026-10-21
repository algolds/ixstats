import "react";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: jest.fn(() => false),
}));

import { useFacetReducedMotion } from "~/components/providers/FacetMotionConfig";
import { CardBackProvenance } from "~/components/cards/face/CardBackProvenance";
import { CardFlip, isFlipKey } from "~/components/cards/face/CardFlip";
import { CardTilt } from "~/components/cards/face/CardTilt";
import { focusRing } from "~/components/ui/button";
import type { TrailEvent } from "~/lib/cards/face/trail";
import type { CardFaceData, CardFinish } from "~/lib/cards/face/types";

const face = (finish: CardFinish = "FOIL"): CardFaceData => ({
  cardId: "c1",
  title: "Caphiria",
  rarity: "EPIC",
  cardType: "LORE",
  realm: { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false },
  artwork: null,
  uncollected: false,
  number: 9,
  season: null,
  isRetired: false,
  copy: { ownershipId: "o1", finish, serialNumber: 7, level: 4 },
});

const key = (init: KeyboardEventInit, target: Element = document.body) => {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "target", { value: target });
  return event;
};

/** The element marked `data-target` in `html`, else its first element. */
const element = (html: string): Element => {
  const host = document.createElement("div");
  host.innerHTML = html;
  const target = host.querySelector("[data-target]") ?? host.firstElementChild;
  if (!target) throw new Error(`No element in ${html}`);
  return target;
};

describe("isFlipKey", () => {
  it("flips on F anywhere but a field, and on Space only off other controls", () => {
    const input = document.createElement("input");
    const button = document.createElement("button");
    expect(isFlipKey(key({ key: "f" }))).toBe(true);
    expect(isFlipKey(key({ key: "F" }))).toBe(true);
    expect(isFlipKey(key({ key: " " }))).toBe(true);
    expect(isFlipKey(key({ key: " " }, button))).toBe(false);
    expect(isFlipKey(key({ key: "f" }, button))).toBe(true);
    expect(isFlipKey(key({ key: "f" }, input))).toBe(false);
    expect(isFlipKey(key({ key: "f", ctrlKey: true }))).toBe(false);
    expect(isFlipKey(key({ key: "Enter" }))).toBe(false);
  });

  it("leaves modified, repeated and already handled keys alone", () => {
    expect(isFlipKey(key({ key: "f", altKey: true }))).toBe(false);
    expect(isFlipKey(key({ key: "f", metaKey: true }))).toBe(false);
    expect(isFlipKey(key({ key: "f", repeat: true }))).toBe(false);
    const handled = key({ key: "f" });
    handled.preventDefault();
    expect(isFlipKey(handled)).toBe(false);
  });

  it("leaves keys typed into text, typeahead lists and editors to them", () => {
    for (const html of [
      "<textarea></textarea>",
      "<select></select>",
      '<div contenteditable="true"><p data-target>Draft</p></div>',
      '<div role="textbox"></div>',
      '<div role="combobox"></div>',
      '<div role="listbox"><div role="option" data-target>One</div></div>',
      '<div role="menu"><div role="menuitem" data-target>Dust</div></div>',
    ]) {
      expect([html, isFlipKey(key({ key: "f" }, element(html)))]).toEqual([html, false]);
      expect([html, isFlipKey(key({ key: " " }, element(html)))]).toEqual([html, false]);
    }
    expect(isFlipKey(key({ key: "f" }, element('<div contenteditable="false"></div>')))).toBe(true);
  });

  it("lets Space press the control it is on", () => {
    for (const html of [
      '<a href="/x">Link</a>',
      "<details><summary data-target>More</summary></details>",
      '<div role="button"><span data-target>Open</span></div>',
      '<div role="link"></div>',
      '<div role="tab"></div>',
      '<div role="checkbox"></div>',
      '<div role="radio"></div>',
      '<div role="switch"></div>',
    ]) {
      expect([html, isFlipKey(key({ key: " " }, element(html)))]).toEqual([html, false]);
    }
    expect(isFlipKey(key({ key: " " }, element("<a>Not a link</a>")))).toBe(true);
    expect(isFlipKey(key({ key: " " }, element('<div tabindex="-1">The card</div>')))).toBe(true);
  });
});

describe("CardFlip", () => {
  beforeEach(() => jest.mocked(useFacetReducedMotion).mockReturnValue(false));

  it("flips on F and keeps the hidden side out of reach", () => {
    const onFlip = jest.fn();
    const { container } = render(
      <CardFlip face={face()} back={<a href="/x">Back link</a>} flipped={false} onFlip={onFlip} />
    );
    expect(fireEvent.keyDown(window, { key: "f" })).toBe(false);
    expect(onFlip).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Back link").closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("img", { name: /Caphiria/ }).closest("[inert]")).toBeNull();
    expect(container.querySelector(".card-holo")).not.toBeNull();
  });
  it("ignores other keys and stops listening once it is gone", () => {
    const onFlip = jest.fn();
    const { unmount } = render(
      <CardFlip face={face()} back={null} flipped={false} onFlip={onFlip} />
    );
    expect(fireEvent.keyDown(window, { key: "Enter" })).toBe(true);
    unmount();
    fireEvent.keyDown(window, { key: "f" });
    expect(onFlip).not.toHaveBeenCalled();
  });
  // jsdom has no layout, so this checks the classes that let a 288 px card shrink into a narrower column at 5:7.
});

describe("CardFlip keys", () => {
  beforeEach(() => jest.mocked(useFacetReducedMotion).mockReturnValue(false));

  it("leaves keys pressed in a dialog stacked over the card to that dialog", () => {
    const onFlip = jest.fn();
    render(
      <>
        <div role="dialog">
          <CardFlip face={face()} back={null} flipped={false} onFlip={onFlip} />
          <button type="button">Copy link</button>
        </div>
        <div role="alertdialog">
          <button type="button">Add</button>
        </div>
      </>
    );
    expect(fireEvent.keyDown(screen.getByRole("button", { name: "Add" }), { key: "f" })).toBe(true);
    expect(onFlip).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("button", { name: "Copy link" }), { key: "f" });
    expect(onFlip).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: "f" });
    expect(onFlip).toHaveBeenCalledTimes(2);
  });
  it("flips once for a held Space, and keeps its repeats from scrolling", () => {
    const onFlip = jest.fn();
    render(
      <>
        <CardFlip face={face()} back={null} flipped={false} onFlip={onFlip} />
        <button type="button">Copy link</button>
      </>
    );
    expect(fireEvent.keyDown(window, { key: " " })).toBe(false);
    expect(fireEvent.keyDown(window, { key: " ", repeat: true })).toBe(false);
    expect(fireEvent.keyDown(window, { key: " ", repeat: true })).toBe(false);
    expect(onFlip).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: "Copy link" });
    expect(fireEvent.keyDown(button, { key: " ", repeat: true })).toBe(true);
    expect(fireEvent.keyDown(window, { key: "Enter", repeat: true })).toBe(true);
  });
});

const signedAt = new Date("2026-10-02T12:00:00Z");
const trailEvent = (id: string, overrides: Partial<TrailEvent> = {}): TrailEvent => ({
  id,
  action: "TRADE",
  from: { name: "@ann" },
  to: { name: "@max" },
  price: null,
  at: new Date("2026-10-01T12:00:00Z"),
  ...overrides,
});

describe("CardBackProvenance", () => {
  it("shows the copy's serial, finish, inscription, level, trail and art credit", () => {
    const { container } = render(
      <CardBackProvenance
        face={face()}
        copy={{
          experience: 2400,
          inscription: { text: "For the archive", signerName: "Urcea", signedAt },
          trail: [trailEvent("e1")],
        }}
        artCredit={{
          line: "Map by Ann",
          licence: "CC BY-SA 4.0",
          sourceUrl: "https://ixwiki.com/wiki/File:Map.png",
        }}
        ns={null}
      />
    );
    expect(container.firstElementChild).toHaveAttribute("data-card-rarity", "EPIC");
    expect(screen.getByText("Ixnay")).toBeInTheDocument();
    expect(screen.getByText("#7 · Foil")).toBeInTheDocument();
    expect(screen.getByText("For the archive")).toBeInTheDocument();
    const longDate = signedAt.toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    // The server names the signer (a handle, or the nation of a player with none); the back adds nothing.
    expect(screen.getByText(`Signed by Urcea on ${longDate}`)).toBeInTheDocument();
    expect(screen.getByText("Level 4 · 2,400 XP")).toBeInTheDocument();
    expect(screen.getByText("Traded")).toBeInTheDocument();
    expect(screen.getByText("@ann to @max")).toBeInTheDocument();
    const at = new Date("2026-10-01T12:00:00Z");
    expect(screen.getByText(at.toLocaleDateString())).toHaveAttribute("datetime", at.toISOString());
    const credit = screen.getByRole("link", { name: "Map by Ann" });
    expect(credit).toHaveAttribute("href", "https://ixwiki.com/wiki/File:Map.png");
    expect(credit).toHaveAttribute("target", "_blank");
    expect(credit).toHaveAttribute("rel", "noopener noreferrer");
    expect(credit).toHaveClass(...focusRing.split(" "));
    expect(credit.parentElement).toHaveTextContent(/^Map by Ann · CC BY-SA 4\.0$/);
    // The credit sits at the foot of the back, below the trail.
    expect(credit.parentElement).toHaveClass("mt-auto");
    expect(screen.queryByRole("link", { name: "View on NationStates" })).toBeNull();
  });
});

describe("CardTilt", () => {
  beforeEach(() => jest.mocked(useFacetReducedMotion).mockReturnValue(false));
  it("is the card alone under Reduce Motion", () => {
    jest.mocked(useFacetReducedMotion).mockReturnValue(true);
    const { container } = render(
      <CardTilt>
        <p>The card</p>
      </CardTilt>
    );
    expect(container.querySelector(".card-holo")).toBeNull();
    expect(container.innerHTML).toBe("<p>The card</p>");
  });
});
