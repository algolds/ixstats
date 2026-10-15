/** Manage → Time: switch the clock on (prefilled from the old in-world year), then speed and era with the cooldown. */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const startClock = jest.fn();
const updateClock = jest.fn();
jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ realms: { region: { invalidate: jest.fn() } } }),
    realms: {
      region: {
        startClock: { useMutation: () => ({ mutate: startClock, isPending: false }) },
        updateClock: { useMutation: () => ({ mutate: updateClock, isPending: false }) },
      },
    },
  },
}));

import { RealmTimeSection } from "~/app/r/[realm]/_components/manage/RealmTimeSection";
import { createRealmClock, SPEED_CHANGE_COOLDOWN_MS } from "~/lib/realms/realm-clock";

const base = { legacy: null, isIxnay: false, skipsCooldown: false };

describe("RealmTimeSection", () => {
  beforeEach(() => {
    startClock.mockReset();
    updateClock.mockReset();
  });

  it("prefills the start year from the old in-world offset and starts the clock", () => {
    render(
      <RealmTimeSection
        slug="eurth"
        time={{ ...base, clock: null, legacy: { mode: "offset", offset: -823, era: "AE" } }}
      />
    );
    const date = screen.getByLabelText("Start date") as HTMLInputElement;
    expect(date.value.slice(0, 4)).toBe(String(new Date().getUTCFullYear() - 823).padStart(4, "0"));
    expect((screen.getByLabelText("Era") as HTMLInputElement).value).toBe("AE");
    fireEvent.change(screen.getByLabelText("Speed"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Start the clock" }));
    expect(startClock).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "eurth", era: "AE", multiplier: 3 })
    );
  });

  it("shows Ixnay as global IxTime, with no controls", () => {
    render(<RealmTimeSection slug="ixnay" time={{ ...base, clock: null, isIxnay: true }} />);
    expect(screen.getByText(/global IxTime/)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("holds the founder's speed until the cooldown ends, but saves the era", () => {
    const clock = createRealmClock({
      globalNowMs: Date.UTC(2041, 0, 1),
      realNowMs: Date.now(),
      startDate: "1203-03-14",
      era: "AE",
      multiplier: 3,
    });
    render(<RealmTimeSection slug="eurth" time={{ ...base, clock }} />);
    expect(screen.getByLabelText("Speed")).toBeDisabled();
    expect(
      screen.getByText(
        `The speed can change again on ${new Date(clock.changedAt + SPEED_CHANGE_COOLDOWN_MS).toISOString().slice(0, 10)}.`
      )
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Era"), { target: { value: "NE" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(updateClock).toHaveBeenCalledWith({ slug: "eurth", era: "NE" });
  });
});
