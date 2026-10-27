/**
 * P2-1: MyCountry's header shows the nation's date in its realm's calendar, with the speed when it is not ×2 and
 * "Paused" when stopped; a dash while the clock loads.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
import { NationClockProvider } from "~/hooks/useNationClock";
import { NationDateLine } from "~/components/realms/NationDateLine";
import { formatRealmDate, type RealmClockReader } from "~/lib/realms/realm-clock";
import { ixnayReader, pausedReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

jest.mock("~/hooks/useRealmClock", () => ({ useCountryClock: () => null, useRealmClock: () => null }));
jest.mock("~/hooks/useViewerRealmId", () => ({ useViewerRealmId: () => undefined }));

const renderLine = (reader: RealmClockReader | null) =>
  render(
    <NationClockProvider value={reader}>
      <NationDateLine />
    </NationClockProvider>
  );
const dateOf = (reader: RealmClockReader) =>
  formatRealmDate(Math.floor(reader.now() / 60_000) * 60_000, reader.calendar);

it("shows a 6× realm's date in its calendar with its speed", () => {
  const reader = sixTimesReader();
  renderLine(reader);
  expect(dateOf(reader)).toMatch(/AE$/);
  expect(screen.getByText(`${dateOf(reader)} · ×6`)).toBeTruthy();
});

it("says Paused for a stopped realm", () => {
  const reader = pausedReader();
  renderLine(reader);
  expect(screen.getByText(`${dateOf(reader)} · Paused`)).toBeTruthy();
});

it("shows the bare date at the usual ×2, and a dash while the clock loads", () => {
  const reader = ixnayReader();
  const { unmount } = renderLine(reader);
  expect(screen.getByText(dateOf(reader))).toBeTruthy();
  unmount();
  renderLine(null);
  expect(screen.getByText("–")).toBeTruthy();
});
