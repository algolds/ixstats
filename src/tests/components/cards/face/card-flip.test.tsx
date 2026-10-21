import React from "react";
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
  silhouette: false,
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

  it("puts the front out of reach once it is turned over", () => {
    render(<CardFlip face={face()} back={<a href="/x">Back link</a>} flipped onFlip={jest.fn()} />);
    expect(screen.getByText("Back link").closest("[inert]")).toBeNull();
    expect(screen.getByRole("img", { name: /Caphiria/ }).closest("[inert]")).not.toBeNull();
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

  it("shows the holo on Holo and Serialised copies too", () => {
    for (const finish of ["HOLO", "SERIALISED"] as const) {
      const { container, unmount } = render(
        <CardFlip face={face(finish)} back={null} flipped={false} onFlip={jest.fn()} />
      );
      expect([finish, container.querySelector(".card-holo")]).not.toEqual([finish, null]);
      unmount();
    }
  });

  it("shows no holo on a Standard copy or a catalogue card", () => {
    const { container, rerender } = render(
      <CardFlip face={face("STANDARD")} back={null} flipped={false} onFlip={jest.fn()} />
    );
    expect(container.querySelector(".card-holo")).toBeNull();
    rerender(
      <CardFlip face={{ ...face(), copy: null }} back={null} flipped={false} onFlip={jest.fn()} />
    );
    expect(container.querySelector(".card-holo")).toBeNull();
  });

  it("moves the holo highlight with the pointer", () => {
    const { container } = render(
      <CardFlip face={face()} back={null} flipped={false} onFlip={jest.fn()} />
    );
    const stage = container.firstElementChild as HTMLElement;
    jest.spyOn(stage, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 50,
      width: 200,
      height: 280,
    } as DOMRect);
    // jsdom has no PointerEvent, so a MouseEvent of that type carries the coordinates.
    fireEvent(stage, new MouseEvent("pointermove", { bubbles: true, clientX: 150, clientY: 260 }));
    const holo = container.querySelector<HTMLElement>(".card-holo");
    expect(holo?.style.getPropertyValue("--holo-x")).toBe("25%");
    expect(holo?.style.getPropertyValue("--holo-y")).toBe("75%");
  });

  it("cross-fades without tilt or holo under Reduce Motion", () => {
    jest.mocked(useFacetReducedMotion).mockReturnValue(true);
    const onFlip = jest.fn();
    const { container, rerender } = render(
      <CardFlip face={face()} back={<p>The back</p>} flipped={false} onFlip={onFlip} />
    );
    expect(container.querySelector(".card-holo")).toBeNull();
    expect(container.querySelector(".perspective-distant, .transform-3d")).toBeNull();
    expect(screen.queryByText("The back")).toBeNull();
    fireEvent.keyDown(window, { key: " " });
    expect(onFlip).toHaveBeenCalledTimes(1);
    rerender(<CardFlip face={face()} back={<p>The back</p>} flipped onFlip={onFlip} />);
    expect(screen.getByText("The back")).toBeInTheDocument();
  });

  // jsdom has no layout, so this checks the classes that let a 288 px card shrink into a narrower column at 5:7.
  it.each([false, true])(
    "shrinks to a column narrower than the card, keeping 5:7 (Reduce Motion %s)",
    (reduce) => {
      jest.mocked(useFacetReducedMotion).mockReturnValue(reduce);
      const { container } = render(
        <CardFlip face={face()} back={<p>The back</p>} flipped={false} onFlip={jest.fn()} />
      );
      expect(container.firstElementChild).toHaveClass("w-fit", "max-w-full");
      expect(screen.getByRole("img", { name: /Caphiria/ })).toHaveClass(
        "w-72",
        "max-w-full",
        "aspect-[5/7]"
      );
      // The cross-fade stacks both sides in one grid cell, which must not hold the column open at 288 px.
      if (reduce) expect(container.firstElementChild).toHaveClass("grid-cols-1");
    }
  );
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

  it("leaves keys in any dialog to it when the card sits outside one", () => {
    const onFlip = jest.fn();
    render(
      <>
        <CardFlip face={face()} back={null} flipped={false} onFlip={onFlip} />
        <div role="dialog">
          <button type="button">Add</button>
        </div>
      </>
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Add" }), { key: "f" });
    expect(onFlip).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "f" });
    expect(onFlip).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    "keeps focus on the card when the side holding it turns away (Reduce Motion %s)",
    (reduce) => {
      jest.mocked(useFacetReducedMotion).mockReturnValue(reduce);
      const onFlip = jest.fn();
      const { container } = render(
        <CardFlip face={face()} back={<a href="/x">Back link</a>} flipped onFlip={onFlip} />
      );
      const root = container.firstElementChild;
      expect(root).toHaveAttribute("tabindex", "-1");
      const link = screen.getByText("Back link");
      link.focus();
      fireEvent.keyDown(link, { key: "f" });
      expect(onFlip).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(root);
    }
  );

  it("leaves focus where it is when the key came from outside the card", () => {
    render(
      <>
        <CardFlip face={face()} back={null} flipped={false} onFlip={jest.fn()} />
        <button type="button">Elsewhere</button>
      </>
    );
    const elsewhere = screen.getByRole("button", { name: "Elsewhere" });
    elsewhere.focus();
    fireEvent.keyDown(elsewhere, { key: "f" });
    expect(document.activeElement).toBe(elsewhere);
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
  it("is the card's size, and shrinks with the front in a narrower column at 5:7", () => {
    const { container } = render(
      <CardBackProvenance face={face()} copy={null} artCredit={null} ns={null} />
    );
    expect(container.firstElementChild).toHaveClass("w-72", "max-w-full", "aspect-[5/7]");
  });

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

  it("signs a signer it may not name as a player, and keeps the licence once", () => {
    render(
      <CardBackProvenance
        face={face()}
        copy={{
          experience: 0,
          inscription: { text: "Hello", signerName: null, signedAt: null },
          trail: [],
        }}
        artCredit={{
          line: "Map.png by Ann, CC BY-SA 4.0",
          licence: "CC BY-SA 4.0",
          sourceUrl: null,
        }}
        ns={null}
      />
    );
    expect(screen.getByText("Signed by a player")).toBeInTheDocument();
    expect(screen.getByText("Map.png by Ann, CC BY-SA 4.0")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("lists the four latest moves (the trail comes newest first), and only the parties it knows", () => {
    render(
      <CardBackProvenance
        face={face()}
        copy={{
          experience: 10,
          inscription: null,
          trail: [
            trailEvent("e1", { action: "PACK_OPEN", from: null, to: null }),
            trailEvent("e2"),
            trailEvent("e3"),
            trailEvent("e4"),
            trailEvent("e5", { action: "AUCTION_END" }),
          ],
        }}
        artCredit={null}
        ns={null}
      />
    );
    const moves = screen.getAllByRole("listitem");
    expect(moves).toHaveLength(4);
    const at = new Date("2026-10-01T12:00:00Z").toLocaleDateString();
    expect(moves[0]?.textContent).toBe(`Pulled from a pack${at}`);
    expect(moves[1]?.textContent).toBe(`Traded@ann to @max${at}`);
    expect(screen.queryByText("Won at auction")).toBeNull();
    expect(screen.queryByText(/Signed by/)).toBeNull();
  });

  it("gives an NS card its provenance line and a link to NationStates", () => {
    render(
      <CardBackProvenance
        face={{ ...face(), cardType: "NS", season: 3, copy: null, silhouette: true }}
        copy={null}
        artCredit={null}
        ns={{
          nation: "Testlandia",
          season: 3,
          region: "The Pacific",
          category: null,
          cardUrl: "https://www.nationstates.net/page=deck/card=42/season=3",
          nationUrl: "https://www.nationstates.net/nation=testlandia",
        }}
      />
    );
    expect(screen.getByText("Testlandia · season 3 · The Pacific")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on NationStates" })).toHaveAttribute(
      "href",
      "https://www.nationstates.net/page=deck/card=42/season=3"
    );
    expect(screen.getByText("Not in your collection")).toBeInTheDocument();
    expect(screen.queryByText(/^Level/)).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveClass(...focusRing.split(" "));
    }
    const api = screen.getByRole("link", { name: "NationStates API" });
    expect(api).toHaveAttribute("href", "https://www.nationstates.net/pages/api.html#cards");
    expect(api.parentElement).toHaveTextContent(
      "Data via official NationStates API. Not affiliated with or endorsed by NationStates."
    );
  });

  it("links an NS card to its nation when the card page is unknown", () => {
    render(
      <CardBackProvenance
        face={{ ...face(), cardType: "NS", season: null, copy: null }}
        copy={null}
        artCredit={null}
        ns={{
          nation: "Testlandia",
          season: null,
          region: null,
          category: "Common",
          cardUrl: null,
          nationUrl: "https://www.nationstates.net/nation=testlandia",
        }}
      />
    );
    expect(screen.getByText("Testlandia · Common")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View on NationStates" })).toHaveAttribute(
      "href",
      "https://www.nationstates.net/nation=testlandia"
    );
  });

  it("shows no level for a copy whose sheet facts are missing", () => {
    render(<CardBackProvenance face={face()} copy={null} artCredit={null} ns={null} />);
    expect(screen.getByText("#7 · Foil")).toBeInTheDocument();
    expect(screen.queryByText(/^Level/)).toBeNull();
  });
});

describe("CardTilt", () => {
  beforeEach(() => jest.mocked(useFacetReducedMotion).mockReturnValue(false));

  it("leans the card toward the pointer and lights its holo where the pointer is", () => {
    const { container } = render(
      <CardTilt>
        <p>The card</p>
      </CardTilt>
    );
    const holo = container.querySelector<HTMLElement>(".card-holo");
    expect(holo).not.toBeNull();
    expect(holo).toHaveAttribute("aria-hidden", "true");
    const stage = container.firstElementChild!;
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 140 }) as DOMRect;
    // jsdom has no PointerEvent, so a MouseEvent of that type carries the coordinates.
    fireEvent(stage, new MouseEvent("pointermove", { bubbles: true, clientX: 25, clientY: 105 }));
    expect(holo!.style.getPropertyValue("--holo-x")).toBe("25%");
    expect(holo!.style.getPropertyValue("--holo-y")).toBe("75%");
  });

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
