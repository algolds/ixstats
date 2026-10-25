/** @jest-environment node */
/** Meetings are scheduled on the host nation's realm clock and picked in its calendar. */
import {
  fromDateInputValue,
  fromRealmDateText,
  presetScheduledTime,
  toDateInputValue,
} from "~/components/executive/actions/meeting-scheduler-logic";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

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
    const calendarMs = custom + frost.calendar.calendarOffsetMs;
    expect(((calendarMs % DAY) + DAY) % DAY).toBe(9 * HOUR);
  });

  it("round-trips a Gregorian date input through the calendar offset", () => {
    const ixnay = ixnayReader();
    expect(toDateInputValue(CLOCK_NOW, ixnay.calendar)).toBe("2041-06-02");
    expect(fromDateInputValue("2041-06-03", ixnay.calendar)).toBe(Date.UTC(2041, 5, 3, 9));
  });

  it("reads a typed date of a custom calendar, era optional", () => {
    const frost = sixTimesReader();
    const ms = fromRealmDateText("4 Frostfall 812", frost.calendar);
    expect(ms).not.toBeNull();
    expect(formatRealmDate(ms!, frost.calendar)).toBe("4 Frostfall 812 AE");
    expect(fromRealmDateText("4 Frostfall 812 AE", frost.calendar)).toBe(ms);
    expect(fromRealmDateText("41 Frostfall 812", frost.calendar)).toBeNull();
    expect(fromRealmDateText("4 March 812", frost.calendar)).toBeNull();
  });
});
