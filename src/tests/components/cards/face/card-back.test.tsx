import { render } from "@testing-library/react";
import { CardBack } from "~/components/cards/face/CardBack";

const realm = { id: "default", slug: "ixnay", name: "Ixnay", crestUrl: null, isSystem: false };
const card = { rarity: "RARE", realm, season: null, number: 7 } as const;
const marks = (container: HTMLElement) => ({
  logos: container.querySelectorAll("pattern image").length,
  icons: container.querySelectorAll("pattern path").length,
});

describe("CardBack's mark", () => {
  it("repeats a lore card's category icon", () => {
    const { container } = render(
      <CardBack card={{ ...card, cardType: "LORE", category: "HISTORY" }} size="S" />
    );
    expect(marks(container)).toMatchObject({ logos: 0 });
    expect(marks(container).icons).toBeGreaterThan(0);
  });

  it("repeats a trophy's realm mark, not its Special category icon", () => {
    const { container } = render(
      <CardBack card={{ ...card, cardType: "TROPHY", category: "SPECIAL" }} size="S" />
    );
    expect(marks(container)).toMatchObject({ icons: 0 });
    expect(container.querySelector("pattern image")?.getAttribute("href")).toMatch(/ix-logo\.svg$/);
  });
});
