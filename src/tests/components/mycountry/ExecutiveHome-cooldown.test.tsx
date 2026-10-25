/**
 * The agenda's directive line counts down to the next slot on the nation's realm clock (the server's clock for
 * directive slots): in real time at the realm's speed, and "Paused" while the realm is stopped.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { DirectiveStatusLine } from "~/components/mycountry/shell/DirectiveStatusLine";
import { NationClockProvider } from "~/hooks/useNationClock";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import {
  CLOCK_NOW,
  DAY,
  ixnayReader,
  pausedReader,
  sixTimesReader,
} from "~/tests/fixtures/realm-readers";

let cooldownUntil: number | null = null;
jest.mock("~/trpc/react", () => ({
  api: {
    intent: {
      getStatus: {
        useQuery: () => ({ data: { canCommit: false, usedThisWeek: 3, cap: 3, cooldownUntil } }),
      },
    },
  },
}));

const renderLine = (clock: RealmClockReader | null) =>
  render(
    <NationClockProvider value={clock}>
      <DirectiveStatusLine countryId="c1" />
    </NationClockProvider>
  );

describe("DirectiveStatusLine", () => {
  it("reads the slot cooldown on the realm clock, not wall time", () => {
    // A week out on Ixnay's ×2 clock is three and a half real days.
    cooldownUntil = CLOCK_NOW + 7 * DAY;
    renderLine(ixnayReader());
    expect(screen.getByText("Next directive in 3d 12h")).toBeInTheDocument();
  });

  it("counts down at a 6× realm's speed", () => {
    cooldownUntil = CLOCK_NOW + 6 * DAY;
    renderLine(sixTimesReader());
    expect(screen.getByText("Next directive in 1d 0h")).toBeInTheDocument();
  });

  it("shows Paused instead of a countdown in a paused realm", () => {
    cooldownUntil = CLOCK_NOW + DAY;
    renderLine(pausedReader());
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.queryByText(/Next directive in/)).toBeNull();
  });

  it("shows a placeholder while the clock loads", () => {
    cooldownUntil = CLOCK_NOW + DAY;
    renderLine(null);
    expect(screen.getByText("Next directive in –")).toBeInTheDocument();
  });
});
