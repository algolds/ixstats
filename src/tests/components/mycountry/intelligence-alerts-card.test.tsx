// MC-17: the overview rail card lists open intelligence alerts and resolves them.
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

const mockAlerts = { current: [] as unknown[] };
const mockMutate = {
  read: jest.fn(),
  all: jest.fn(),
  dismiss: jest.fn(),
};

jest.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
jest.mock("~/hooks/useNotify", () => ({ useNotify: () => ({ error: jest.fn() }) }));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({ intelligence: { getMyAlerts: { invalidate: jest.fn() } } }),
    intelligence: {
      getMyAlerts: {
        useQuery: () => ({
          data: {
            alerts: mockAlerts.current,
            openCount: mockAlerts.current.length,
            unreadCount: 1,
          },
        }),
      },
      markAlertRead: { useMutation: () => ({ mutate: mockMutate.read, isPending: false }) },
      markAllAlertsRead: { useMutation: () => ({ mutate: mockMutate.all, isPending: false }) },
      dismissAlert: { useMutation: () => ({ mutate: mockMutate.dismiss, isPending: false }) },
    },
  },
}));

import { IntelligenceAlertsCard } from "~/components/mycountry/shell/IntelligenceAlertsCard";

const alert = (id: string, severity: string, readAt: Date | null) => ({
  id,
  title: `${id} breached ${severity.toLowerCase()} threshold`,
  description: "Current value: 12.00",
  severity,
  detectedAt: new Date(),
  readAt,
});

describe("IntelligenceAlertsCard", () => {
  beforeEach(() => {
    Object.values(mockMutate).forEach((m) => m.mockClear());
  });

  it("renders nothing while there are no open alerts", () => {
    mockAlerts.current = [];
    const { container } = render(<IntelligenceAlertsCard countryId="c1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lists alerts with their severity and resolves them", () => {
    mockAlerts.current = [alert("gdp", "CRITICAL", null), alert("trade", "HIGH", new Date())];
    render(<IntelligenceAlertsCard countryId="c1" />);

    expect(screen.getByRole("heading", { name: "Intelligence alerts" })).toBeInTheDocument();
    expect(screen.getByText("2 open, 1 unread")).toBeInTheDocument();
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();

    // Only the unread alert offers "Mark read".
    const markRead = screen.getAllByRole("button", { name: "Mark read" });
    expect(markRead).toHaveLength(1);
    fireEvent.click(markRead[0]!);
    expect(mockMutate.read).toHaveBeenCalledWith({ id: "gdp" });

    fireEvent.click(screen.getAllByRole("button", { name: "Dismiss" })[1]!);
    expect(mockMutate.dismiss).toHaveBeenCalledWith({ id: "trade" });

    fireEvent.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(mockMutate.all).toHaveBeenCalledWith({ countryId: "c1" });
  });
});
