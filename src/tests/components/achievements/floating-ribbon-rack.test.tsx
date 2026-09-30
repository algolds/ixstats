import { render } from "@testing-library/react";
import { FloatingRibbonRack } from "~/components/achievements/FloatingRibbonRack";
import { FORUM_RIBBONS } from "~/components/achievements/constants";

describe("FloatingRibbonRack", () => {
  it("renders nothing when no ribbon data is supplied (no hard-coded defaults)", () => {
    const { container } = render(<FloatingRibbonRack />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for unknown ribbon ids", () => {
    const { container } = render(<FloatingRibbonRack pinnedIds={["does-not-exist"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders supplied ribbons", () => {
    const id = FORUM_RIBBONS[0]!.id;
    const { container } = render(<FloatingRibbonRack pinnedIds={[id]} />);
    expect(container).not.toBeEmptyDOMElement();
  });
});
