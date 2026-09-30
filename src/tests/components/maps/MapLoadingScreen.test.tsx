import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "@jest/globals";
import { MapLoadingScreen } from "~/components/maps/core/MapLoadingScreen";

describe("MapLoadingScreen", () => {
  it("renders IxMaps title and loading status when isReady is false", () => {
    render(<MapLoadingScreen isReady={false} />);

    expect(screen.getByText("IxMaps")).toBeTruthy();
    expect(screen.getByText("Initializing the world...")).toBeTruthy();
    expect(screen.getByAltText("IxMaps")).toBeTruthy();
  });

  it("does not render loading overlay when isReady is true initially", () => {
    render(<MapLoadingScreen isReady={true} />);

    expect(screen.queryByText("IxMaps")).toBeNull();
    expect(screen.queryByText("Initializing the world...")).toBeNull();
  });
});
