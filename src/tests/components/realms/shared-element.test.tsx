import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { countryTransitionName, SharedElement } from "~/components/ui/view-transition";

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

  it("omits ViewTransition when name is null and sanitises country transition names", () => {
    mockReduced = false;
    expect(countryTransitionName("face", "new.caphiria")).toBe("country-face-new-caphiria");
    expect(countryTransitionName("flag", "caphiria")).toBe("country-flag-caphiria");
    expect(countryTransitionName("title", "   ")).toBeNull();
    expect(countryTransitionName("title", null)).toBeNull();

    const { container } = render(
      <SharedElement name={countryTransitionName("flag", null)}>
        <span>flag</span>
      </SharedElement>
    );
    expect(container.querySelector("[data-vt]")).toBeNull();
    expect(container.textContent).toBe("flag");
  });
});
