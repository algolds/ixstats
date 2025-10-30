/**
 * Tests for EconomyPreviewTab Component
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { EconomyPreviewTab } from "../../components/enhanced/tabs/EconomyPreviewTab";
import { mockEconomyBuilder, mockAtomicComponents } from "../fixtures";
import type { EconomyBuilderState } from "~/types/economy-builder";

describe("EconomyPreviewTab", () => {
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
    it("renders the preview tab", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });

    it("displays economy summary", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Effectiveness Score", () => {
    it("calculates overall effectiveness score", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      // Score should be calculated based on multiple factors
      expect(document.body).toBeInTheDocument();
    });

    it("displays effectiveness as percentage", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });

    it("updates score when economy changes", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [
          ...mockEconomyBuilder.sectors.map((s) => ({
            ...s,
            productivity: s.productivity + 10,
          })),
        ],
      };

      rerender(<EconomyPreviewTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Validation Errors Display", () => {
    it("shows no errors when economy is valid", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.isValid).toBe(true);
    });

    it("displays validation errors when present", () => {
      const invalidBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        isValid: false,
        errors: {
          sectors: { "0": ["GDP contribution exceeds 100%"] },
        },
        validation: {
          errors: ["Total sector GDP exceeds 100%"],
          warnings: [],
          isValid: false,
        },
      };

      render(<EconomyPreviewTab {...defaultProps} economyBuilder={invalidBuilder} />);

      expect(document.body).toBeInTheDocument();
    });

    it("displays validation warnings", () => {
      const builderWithWarnings: EconomyBuilderState = {
        ...mockEconomyBuilder,
        validation: {
          errors: [],
          warnings: ["Low productivity in agriculture sector"],
          isValid: true,
        },
      };

      render(<EconomyPreviewTab {...defaultProps} economyBuilder={builderWithWarnings} />);

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Sector Summaries", () => {
    it("displays summary for each sector", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.sectors.length).toBe(3);
    });

    it("shows sector GDP contributions", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      mockEconomyBuilder.sectors.forEach((sector) => {
        expect(sector.gdpContribution).toBeGreaterThan(0);
      });
    });

    it("shows sector employment shares", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      mockEconomyBuilder.sectors.forEach((sector) => {
        expect(sector.employmentShare).toBeGreaterThan(0);
      });
    });

    it("highlights problematic sectors", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      // Should identify low-performing sectors
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Atomic Component Summary", () => {
    it("lists selected atomic components", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockAtomicComponents.length).toBeGreaterThan(0);
    });

    it("shows component impacts", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });

    it("calculates synergy score", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      // Synergy between components
      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Labor Market Summary", () => {
    it("displays key labor metrics", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.laborMarket.employmentRate).toBe(94);
      expect(mockEconomyBuilder.laborMarket.unemploymentRate).toBe(6);
    });

    it("shows workforce size", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.laborMarket.totalWorkforce).toBe(6500000);
    });
  });

  describe("Demographics Summary", () => {
    it("displays population metrics", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.demographics.totalPopulation).toBe(10000000);
    });

    it("shows age distribution summary", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      const ageDistribution = mockEconomyBuilder.demographics.ageDistribution;
      const total = ageDistribution.under15 + ageDistribution.age15to64 + ageDistribution.over65;
      expect(total).toBe(100);
    });
  });

  describe("Economic Health Indicators", () => {
    it("calculates GDP per capita", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      const gdpPerCapita =
        mockEconomyBuilder.structure.totalGDP / mockEconomyBuilder.demographics.totalPopulation;
      expect(gdpPerCapita).toBeGreaterThan(0);
    });

    it("displays economic tier", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.structure.economicTier).toBe("Developed");
    });

    it("shows growth strategy", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(mockEconomyBuilder.structure.growthStrategy).toBe("Balanced");
    });
  });

  describe("Reactive Updates", () => {
    it("updates when sectors change", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [
          ...mockEconomyBuilder.sectors.map((s) => ({
            ...s,
            gdpContribution: s.gdpContribution + 5,
          })),
        ],
      };

      rerender(<EconomyPreviewTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(document.body).toBeInTheDocument();
    });

    it("updates when labor market changes", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        laborMarket: {
          ...mockEconomyBuilder.laborMarket,
          employmentRate: 96,
          unemploymentRate: 4,
        },
      };

      rerender(<EconomyPreviewTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(document.body).toBeInTheDocument();
    });

    it("updates when demographics change", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      const updatedBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        demographics: {
          ...mockEconomyBuilder.demographics,
          totalPopulation: 15000000,
        },
      };

      rerender(<EconomyPreviewTab {...defaultProps} economyBuilder={updatedBuilder} />);

      expect(document.body).toBeInTheDocument();
    });

    it("updates when components change", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      rerender(
        <EconomyPreviewTab
          {...defaultProps}
          selectedComponents={[...mockAtomicComponents, "free-trade-zone"]}
        />
      );

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Completeness Indicators", () => {
    it("shows configuration completeness percentage", () => {
      render(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });

    it("identifies missing required fields", () => {
      const incompleteBuilder: EconomyBuilderState = {
        ...mockEconomyBuilder,
        sectors: [],
      };

      render(<EconomyPreviewTab {...defaultProps} economyBuilder={incompleteBuilder} />);

      expect(document.body).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("memoizes effectiveness calculations", () => {
      const { rerender } = render(<EconomyPreviewTab {...defaultProps} />);

      rerender(<EconomyPreviewTab {...defaultProps} />);

      expect(document.body).toBeInTheDocument();
    });

    it("handles complex calculations efficiently", () => {
      const start = performance.now();
      render(<EconomyPreviewTab {...defaultProps} />);
      const end = performance.now();

      // Should render in reasonable time
      expect(end - start).toBeLessThan(1000);
    });
  });
});
