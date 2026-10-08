import { fireEvent, render, screen } from "@testing-library/react";
import { CountryGrowthEditor } from "~/app/admin/_components/CountryGrowthEditor";

const mutate = jest.fn();
const country = {
  id: "c1",
  updatedAt: "2026-10-07T00:00:00Z",
  economicTier: "Strong",
  populationGrowthRate: 0.01,
  adjustedGdpGrowth: 0.03,
  maxGdpGrowthRate: 0.05,
  localGrowthFactor: 1,
};

jest.mock("~/hooks/useNotify", () => ({
  useNotify: () => ({ success: jest.fn(), info: jest.fn(), error: jest.fn(), warning: jest.fn() }),
}));
jest.mock("~/trpc/react", () => ({
  api: {
    useUtils: () => ({
      admin: { getCountryDetail: { invalidate: jest.fn() } },
      countries: { getByIdWithEconomicData: { invalidate: jest.fn() } },
    }),
    admin: {
      getCountryDetail: { useQuery: () => ({ data: { country }, isLoading: false }) },
      updateCountryGrowth: { useMutation: () => ({ mutate, isPending: false }) },
    },
  },
}));

describe("CountryGrowthEditor", () => {
  beforeEach(() => mutate.mockClear());

  it("shows the stored rates as percents, the factor as a multiplier, and the tier's cap", () => {
    render(<CountryGrowthEditor countryId="c1" />);
    expect(screen.getByLabelText("Population growth (%)")).toHaveValue(1);
    expect(screen.getByLabelText("Adjusted GDP growth (%)")).toHaveValue(3);
    expect(screen.getByLabelText("Max GDP growth (%)")).toHaveValue(5);
    expect(screen.getByLabelText("Local growth factor (x)")).toHaveValue(1);
    expect(screen.getByText(/Its tier caps GDP growth at 2.75%/)).toBeInTheDocument();
    expect(screen.getByText("0.5 to 2")).toBeInTheDocument();
  });

  it("saves the fields as decimals", () => {
    render(<CountryGrowthEditor countryId="c1" />);
    fireEvent.change(screen.getByLabelText("Population growth (%)"), {
      target: { value: "0.625" },
    });
    fireEvent.change(screen.getByLabelText("Local growth factor (x)"), {
      target: { value: "1.2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save growth" }));
    expect(mutate).toHaveBeenCalledWith({
      countryId: "c1",
      growth: {
        populationGrowthRate: 0.00625,
        adjustedGdpGrowth: 0.03,
        maxGdpGrowthRate: 0.05,
        localGrowthFactor: 1.2,
      },
    });
  });

  it("refuses a value out of range", () => {
    render(<CountryGrowthEditor countryId="c1" />);
    fireEvent.change(screen.getByLabelText("Local growth factor (x)"), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent("within its range");
    expect(screen.getByRole("button", { name: "Save growth" })).toBeDisabled();
  });
});
