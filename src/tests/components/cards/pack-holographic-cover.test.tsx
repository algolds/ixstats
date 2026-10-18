/** The pack cover's own words: the pack's name and the IxCards mark, in sentence case (no uppercase label). */
import React from "react";
import { render, screen } from "@testing-library/react";
import { PackHolographicCover } from "~/components/cards/pack-opening/PackHolographicCover";

describe("PackHolographicCover", () => {
  it.each(["sm", "md", "lg"] as const)(
    "marks a %s cover IxCards as the name is written, never as an uppercase label",
    (size) => {
      render(
        <PackHolographicCover packType="BASIC" packName="Season I Recruit Pack" size={size} />
      );
      const mark = screen.getByText("IxCards");
      expect(mark).not.toHaveClass("uppercase");
      expect(mark.className).not.toMatch(/\btracking-/);
    }
  );
});
