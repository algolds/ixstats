/**
 * P1-22 / F27 / realm time D2a: the readiness card shows the derived 0-100 shares as they are (readiness, equipment
 * quality, training; no typed technology or morale) and no unpersisted DEFCON controls.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { ReadinessOverviewCard } from "~/components/mycountry/domains/defense/command/ReadinessOverviewCard";

it("shows a readiness of 1 as 1%, with no DEFCON or projection controls", () => {
  render(<ReadinessOverviewCard averageReadiness={1} averageQuality={50} averageTraining={100} />);
  expect(screen.getByText("1%")).toBeTruthy();
  expect(screen.getByText("Quality")).toBeTruthy();
  expect(screen.getByText("Training")).toBeTruthy();
  expect(screen.queryByText("Morale")).toBeNull();
  expect(screen.queryByText(/DEFCON/)).toBeNull();
  expect(screen.queryByText(/Force projection/)).toBeNull();
});
