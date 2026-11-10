import { fireEvent, render, screen } from "@testing-library/react";
import { FlagImage } from "~/components/ui/facet/identity/FlagImage";
import { assetUrl } from "~/lib/base-path";

describe("FlagImage", () => {
  it("renders the flag image and falls back to the monogram on error, resetting when src changes", () => {
    const { container, rerender } = render(
      <FlagImage
        src="/flags/caphiria.png"
        name="Caphiria"
        alt="Flag of Caphiria"
        className="flag-img"
        monogramClassName="flag-monogram"
      />
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", assetUrl("/flags/caphiria.png"));
    expect(img).toHaveAttribute("alt", "Flag of Caphiria");
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveClass("flag-img");

    fireEvent.error(img!);
    expect(container.querySelector("img")).toBeNull();
    const monogram = screen.getByText("C");
    expect(monogram).toHaveClass("flag-monogram");
    expect(monogram).toHaveAttribute("aria-hidden");

    rerender(
      <FlagImage
        src="/flags/urcea.png"
        name="Urcea"
        alt="Flag of Urcea"
        className="flag-img"
        monogramClassName="flag-monogram"
        lazy={false}
      />
    );

    const nextImg = container.querySelector("img");
    expect(nextImg).not.toBeNull();
    expect(nextImg).toHaveAttribute("src", assetUrl("/flags/urcea.png"));
    expect(nextImg).not.toHaveAttribute("loading");
  });

  it("keeps protocol-relative URLs in the form returned by assetUrl", () => {
    const { container } = render(<FlagImage src="//x/y.png" name="Maresteyn" />);
    expect(container.querySelector("img")).toHaveAttribute("src", assetUrl("//x/y.png"));
    expect(assetUrl("//x/y.png")).toBe("//x/y.png");
  });
});
