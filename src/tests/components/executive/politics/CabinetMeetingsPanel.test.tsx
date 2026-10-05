import { render, screen, fireEvent } from "@testing-library/react";
import { CabinetMeetingsPanel } from "~/components/executive/politics/CabinetMeetingsPanel";

const mockConcludeMutate = jest.fn();
let mockMeetings: Record<string, unknown>[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    meetings: {
      getMeetings: {
        useQuery: () => ({ data: mockMeetings, isLoading: false, refetch: jest.fn() }),
      },
      concludeMeeting: {
        useMutation: () => ({ mutate: mockConcludeMutate, isPending: false }),
      },
    },
  },
}));

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), error: jest.fn() }),
}));

const meeting = (overrides: Record<string, unknown>) => ({
  id: "m1",
  countryId: "c1",
  title: "Weekly cabinet",
  status: "scheduled",
  scheduledDate: new Date("2026-10-01"),
  notes: null,
  agendaItems: [{ id: "a1", title: "Budget review" }],
  decisions: [],
  ...overrides,
});

describe("CabinetMeetingsPanel", () => {
  beforeEach(() => mockConcludeMutate.mockClear());

  it("concludes an open meeting with its outcome", () => {
    mockMeetings = [meeting({})];
    render(<CabinetMeetingsPanel countryId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: "Conclude" }));
    fireEvent.change(screen.getByLabelText("Outcome"), {
      target: { value: "Budget agreed" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Conclude meeting" }));

    expect(mockConcludeMutate).toHaveBeenCalledWith({
      meetingId: "m1",
      outcome: "Budget agreed",
      decisions: [],
    });
  });

  it("shows a concluded meeting's outcome and decisions, without a Conclude action", () => {
    mockMeetings = [
      meeting({
        status: "completed",
        notes: "Budget agreed",
        decisions: [{ id: "d1", title: "Budget review", decisionType: "approved" }],
      }),
    ];
    render(<CabinetMeetingsPanel countryId="c1" />);

    expect(screen.getByText("Concluded")).toBeInTheDocument();
    expect(screen.getByText("Budget agreed")).toBeInTheDocument();
    expect(screen.getByText("Approved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Conclude" })).not.toBeInTheDocument();
  });

  it("hides the Conclude action from a non-owner", () => {
    mockMeetings = [meeting({})];
    render(<CabinetMeetingsPanel countryId="c1" canManage={false} />);
    expect(screen.queryByRole("button", { name: "Conclude" })).not.toBeInTheDocument();
  });
});
