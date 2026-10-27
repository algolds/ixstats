/** The cultural exchange wizard schedules on the host nation's realm clock and calendar. */
import React from "react";
import { fireEvent, render, renderHook, screen } from "@testing-library/react";

jest.mock("~/trpc/react", () => ({
  api: {
    countries: { getAll: { useQuery: () => ({ data: undefined, isLoading: false }) } },
    users: { getProfile: { useQuery: () => ({ data: undefined }) } },
  },
}));

import { WizardStepSettings } from "~/components/mycountry/domains/diplomacy/exchange-wizard/WizardStepSettings";
import { useExchangeWizardForm } from "~/components/mycountry/domains/diplomacy/exchange-wizard/useExchangeWizardForm";
import { NationClockProvider } from "~/hooks/useNationClock";
import { formatRealmDate } from "~/lib/realms/realm-clock";
import { CLOCK_NOW, DAY, sixTimesReader } from "~/tests/fixtures/realm-readers";

const frost = sixTimesReader();
const wire = (ms: number) => new Date(ms).toISOString().slice(0, 10);

describe("exchange wizard dates", () => {
  it("starts on today of the nation's realm clock", () => {
    const { result } = renderHook(() => useExchangeWizardForm({ id: "c1", name: "Frostmark" }), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <NationClockProvider value={frost}>{children}</NationClockProvider>
      ),
    });
    expect(
      formatRealmDate(Date.parse(`${result.current.todayDate}T00:00:00Z`), frost.calendar)
    ).toBe("14 Thaw 812 AE");
    expect(result.current.data.startDate).toBe(result.current.todayDate);
    expect(result.current.calendar).toBe(frost.calendar);
  });

  it("shows today and takes dates in the realm's own months", () => {
    const today = wire(Math.floor(CLOCK_NOW / DAY) * DAY);
    const onEnd = jest.fn();
    render(
      <WizardStepSettings
        startDate={today}
        onStartDateChange={jest.fn()}
        endDate=""
        onEndDateChange={onEnd}
        todayDate={today}
        calendar={frost.calendar}
        maxParticipants={100}
        onMaxParticipantsChange={jest.fn()}
        isPublic
        onIsPublicChange={jest.fn()}
      />
    );
    expect(screen.getByText("Today: 14 Thaw 812 AE")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("End date *"), { target: { value: "4 Frostfall 812" } });
    expect(onEnd).toHaveBeenCalledWith(wire(Math.floor(CLOCK_NOW / DAY) * DAY + 20 * DAY));
  });
});
