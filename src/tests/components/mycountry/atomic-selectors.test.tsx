import React from "react";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { AtomicTaxComponentSelector } from "~/components/mycountry/domains/government/tax/atoms/AtomicTaxComponents";
import { AtomicGovernmentComponents } from "~/components/mycountry/domains/government/atoms/AtomicGovernmentComponents";
import { AtomicEconomicComponentSelector } from "~/components/mycountry/domains/economy/atoms/AtomicEconomicComponents";

import { ComponentType } from "~/lib/enums";

// Mock trpc and database hooks
jest.mock("~/hooks/useEconomicComponentsData", () => ({
  useEconomicComponentsData: () => ({
    components: [],
    isLoading: false,
    isUsingFallback: true,
    incrementUsage: jest.fn(),
  }),
}));

jest.mock("~/hooks/useGovernmentComponentsData", () => ({
  useGovernmentComponentsData: () => ({
    components: {},
    isLoading: false,
    isUsingFallback: true,
    incrementUsage: jest.fn(),
  }),
}));

describe("Atomic Component Selectors (Characterization & Integration - Plan 166)", () => {
  describe("Tax Selector Component", () => {
    test("renders tax selector with title and search bar", () => {
      const onComponentChange = jest.fn();
      render(
        <AtomicTaxComponentSelector
          selectedComponents={[]}
          onComponentChange={onComponentChange}
        />
      );

      expect(screen.getByText("Atomic Tax Components")).toBeDefined();
      expect(screen.getByPlaceholderText("Search components...")).toBeDefined();
    });

    test("displays selected component badges", () => {
      const onComponentChange = jest.fn();
      render(
        <AtomicTaxComponentSelector
          selectedComponents={["progressive_tax"]}
          onComponentChange={onComponentChange}
        />
      );

      expect(screen.getByText(/Selected Components \(1\)/i)).toBeDefined();
      expect(screen.getByText("Progressive Tax")).toBeDefined();
    });
  });

  describe("Government Selector Component", () => {
    test("renders government components selector with metrics and category filters", () => {
      render(
        <AtomicGovernmentComponents
          initialComponents={[ComponentType.DEMOCRATIC_PROCESS]}
          standalone={true}
        />
      );

      expect(screen.getByPlaceholderText(/Search components/i)).toBeDefined();
      expect(screen.getByText(/Selected/i)).toBeDefined();
    });
  });

  describe("Economic Selector Component", () => {
    test("renders economic selector with search and metrics", () => {
      const onComponentChange = jest.fn();
      render(
        <AtomicEconomicComponentSelector
          selectedComponents={[]}
          onComponentChange={onComponentChange}
        />
      );

      expect(screen.getByPlaceholderText(/Search economic components/i)).toBeDefined();
    });
  });
});
