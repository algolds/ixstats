import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { SharedElement } from "~/components/ui/view-transition";

let mockReduced = false;

// Jest resolves stable react, which has no ViewTransition.
jest.mock("react", () => ({
  ...jest.requireActual<typeof import("react")>("react"),
  ViewTransition: ({ name, children }: { name: string; children: ReactNode }) => (
    <div data-vt={name}>{children}</div>
  ),
}));
jest.mock("~/components/providers/FacetMotionConfig", () => ({
  useFacetReducedMotion: () => mockReduced,
}));

describe("SharedElement", () => {
  it("renders bare children under reduced motion", () => {
    mockReduced = true;
    const { container } = render(
      <SharedElement name="realm-map-ixnay">
        <span>face</span>
      </SharedElement>
    );
    expect(container.querySelector("[data-vt]")).toBeNull();
    expect(container.textContent).toBe("face");
  });

  it("renders through ViewTransition otherwise", () => {
    mockReduced = false;
    const { container } = render(
      <SharedElement name="realm-map-ixnay">
        <span>face</span>
      </SharedElement>
    );
    expect(container.querySelector('[data-vt="realm-map-ixnay"]')?.textContent).toBe("face");
  });
});
