/** A day of a realm's calendar: the date picker for Gregorian months, typed text for the founder's own. */
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { RealmDayInput, realmDayStart } from "~/components/realms/RealmDayInput";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { CLOCK_NOW, DAY, ixnayReader, sixTimesReader } from "~/tests/fixtures/realm-readers";

describe("RealmDayInput", () => {
  it("uses the date picker on a Gregorian calendar, through its offset", () => {
    const onChange = jest.fn();
    render(
      <RealmDayInput
        id="d"
        calendar={ixnayReader().calendar}
        value={CLOCK_NOW}
        onChange={onChange}
      />
    );
    const input = screen.getByDisplayValue("2041-06-02");
    expect(input).toHaveAttribute("type", "date");
    fireEvent.change(input, { target: { value: "2041-06-05" } });
    expect(onChange).toHaveBeenCalledWith(Date.UTC(2041, 5, 5));
  });

  it("takes typed dates in the founder's months", () => {
    const frost = sixTimesReader().calendar;
    const onChange = jest.fn();
    render(<RealmDayInput id="d" calendar={frost} value={CLOCK_NOW} onChange={onChange} />);
    const input = screen.getByDisplayValue("14 Thaw 812 AE");
    fireEvent.change(input, { target: { value: "4 Frostfall 812" } });
    const picked = onChange.mock.calls[0]![0] as number;
    expect(formatRealmDate(picked, frost)).toBe("4 Frostfall 812 AE");
    expect(picked).toBe(realmDayStart(CLOCK_NOW + 20 * DAY, frost));
  });

  it("flags a date the calendar lacks, or one before the earliest allowed", () => {
    const frost = sixTimesReader().calendar;
    const onChange = jest.fn();
    render(
      <RealmDayInput id="d" calendar={frost} value={null} min={CLOCK_NOW} onChange={onChange} />
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "41 Frostfall 812" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    fireEvent.change(input, { target: { value: "2 Thaw 812" } });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows a day set from outside, and keeps the text a user is typing", () => {
    const frost = sixTimesReader().calendar;
    let setFromOutside: (ms: number) => void = () => undefined;
    function Harness() {
      const [value, setValue] = React.useState<number | null>(null);
      setFromOutside = setValue;
      return <RealmDayInput id="d" calendar={frost} value={value} onChange={setValue} />;
    }
    render(<Harness />);
    act(() => setFromOutside(CLOCK_NOW));
    const input = screen.getByDisplayValue("14 Thaw 812 AE");
    fireEvent.change(input, { target: { value: "4 Frostfall 812" } });
    expect(screen.getByDisplayValue("4 Frostfall 812")).toBeInTheDocument();
    act(() => setFromOutside(CLOCK_NOW + DAY));
    expect(screen.getByDisplayValue("15 Thaw 812 AE")).toBeInTheDocument();
  });
});
