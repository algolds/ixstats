/** @jest-environment node */
/** Meetings are scheduled on the host nation's realm clock and held at 09:00 of a day of its calendar. */
import {
  atNineAm,
  presetScheduledTime,
} from "~/components/executive/actions/meeting-scheduler-logic";
import { realmDayStart } from "~/components/realms/RealmDayInput";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { CLOCK_NOW, DAY, sixTimesReader } from "~/tests/fixtures/realm-readers";

const HOUR = 3_600_000;

describe("meeting times on the realm clock", () => {
  it("presets from the nation's own now", () => {
    const frost = sixTimesReader();
    expect(presetScheduledTime("immediately", frost.now(), frost.calendar)).toBe(CLOCK_NOW);
    expect(presetScheduledTime("tomorrow", frost.now(), frost.calendar)).toBe(CLOCK_NOW + DAY);
  });

  it("holds a custom date at 09:00 of the realm's calendar day", () => {
    const frost = sixTimesReader();
    const custom = presetScheduledTime("custom", frost.now(), frost.calendar);
    expect(formatRealmDate(custom, frost.calendar)).toBe("15 Thaw 812 AE");
    expect(custom).toBe(atNineAm(realmDayStart(CLOCK_NOW + DAY, frost.calendar)));
    const calendarMs = custom + frost.calendar.calendarOffsetMs;
    expect(((calendarMs % DAY) + DAY) % DAY).toBe(9 * HOUR);
  });
});
