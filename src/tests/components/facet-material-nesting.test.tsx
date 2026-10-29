import { render, screen } from "@testing-library/react";

import { Card, SurfaceReset } from "~/components/ui/card";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";

describe("FacetMaterial nesting", () => {
  it("a Card in chrome is a well", () => {
    render(
      <FacetMaterial layer="chrome">
        <Card data-testid="c" />
      </FacetMaterial>
    );
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "well");
  });

  it("an overlay inside chrome resets to a pane", () => {
    render(
      <FacetMaterial layer="chrome">
        <SurfaceReset>
          <Card data-testid="c" />
        </SurfaceReset>
      </FacetMaterial>
    );
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "pane");
  });

  it("a Card in an overlay material stays a pane", () => {
    render(
      <FacetMaterial layer="overlay">
        <Card data-testid="c" />
      </FacetMaterial>
    );
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "pane");
  });
});
