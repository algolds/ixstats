/** VT-12: the passport photo wears the holder's equipped glow and frame for every visitor. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/components/vault/CosmeticParticles", () => ({ CosmeticParticles: () => null }));

import { PassportPortrait } from "~/components/passport/document/PassportPortrait";
import { noPublicCosmetics, type PublicCosmetics } from "~/lib/vault/public-cosmetics";

function cosmetics(over: Partial<PublicCosmetics>): PublicCosmetics {
  return { ...noPublicCosmetics(), ...over };
}

describe("PassportPortrait", () => {
  it("renders the plain photo when nothing is equipped", () => {
    const { container } = render(
      <PassportPortrait displayName="Ada" avatarUrl={null} cosmetics={null} />
    );
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(container.querySelector("[style*='box-shadow']")).toBeNull();
  });

  it("wraps the photo in the holder's avatar glow", () => {
    const { container } = render(
      <PassportPortrait
        displayName="Ada"
        avatarUrl="https://example.com/a.png"
        cosmetics={cosmetics({
          equipped: ["glow"],
          avatarGlow: { enabled: true, color: "rgb(1, 2, 3)", intensity: "15px" },
        })}
      />
    );
    expect(screen.getByAltText("Ada")).toBeInTheDocument();
    const glow = container.firstElementChild as HTMLElement;
    expect(glow.style.boxShadow).toContain("rgb(1, 2, 3)");
  });

  it("draws the holder's neon frame over the photo", () => {
    const { container } = render(
      <PassportPortrait
        displayName="Ada"
        avatarUrl={null}
        cosmetics={cosmetics({
          equipped: ["frame"],
          neonFrame: { enabled: true, color: "rgb(4, 5, 6)", style: "pulse" },
        })}
      />
    );
    expect(container.innerHTML).toContain("rgb(4, 5, 6)");
  });
});
