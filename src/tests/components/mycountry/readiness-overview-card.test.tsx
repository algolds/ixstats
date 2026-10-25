/** P1-22 / F27: the readiness card shows 0-100 averages as they are and no unpersisted DEFCON controls. */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ReadinessOverviewCard } from "~/components/mycountry/domains/defense/command/ReadinessOverviewCard";

it("shows a readiness of 1 as 1%, with no DEFCON or projection controls", () => {
  render(<ReadinessOverviewCard averageReadiness={1} averageTechnology={50} averageMorale={100} />);
  expect(screen.getByText("1%")).toBeTruthy();
  expect(screen.queryByText(/DEFCON/)).toBeNull();
  expect(screen.queryByText(/Force projection/)).toBeNull();
});
