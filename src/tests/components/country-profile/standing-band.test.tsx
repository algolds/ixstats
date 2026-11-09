/** The Country DNA row's facts strip: one snap tile per fact under the meters, dots to jump. */
import { fireEvent, render, screen, within } from "@testing-library/react";

jest.mock("~/trpc/react", () => jest.requireActual("../../../../jest-mocks/trpc-react"));

import { StandingBand } from "~/components/country-profile/StandingBand";

const fact = (key: string, label: string, value: string) => ({ key, label, value });
const FACTS = [
  fact("area", "Land area", "7.5M km²"),
  fact("climate", "Climate", "Steppe"),
  fact("currency", "Currency", "Aureus"),
];
const PILLARS = [{ key: "employment", label: "Employment", value: 95, display: "95.0%" }];

const band = (facts = FACTS) =>
  render(
    <StandingBand axes={[]} facts={facts} pillars={PILLARS} rings={[]} onOpenRings={() => {}} />
  );

describe("StandingBand facts strip", () => {
  it("shows the facts in pages of two, so a swipe never keeps a tile from the last page", () => {
    band();
    const strip = screen.getByRole("list", { name: "National facts" });
    expect(strip).toHaveAttribute("tabindex", "0");
    expect(strip).toHaveClass("snap-x", "snap-mandatory");
    const pages = within(strip).getAllByRole("listitem");
    expect(
      pages.map((p) =>
        within(p)
          .getAllByRole("term")
          .map((t) => t.textContent)
      )
    ).toEqual([["Land area", "Climate"], ["Currency"]]);
    // Each page is a full-width snap point.
    expect(pages[0]).toHaveClass("w-full", "snap-start");
    // The strip follows the meters in the same column.
    const meters = screen.getByText("Employment").closest("dl")!;
    expect(meters.nextElementSibling).toContainElement(strip);
  });

  it("has one dot per page that jumps to it", () => {
    const { container } = band();
    const strip = screen.getByRole("list", { name: "National facts" });
    const scrollTo = jest.fn();
    strip.scrollTo = scrollTo;
    const dots = container.querySelectorAll("button");
    expect(dots).toHaveLength(2);
    fireEvent.click(dots[1]!);
    expect(scrollTo).toHaveBeenCalledWith({ left: expect.any(Number) });
  });

  it("top-aligns its columns and drops the dots when one page holds every fact", () => {
    const { container, unmount } = band(FACTS.slice(0, 2));
    expect(screen.getByRole("region", { name: "Country DNA" })).toHaveClass("items-start");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    unmount();
    const empty = render(
      <StandingBand axes={[]} facts={[]} pillars={[]} rings={[]} onOpenRings={() => {}} />
    );
    expect(empty.container).toBeEmptyDOMElement();
  });
});
