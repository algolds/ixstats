import { render, screen } from "@testing-library/react";

import { Card, LensSurface, SurfaceReset } from "~/components/ui/card";
import { FacetMaterial } from "~/components/ui/facet/shared/FacetMaterial";
import { LENS_FILTER_ID, LensFilter } from "~/components/ui/facet/shared/LensFilter";
import { LensCard } from "~/components/ui/lens-card";

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

  it("shares a viewport-fixed monogram coordinate space across multiple LensCards and falls back to a well when nested", () => {
    const { container } = render(
      <div>
        <LensCard app="exchange" data-testid="card-a" className="space-y-4 lg:col-span-4">
          <LensCard app="exchange" data-testid="nested-lens-card" />
        </LensCard>
        <LensCard app="exchange" data-testid="card-b" className="max-w-3xl space-y-3" />
      </div>
    );
    const cardA = screen.getByTestId("card-a");
    const cardB = screen.getByTestId("card-b");
    expect(cardA).toHaveAttribute("data-variant", "lens");
    expect(cardA).toHaveClass("space-y-4");
    expect(cardA.closest("[data-slot='lens-card']")).toHaveClass("lg:col-span-4", "min-w-0");

    expect(cardB).toHaveAttribute("data-variant", "lens");
    expect(cardB).toHaveClass("space-y-3");
    expect(cardB.closest("[data-slot='lens-card']")).toHaveClass("max-w-3xl");

    expect(screen.getByTestId("nested-lens-card")).toHaveAttribute("data-variant", "well");

    const stages = container.querySelectorAll("[data-slot='lens-monogram-stage']");
    expect(stages).toHaveLength(2);
    const monograms = container.querySelectorAll(".facet-monogram");
    expect(monograms).toHaveLength(4);
    for (const plane of monograms) {
      expect(plane).toHaveClass("fixed", "-inset-6");
    }
  });
});
