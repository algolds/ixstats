/**
 * The map's credit block (bottom right): a realm's credit line sits with IxStates' own, in the same style, and is
 * always shown (the realm's art may be licensed on condition of credit).
 */
import { render, screen } from "@testing-library/react";
import { MapKeyboardControls } from "~/components/maps/core/MapKeyboardControls";

const mapRef = { current: null };

describe("map credit block", () => {
  it("shows the realm's credit line above IxStates' own", () => {
    render(
      <MapKeyboardControls
        mapRef={mapRef}
        attribution="Map: Eurth community, via eurth-map by Seth Harrison"
      />
    );
    const credit = screen.getByText("Map: Eurth community, via eurth-map by Seth Harrison");
    const block = screen.getByText(/© 2026 Ixnay/);
    expect(block).toContainElement(credit);
    expect(block.textContent).toMatch(/^Map: Eurth community.*© 2026 Ixnay/);
  });

  it("shows only IxStates' credit without one", () => {
    render(<MapKeyboardControls mapRef={mapRef} attribution={null} />);
    expect(screen.getByText(/© 2026 Ixnay/).textContent).toBe("© 2026 IxnayPowered by IxStates");
  });
});
