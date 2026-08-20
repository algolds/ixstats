import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CabinetPanel } from "~/components/executive/politics/CabinetPanel";

const mockAppointMutate = jest.fn();
const mockRemoveMutate = jest.fn();
const mockInvalidate = jest.fn();

let mockStructureData: ReturnType<typeof createStructure> | null = null;
let mockOfficialsData: ReturnType<typeof createOfficial>[] = [];

jest.mock("~/trpc/react", () => ({
  api: {
    government: {
      getByCountryId: {
        useQuery: () => ({ data: mockStructureData, isLoading: false }),
      },
    },
    meetings: {
      getOfficials: {
        useQuery: () => ({ data: mockOfficialsData, isLoading: false }),
      },
      appointOfficial: {
        useMutation: () => ({ mutate: mockAppointMutate, isPending: false }),
      },
      removeOfficial: {
        useMutation: () => ({ mutate: mockRemoveMutate, isPending: false }),
      },
    },
    useUtils: () => ({
      meetings: { getOfficials: { invalidate: mockInvalidate } },
    }),
  },
}));

function createStructure(departments: { id: string; name: string; ministerTitle?: string }[]) {
  return {
    id: "gs-1",
    countryId: "c-1",
    governmentName: "Test Government",
    departments,
  };
}

function createOfficial(overrides: {
  id: string;
  departmentId: string;
  name: string;
  title: string;
  role?: string;
}) {
  return {
    id: `off-${overrides.id}`,
    governmentStructureId: "gs-1",
    departmentId: overrides.departmentId,
    name: overrides.name,
    title: overrides.title,
    role: overrides.role ?? "Cabinet Member",
    bio: null,
    appointedDate: new Date("2026-01-01"),
    isActive: true,
    department: null,
  };
}

describe("CabinetPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStructureData = null;
    mockOfficialsData = [];
  });

  it("renders department list and appointed officials", () => {
    mockStructureData = createStructure([
      { id: "d-1", name: "Foreign Affairs", ministerTitle: "Minister" },
      { id: "d-2", name: "Defense", ministerTitle: "Secretary" },
    ]);
    mockOfficialsData = [
      createOfficial({
        id: "1",
        departmentId: "d-1",
        name: "Elena Vance",
        title: "Minister of Foreign Affairs",
      }),
    ];

    render(<CabinetPanel countryId="c-1" />);

    expect(screen.getByText("Cabinet")).toBeInTheDocument();
    expect(screen.getByText("Foreign Affairs")).toBeInTheDocument();
    expect(screen.getByText("Defense")).toBeInTheDocument();
    expect(screen.getByText("Elena Vance")).toBeInTheDocument();
    expect(screen.getByText("Minister of Foreign Affairs · Cabinet Member")).toBeInTheDocument();
  });

  it('renders "Vacant" for a department with no official', () => {
    mockStructureData = createStructure([
      { id: "d-1", name: "Foreign Affairs", ministerTitle: "Minister" },
      { id: "d-2", name: "Defense", ministerTitle: "Secretary" },
    ]);
    mockOfficialsData = [
      createOfficial({
        id: "1",
        departmentId: "d-1",
        name: "Elena Vance",
        title: "Minister of Foreign Affairs",
      }),
    ];

    render(<CabinetPanel countryId="c-1" />);

    const vacantBadges = screen.getAllByText("Vacant");
    expect(vacantBadges).toHaveLength(1);
    expect(screen.getByText("Defense")).toBeInTheDocument();
  });

  it("opens the appoint form and submits with the correct departmentId", async () => {
    mockStructureData = createStructure([
      { id: "d-1", name: "Foreign Affairs", ministerTitle: "Minister" },
    ]);
    mockOfficialsData = [];

    render(<CabinetPanel countryId="c-1" />);

    fireEvent.click(screen.getByRole("button", { name: /appoint/i }));

    expect(await screen.findByText(/appoint a minister to foreign affairs/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: "Marcus Thorne" } });
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: "Minister" } });
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: "Cabinet Member" } });
    fireEvent.change(screen.getByLabelText(/appointed date/i), { target: { value: "2026-06-16" } });

    fireEvent.click(screen.getByRole("button", { name: /^appoint$/iu }));

    await waitFor(() => {
      expect(mockAppointMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          governmentStructureId: "gs-1",
          departmentId: "d-1",
          name: "Marcus Thorne",
          title: "Minister",
          role: "Cabinet Member",
          bio: undefined,
        })
      );
    });

    const call = mockAppointMutate.mock.calls[0][0];
    expect(call.appointedDate).toBeInstanceOf(Date);
  });
});
