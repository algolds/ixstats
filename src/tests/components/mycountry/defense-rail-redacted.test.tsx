/** P2-9: the Defense rail shows another nation's branches as strength bands, not exact headcounts. */
import React from "react";
import { render, screen } from "@testing-library/react";

jest.mock("~/hooks/useDefenseConsole", () => ({
  useDefenseOverview: () => ({
    owner: null,
    redacted: {
      countryId: "c2",
      redacted: true,
      doctrine: "balanced",
      alertInEffect: "peacetime",
      branches: [
        {
          id: "x",
          domain: "land",
          name: "Royal Army",
          strength: { low: 10_000, high: 20_000 },
          reserveStrength: { low: 5_000, high: 10_000 },
        },
      ],
    },
  }),
}));
jest.mock("~/trpc/react", () => ({
  api: new Proxy(
    {},
    { get: () => new Proxy({}, { get: () => ({ useQuery: () => ({ data: undefined }) }) }) }
  ),
}));

import { DefenseRail } from "~/components/mycountry/shell/rails/DefenseRail";

it("shows a band for another nation's branch", () => {
  render(<DefenseRail countryId="c2" />);
  expect(screen.getByText("Royal Army")).toBeTruthy();
  expect(screen.getByText("10,000 to 20,000 active")).toBeTruthy();
});
