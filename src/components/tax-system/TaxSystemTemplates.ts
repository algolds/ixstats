/**
 * Tax System Templates
 *
 * Pre-configured tax system templates for different economic models
 * and government structures.
 */

import type { TaxSystemTemplate } from "~/types/tax-system";
import { CALCULATION_METHODS } from "~/types/tax-system";

export const taxSystemTemplates: TaxSystemTemplate[] = [
  {
    name: "Caphirian Imperial Tax System",
    description: "Complex multi-tiered system based on Imperial administrative structure",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Imperial Income Tax",
        categoryType: "Direct Tax",
        description: "Progressive tax on individual income with imperial service benefits",
        baseRate: 5,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 15000, rate: 0, marginalRate: true },
          { minIncome: 15000, maxIncome: 40000, rate: 8, marginalRate: true },
          { minIncome: 40000, maxIncome: 85000, rate: 18, marginalRate: true },
          { minIncome: 85000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, maxIncome: 500000, rate: 38, marginalRate: true },
          { minIncome: 500000, rate: 45, marginalRate: true },
        ],
        exemptions: [
          {
            exemptionName: "Imperial Service Exemption",
            exemptionType: "Individual",
            description: "Tax reduction for military/civil service",
            exemptionAmount: 8000,
          },
          {
            exemptionName: "Provincial Resident Exemption",
            exemptionType: "Geographic",
            description: "Regional development incentive",
            exemptionAmount: 5000,
          },
        ],
        deductions: [
          {
            deductionName: "Professional Development",
            deductionType: "Itemized",
            description: "Education and professional training expenses",
            maximumAmount: 12000,
          },
          {
            deductionName: "Family Support",
            deductionType: "Standard",
            description: "Dependents and family care expenses",
            maximumAmount: 18000,
          },
        ],
      },
      {
        categoryName: "Corporate Profits Tax",
        categoryType: "Direct Tax",
        description: "Tiered corporate tax with sector-specific rates",
        baseRate: 22,
        calculationMethod: CALCULATION_METHODS.TIERED,
        brackets: [
          { minIncome: 0, maxIncome: 100000, rate: 15, marginalRate: false },
          { minIncome: 100000, maxIncome: 1000000, rate: 22, marginalRate: false },
          { minIncome: 1000000, rate: 28, marginalRate: false },
        ],
        exemptions: [
          {
            exemptionName: "Strategic Industry Incentive",
            exemptionType: "Sector",
            description: "Reduced rates for key industries",
            exemptionRate: 30,
          },
          {
            exemptionName: "Research & Development Credit",
            exemptionType: "Corporate",
            description: "R&D investment tax credit",
            exemptionRate: 25,
          },
        ],
      },
      {
        categoryName: "Imperial Commerce Tax",
        categoryType: "Indirect Tax",
        description: "Comprehensive VAT with luxury surcharges",
        baseRate: 18,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 8, marginalRate: false }, // Essential goods
          { minIncome: 1000, maxIncome: 10000, rate: 18, marginalRate: false }, // Standard goods
          { minIncome: 10000, rate: 35, marginalRate: false }, // Luxury goods
        ],
      },
      {
        categoryName: "Imperial Estate Tax",
        categoryType: "Direct Tax",
        description: "Progressive wealth transfer tax",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 500000, rate: 0, marginalRate: true },
          { minIncome: 500000, maxIncome: 2000000, rate: 25, marginalRate: true },
          { minIncome: 2000000, maxIncome: 10000000, rate: 40, marginalRate: true },
          { minIncome: 10000000, rate: 55, marginalRate: true },
        ],
      },
      {
        categoryName: "Provincial Development Tax",
        categoryType: "Direct Tax",
        description: "Regional infrastructure and development funding",
        baseRate: 2,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Progressive Tax System",
    description: "Multi-bracket progressive system with standard deductions",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Tax on individual income",
        baseRate: 10,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 25000, rate: 10, marginalRate: true },
          { minIncome: 25000, maxIncome: 75000, rate: 22, marginalRate: true },
          { minIncome: 75000, maxIncome: 200000, rate: 32, marginalRate: true },
          { minIncome: 200000, rate: 37, marginalRate: true },
        ],
        exemptions: [
          {
            exemptionName: "Standard Exemption",
            exemptionType: "Individual",
            description: "Standard personal exemption",
            exemptionAmount: 12000,
          },
        ],
        deductions: [
          {
            deductionName: "Standard Deduction",
            deductionType: "Standard",
            description: "Standard deduction for all taxpayers",
            maximumAmount: 25000,
          },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Tax on corporate profits",
        baseRate: 21,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "Small Business Exemption",
            exemptionType: "Corporate",
            description: "Exemption for small businesses",
            exemptionAmount: 50000,
          },
        ],
      },
      {
        categoryName: "Value Added Tax",
        categoryType: "Indirect Tax",
        description: "Tax on goods and services",
        baseRate: 15,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Flat Tax System",
    description: "Simple flat rate tax system",
    fiscalYear: "calendar",
    progressiveTax: false,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Flat rate tax on all income",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "Personal Exemption",
            exemptionType: "Individual",
            description: "Basic personal exemption",
            exemptionAmount: 15000,
          },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Flat rate corporate tax",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
  {
    name: "Nordic Social Democratic Model",
    description: "High-tax, high-service comprehensive welfare state model",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Highly progressive with extensive social benefits",
        baseRate: 15,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 20000, rate: 15, marginalRate: true },
          { minIncome: 20000, maxIncome: 50000, rate: 28, marginalRate: true },
          { minIncome: 50000, maxIncome: 100000, rate: 42, marginalRate: true },
          { minIncome: 100000, rate: 55, marginalRate: true },
        ],
      },
      {
        categoryName: "Social Security Tax",
        categoryType: "Direct Tax",
        description: "Comprehensive social insurance contributions",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
      {
        categoryName: "Value Added Tax",
        categoryType: "Indirect Tax",
        description: "High VAT with reduced rates for necessities",
        baseRate: 25,
        calculationMethod: CALCULATION_METHODS.TIERED,
        brackets: [
          { minIncome: 0, maxIncome: 1000, rate: 6, marginalRate: false }, // Food, books
          { minIncome: 1000, maxIncome: 5000, rate: 12, marginalRate: false }, // Public transport
          { minIncome: 5000, rate: 25, marginalRate: false }, // Standard rate
        ],
      },
    ],
  },
  {
    name: "East Asian Developmental Model",
    description: "Business-friendly system promoting economic growth",
    fiscalYear: "calendar",
    progressiveTax: true,
    categories: [
      {
        categoryName: "Personal Income Tax",
        categoryType: "Direct Tax",
        description: "Moderate progressive rates with high thresholds",
        baseRate: 8,
        calculationMethod: CALCULATION_METHODS.PROGRESSIVE,
        brackets: [
          { minIncome: 0, maxIncome: 30000, rate: 8, marginalRate: true },
          { minIncome: 30000, maxIncome: 80000, rate: 18, marginalRate: true },
          { minIncome: 80000, maxIncome: 200000, rate: 28, marginalRate: true },
          { minIncome: 200000, rate: 35, marginalRate: true },
        ],
      },
      {
        categoryName: "Corporate Income Tax",
        categoryType: "Direct Tax",
        description: "Low corporate rates with generous incentives",
        baseRate: 17,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
        exemptions: [
          {
            exemptionName: "High-Tech Industry Incentive",
            exemptionType: "Sector",
            description: "Reduced rates for technology companies",
            exemptionRate: 50,
          },
          {
            exemptionName: "Export Business Credit",
            exemptionType: "Corporate",
            description: "Credits for export-oriented businesses",
            exemptionRate: 25,
          },
        ],
      },
      {
        categoryName: "Consumption Tax",
        categoryType: "Indirect Tax",
        description: "Moderate consumption tax to encourage savings",
        baseRate: 10,
        calculationMethod: CALCULATION_METHODS.PERCENTAGE,
      },
    ],
  },
];
