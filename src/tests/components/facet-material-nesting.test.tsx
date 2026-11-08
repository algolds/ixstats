import { render, screen } from "@testing-library/react";

import { Card, LensSurface, SurfaceReset } from "~/components/ui/card";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { LENS_FILTER_ID, LensFilter } from "~/components/ui/facet/shared/LensFilter";

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

  it("a Card on a lens is a well", () => {
    render(
      <FacetMaterial layer="lens">
        <Card data-testid="c" />
      </FacetMaterial>
    );
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "well");
  });
});

describe("Lens", () => {
  it("one shared filter serves every lens", () => {
    const { container } = render(
      <>
        <LensFilter />
        <FacetMaterial layer="lens" data-testid="a" />
        <Card variant="lens" data-testid="b" />
      </>
    );
    expect(container.querySelectorAll("filter")).toHaveLength(1);
    expect(container.querySelector(`filter#${LENS_FILTER_ID} feDisplacementMap`)).not.toBeNull();
    expect(screen.getByTestId("a")).toHaveClass("facet-lens");
    expect(screen.getByTestId("b")).toHaveAttribute("data-variant", "lens");
  });

  it("LensSurface makes top-level Cards lenses and keeps nested ones wells", () => {
    render(
      <LensSurface>
        <Card data-testid="top">
          <Card data-testid="inner" />
        </Card>
      </LensSurface>
    );
    expect(screen.getByTestId("top")).toHaveAttribute("data-variant", "lens");
    expect(screen.getByTestId("inner")).toHaveAttribute("data-variant", "well");
  });

  it("an overlay inside a LensSurface starts as a pane again", () => {
    render(
      <LensSurface>
        <SurfaceReset>
          <Card data-testid="c" />
        </SurfaceReset>
      </LensSurface>
    );
    expect(screen.getByTestId("c")).toHaveAttribute("data-variant", "pane");
  });
});
