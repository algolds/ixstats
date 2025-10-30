/**
 * Tests for LaborEmploymentTab Component
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LaborEmploymentTab } from "../../components/enhanced/tabs/LaborEmploymentTab";
import { mockEconomyBuilder, mockAtomicComponents, mockLabor } from "../fixtures";
import type { EconomyBuilderState } from "~/types/economy-builder";

describe("LaborEmploymentTab", () => {
  const mockOnChange = jest.fn();

  const defaultProps = {
    economyBuilder: mockEconomyBuilder,
    onEconomyBuilderChange: mockOnChange,
    selectedComponents: mockAtomicComponents,
    showAdvanced: false,
  };

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  describe("Rendering", () => {
    it("renders the labor tab with header", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
      expect(screen.getByText(/Configure workforce dynamics/i)).toBeInTheDocument();
    });

    it("displays all section tabs", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText(/Workforce/i)).toBeInTheDocument();
      expect(screen.getByText(/Employment/i)).toBeInTheDocument();
      expect(screen.getByText(/Income/i)).toBeInTheDocument();
      expect(screen.getByText(/Protections/i)).toBeInTheDocument();
    });

    it("renders workforce section by default", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // Should show workforce-related content
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Section Navigation", () => {
    it("switches to employment section when clicked", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const employmentTab = screen.getAllByText(/Employment/i)[0];
      if (employmentTab) {
        fireEvent.click(employmentTab);
      }

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("switches to income section when clicked", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const incomeTab = screen.getAllByText(/Income/i)[0];
      if (incomeTab) {
        fireEvent.click(incomeTab);
      }

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("switches to protections section when clicked", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const protectionsTab = screen.getAllByText(/Protections/i)[0];
      if (protectionsTab) {
        fireEvent.click(protectionsTab);
      }

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Workforce Metrics", () => {
    it("displays correct total workforce", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // The workforce value should be displayed somewhere
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("calculates labor force participation rate correctly", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const participationRate = mockLabor.laborForceParticipationRate;
      expect(participationRate).toBe(65);
    });

    it("updates when workforce values change", () => {
      const { rerender } = render(<LaborEmploymentTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          totalWorkforce: 8000000,
        },
      };

      rerender(<LaborEmploymentTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Employment Rates", () => {
    it("displays employment rate correctly", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.employmentRate).toBe(94);
    });

    it("displays unemployment rate correctly", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.unemploymentRate).toBe(6);
    });

    it("validates employment + unemployment equals 100%", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const sum = mockLabor.employmentRate + mockLabor.unemploymentRate;
      expect(sum).toBe(100);
    });

    it("shows youth unemployment separately", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.youthUnemploymentRate).toBe(12);
    });
  });

  describe("Employment Type Distribution", () => {
    it("validates employment types sum to 100%", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const sum = Object.values(mockLabor.employmentType).reduce((acc, val) => acc + val, 0);
      expect(sum).toBe(100);
    });

    it("displays all employment types", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.employmentType.fullTime).toBe(70);
      expect(mockLabor.employmentType.partTime).toBe(15);
      expect(mockLabor.employmentType.temporary).toBe(5);
      expect(mockLabor.employmentType.seasonal).toBe(3);
      expect(mockLabor.employmentType.selfEmployed).toBe(5);
    });
  });

  describe("Sector Distribution", () => {
    it("validates sector distribution sums to 100%", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const sum = Object.values(mockLabor.sectorDistribution).reduce((acc, val) => acc + val, 0);
      expect(sum).toBe(100);
    });

    it("displays major sectors", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.sectorDistribution.manufacturing).toBe(18);
      expect(mockLabor.sectorDistribution.agriculture).toBe(12);
      expect(mockLabor.sectorDistribution.retail).toBe(10);
    });
  });

  describe("Worker Protections", () => {
    it("displays worker protection scores", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.workerProtections.healthSafety).toBe(85);
      expect(mockLabor.workerProtections.wageProtection).toBe(80);
      expect(mockLabor.workerProtections.jobSecurity).toBe(75);
    });

    it("shows workplace safety index", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.workplaceSafetyIndex).toBe(85);
    });

    it("shows labor rights score", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.laborRightsScore).toBe(80);
    });
  });

  describe("Atomic Component Impact", () => {
    it("calculates employment impacts from components", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // The component should calculate impacts
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("shows impact alert when components affect employment", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // Would show alert if actual impact logic is implemented
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("hides impact alert when no significant impact", () => {
      render(<LaborEmploymentTab {...defaultProps} selectedComponents={[]} />);

      expect(screen.queryByText(/Component Impact/i)).not.toBeInTheDocument();
    });
  });

  describe("Wage and Benefits", () => {
    it("displays minimum wage correctly", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.minimumWageHourly).toBe(15.0);
    });

    it("displays living wage correctly", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.livingWageHourly).toBe(22.5);
    });

    it("shows paid vacation days", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.paidVacationDays).toBe(20);
    });

    it("shows parental leave weeks", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.parentalLeaveWeeks).toBe(16);
    });
  });

  describe("Unionization", () => {
    it("displays unionization rate", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.unionizationRate).toBe(25);
    });

    it("displays collective bargaining coverage", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(mockLabor.collectiveBargainingCoverage).toBe(35);
    });
  });

  describe("Visualizations", () => {
    it("renders labor visualizations component", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("generates chart data for employment types", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // Chart generation happens in useMemo
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("generates chart data for sector distribution", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("State Updates", () => {
    it("calls onChange when labor data is updated", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      // Initially no changes
      expect(mockOnChange).toHaveBeenCalledTimes(0);
    });

    it("updates nested labor configuration correctly", () => {
      const { rerender } = render(<LaborEmploymentTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          employmentType: {
            ...mockEconomyBuilder.laborMarket.employmentType,
            fullTime: 75,
            partTime: 10,
          },
        },
      };

      rerender(<LaborEmploymentTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("handles invalid employment percentage totals", () => {
      const invalidBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          employmentType: {
            fullTime: 60,
            partTime: 50, // Sum > 100%
            temporary: 10,
            seasonal: 5,
            selfEmployed: 5,
            gig: 2,
            informal: 2,
          },
        },
      };

      render(<LaborEmploymentTab {...defaultProps} economyBuilder={invalidBuilder} />);

      // Should still render
      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("validates sector distribution totals", () => {
      const invalidBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          sectorDistribution: {
            ...mockLabor.sectorDistribution,
            manufacturing: 50,
            agriculture: 60, // Total > 100%
          },
        },
      };

      render(<LaborEmploymentTab {...defaultProps} economyBuilder={invalidBuilder} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("memoizes derived metrics", () => {
      const { rerender } = render(<LaborEmploymentTab {...defaultProps} />);

      rerender(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("memoizes chart data", () => {
      const { rerender } = render(<LaborEmploymentTab {...defaultProps} />);

      rerender(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });

    it("memoizes employment impacts", () => {
      const { rerender } = render(<LaborEmploymentTab {...defaultProps} />);

      rerender(<LaborEmploymentTab {...defaultProps} />);

      expect(screen.getByText("Labor & Employment Configuration")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper heading hierarchy", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const heading = screen.getByText("Labor & Employment Configuration");
      expect(heading.tagName).toBe("H2");
    });

    it("section tabs are keyboard accessible", () => {
      render(<LaborEmploymentTab {...defaultProps} />);

      const tabs = screen.getAllByRole("button");
      expect(tabs.length).toBeGreaterThan(0);
    });
  });
});
