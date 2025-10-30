/**
 * Revenue-Tax Integration Service
 *
 * This service handles bidirectional synchronization between government builder revenue sources
 * and tax builder tax categories, ensuring they stay in sync and understand each other's context.
 */

import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import type { TaxCategoryInput, TaxBracketInput, CALCULATION_METHODS } from "~/types/tax-system";

export interface CollectionMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  isTaxRelated: boolean;
  taxCategoryType?: string;
  calculationMethod?: string;
  defaultRate?: number;
}

export interface RevenueTaxMapping {
  revenueCategory: RevenueCategory;
  taxCategoryType: string;
  calculationMethod: string;
  defaultRate: number;
  brackets?: TaxBracketInput[];
  exemptions?: any[];
  deductions?: any[];
}

export class RevenueTaxIntegrationService {
  private static instance: RevenueTaxIntegrationService;
  private listeners: Array<(data: any) => void> = [];

  public static getInstance(): RevenueTaxIntegrationService {
    if (!RevenueTaxIntegrationService.instance) {
      RevenueTaxIntegrationService.instance = new RevenueTaxIntegrationService();
    }
    return RevenueTaxIntegrationService.instance;
  }

  // Collection Methods with Icons and Tax Integration
  public readonly COLLECTION_METHODS: CollectionMethod[] = [
    {
      id: "automatic_deduction",
      name: "Automatic Deduction",
      description: "Automatically deducted from income/salary",
      icon: "Zap",
      color: "#059669",
      isTaxRelated: true,
      taxCategoryType: "Direct Tax",
      calculationMethod: "progressive",
      defaultRate: 15,
    },
    {
      id: "self_assessment",
      name: "Self Assessment",
      description: "Taxpayers calculate and pay themselves",
      icon: "Calculator",
      color: "#0891b2",
      isTaxRelated: true,
      taxCategoryType: "Direct Tax",
      calculationMethod: "progressive",
      defaultRate: 20,
    },
    {
      id: "point_of_sale",
      name: "Point of Sale",
      description: "Collected at time of purchase/transaction",
      icon: "CreditCard",
      color: "#dc2626",
      isTaxRelated: true,
      taxCategoryType: "Indirect Tax",
      calculationMethod: "percentage",
      defaultRate: 10,
    },
    {
      id: "withholding_tax",
      name: "Withholding Tax",
      description: "Deducted at source by payers",
      icon: "Shield",
      color: "#7c3aed",
      isTaxRelated: true,
      taxCategoryType: "Direct Tax",
      calculationMethod: "percentage",
      defaultRate: 25,
    },
    {
      id: "annual_return",
      name: "Annual Return",
      description: "Filed annually with tax returns",
      icon: "FileText",
      color: "#ea580c",
      isTaxRelated: true,
      taxCategoryType: "Direct Tax",
      calculationMethod: "progressive",
      defaultRate: 18,
    },
    {
      id: "direct_billing",
      name: "Direct Billing",
      description: "Government bills directly for services",
      icon: "Receipt",
      color: "#059669",
      isTaxRelated: false,
      taxCategoryType: "Non-Tax Revenue",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
    {
      id: "licensing_fee",
      name: "Licensing Fee",
      description: "Periodic fees for licenses/permits",
      icon: "FileCheck",
      color: "#0891b2",
      isTaxRelated: false,
      taxCategoryType: "Fees and Fines",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
    {
      id: "fine_penalty",
      name: "Fine/Penalty",
      description: "One-time fines and penalties",
      icon: "AlertTriangle",
      color: "#dc2626",
      isTaxRelated: false,
      taxCategoryType: "Fees and Fines",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
    {
      id: "royalty_payment",
      name: "Royalty Payment",
      description: "Payments for resource extraction",
      icon: "Mountain",
      color: "#7c3aed",
      isTaxRelated: false,
      taxCategoryType: "Non-Tax Revenue",
      calculationMethod: "percentage",
      defaultRate: 12,
    },
    {
      id: "dividend_distribution",
      name: "Dividend Distribution",
      description: "Profits from state-owned enterprises",
      icon: "TrendingUp",
      color: "#059669",
      isTaxRelated: false,
      taxCategoryType: "Non-Tax Revenue",
      calculationMethod: "percentage",
      defaultRate: 8,
    },
  ];

  // Revenue Category to Tax Category Mappings
  public readonly REVENUE_TAX_MAPPINGS: RevenueTaxMapping[] = [
    {
      revenueCategory: "Direct Tax",
      taxCategoryType: "Direct Tax",
      calculationMethod: "progressive",
      defaultRate: 15,
      brackets: [
        {
          minIncome: 0,
          maxIncome: 15000,
          rate: 0,
          marginalRate: true,
          isActive: true,
          priority: 1,
        },
        {
          minIncome: 15000,
          maxIncome: 40000,
          rate: 10,
          marginalRate: true,
          isActive: true,
          priority: 2,
        },
        {
          minIncome: 40000,
          maxIncome: 85000,
          rate: 20,
          marginalRate: true,
          isActive: true,
          priority: 3,
        },
        { minIncome: 85000, rate: 30, marginalRate: true, isActive: true, priority: 4 },
      ],
    },
    {
      revenueCategory: "Indirect Tax",
      taxCategoryType: "Indirect Tax",
      calculationMethod: "percentage",
      defaultRate: 10,
      brackets: [{ minIncome: 0, rate: 10, marginalRate: false, isActive: true, priority: 1 }],
    },
    {
      revenueCategory: "Non-Tax Revenue",
      taxCategoryType: "Non-Tax Revenue",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
    {
      revenueCategory: "Fees and Fines",
      taxCategoryType: "Fees and Fines",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
    {
      revenueCategory: "Other",
      taxCategoryType: "Other",
      calculationMethod: "fixed",
      defaultRate: 0,
    },
  ];

  /**
   * Convert revenue sources to tax categories
   */
  public revenueSourcesToTaxCategories(revenueSources: RevenueSourceInput[]): TaxCategoryInput[] {
    const taxCategories: TaxCategoryInput[] = [];

    revenueSources.forEach((revenue, index) => {
      if (this.isTaxRelated(revenue)) {
        const mapping = this.getMappingForRevenueCategory(revenue.category);
        const collectionMethod = this.getCollectionMethod(revenue.collectionMethod || "");

        const taxCategory: TaxCategoryInput = {
          categoryName: revenue.name,
          categoryType: mapping.taxCategoryType,
          description: revenue.description || `${revenue.name} tax collection`,
          baseRate: revenue.rate || mapping.defaultRate,
          calculationMethod: (collectionMethod?.calculationMethod || mapping.calculationMethod) as
            | "fixed"
            | "percentage"
            | "progressive"
            | "tiered",
          minimumAmount: 0,
          maximumAmount: undefined,
          exemptionAmount: 0,
          deductionAllowed: mapping.taxCategoryType === "Direct Tax",
          standardDeduction: mapping.taxCategoryType === "Direct Tax" ? 10000 : undefined,
          priority: index + 1,
          color: this.getCategoryColor(revenue.category),
          icon: this.getCategoryIcon(revenue.category),
          isActive: true,
        };

        taxCategories.push(taxCategory);
      }
    });

    return taxCategories;
  }

  /**
   * Convert tax categories to revenue sources
   */
  public taxCategoriesToRevenueSources(
    taxCategories: TaxCategoryInput[],
    totalRevenue: number
  ): RevenueSourceInput[] {
    const revenueSources: RevenueSourceInput[] = [];

    taxCategories.forEach((taxCategory, index) => {
      const revenueCategory = this.getRevenueCategoryForTaxType(taxCategory.categoryType);
      const collectionMethod = this.getDefaultCollectionMethod(taxCategory.categoryType);

      // Calculate revenue amount based on tax category
      const revenueAmount = this.calculateRevenueAmount(taxCategory, totalRevenue);

      const revenueSource: RevenueSourceInput = {
        name: taxCategory.categoryName,
        category: revenueCategory,
        description: taxCategory.description || `${taxCategory.categoryName} revenue collection`,
        rate: taxCategory.baseRate,
        revenueAmount: revenueAmount,
        revenuePercent: totalRevenue > 0 ? (revenueAmount / totalRevenue) * 100 : 0,
        collectionMethod: collectionMethod.id,
        administeredBy: this.getDefaultAdministrator(taxCategory.categoryType),
      };

      revenueSources.push(revenueSource);
    });

    return revenueSources;
  }

  /**
   * Get tax brackets for a revenue source
   */
  public getTaxBracketsForRevenueSource(revenueSource: RevenueSourceInput): TaxBracketInput[] {
    if (!this.isTaxRelated(revenueSource)) return [];

    const mapping = this.getMappingForRevenueCategory(revenueSource.category);
    return mapping.brackets || [];
  }

  /**
   * Sync revenue sources with tax categories
   */
  public syncRevenueWithTax(
    revenueSources: RevenueSourceInput[],
    taxCategories: TaxCategoryInput[],
    totalRevenue: number
  ): { revenueSources: RevenueSourceInput[]; taxCategories: TaxCategoryInput[] } {
    // Create a map of existing tax categories by name
    const existingTaxMap = new Map(taxCategories.map((tc) => [tc.categoryName, tc]));

    // Update revenue sources based on tax categories
    const updatedRevenueSources = revenueSources.map((revenue) => {
      const existingTax = existingTaxMap.get(revenue.name);
      if (existingTax && this.isTaxRelated(revenue)) {
        return {
          ...revenue,
          rate: existingTax.baseRate,
          description: existingTax.description || revenue.description,
          collectionMethod: this.getCollectionMethodByTaxCategory(existingTax),
        };
      }
      return revenue;
    });

    // Add new revenue sources for tax categories that don't exist
    const newRevenueSources = taxCategories
      .filter((tc) => !revenueSources.some((rs) => rs.name === tc.categoryName))
      .map((tc) => {
        const revenueCategory = this.getRevenueCategoryForTaxType(tc.categoryType);
        const collectionMethod = this.getDefaultCollectionMethod(tc.categoryType);
        const revenueAmount = this.calculateRevenueAmount(tc, totalRevenue);

        return {
          name: tc.categoryName,
          category: revenueCategory,
          description: tc.description || `${tc.categoryName} revenue collection`,
          rate: tc.baseRate,
          revenueAmount: revenueAmount,
          revenuePercent: totalRevenue > 0 ? (revenueAmount / totalRevenue) * 100 : 0,
          collectionMethod: collectionMethod.id,
          administeredBy: this.getDefaultAdministrator(tc.categoryType),
        };
      });

    // Update tax categories based on revenue sources
    const updatedTaxCategories = taxCategories.map((tc) => {
      const matchingRevenue = revenueSources.find((rs) => rs.name === tc.categoryName);
      if (matchingRevenue && this.isTaxRelated(matchingRevenue)) {
        return {
          ...tc,
          baseRate: matchingRevenue.rate || tc.baseRate,
          description: matchingRevenue.description || tc.description,
        };
      }
      return tc;
    });

    // Add new tax categories for revenue sources that don't exist
    const newTaxCategories = revenueSources
      .filter(
        (rs) => !taxCategories.some((tc) => tc.categoryName === rs.name) && this.isTaxRelated(rs)
      )
      .map((rs) => {
        const mapping = this.getMappingForRevenueCategory(rs.category);
        const collectionMethod = this.getCollectionMethod(rs.collectionMethod || "");

        return {
          categoryName: rs.name,
          categoryType: mapping.taxCategoryType,
          description: rs.description || `${rs.name} tax collection`,
          baseRate: rs.rate || mapping.defaultRate,
          calculationMethod: (collectionMethod?.calculationMethod || mapping.calculationMethod) as
            | "fixed"
            | "percentage"
            | "progressive"
            | "tiered",
          minimumAmount: 0,
          maximumAmount: undefined,
          exemptionAmount: 0,
          deductionAllowed: mapping.taxCategoryType === "Direct Tax",
          standardDeduction: mapping.taxCategoryType === "Direct Tax" ? 10000 : undefined,
          priority: taxCategories.length + 1,
          color: this.getCategoryColor(rs.category),
          icon: this.getCategoryIcon(rs.category),
          isActive: true,
        };
      });

    return {
      revenueSources: [...updatedRevenueSources, ...newRevenueSources],
      taxCategories: [...updatedTaxCategories, ...newTaxCategories],
    };
  }

  /**
   * Get department recommendations for revenue sources
   */
  public getDepartmentRecommendations(revenueCategory: RevenueCategory): string[] {
    const recommendations: Record<RevenueCategory, string[]> = {
      "Direct Tax": ["Ministry of Finance", "Tax Authority", "Revenue Service"],
      "Indirect Tax": ["Ministry of Finance", "Customs Authority", "Revenue Service"],
      "Non-Tax Revenue": ["Ministry of Finance", "Treasury Department", "State Assets Management"],
      "Fees and Fines": ["Ministry of Justice", "Regulatory Authority", "Law Enforcement"],
      Other: ["Ministry of Finance", "Treasury Department"],
    };

    return recommendations[revenueCategory] || ["Ministry of Finance"];
  }

  /**
   * Calculate budget impact of revenue changes
   */
  public calculateBudgetImpact(revenueSources: RevenueSourceInput[], departments: any[]): any {
    const totalRevenue = revenueSources.reduce((sum, rs) => sum + rs.revenueAmount, 0);
    const categoryBreakdown = this.getCategoryBreakdown(revenueSources);
    const departmentCapacity = this.assessDepartmentCapacity(departments, revenueSources);

    return {
      totalRevenue,
      categoryBreakdown,
      departmentCapacity,
      collectionEfficiency: this.calculateCollectionEfficiency(revenueSources),
      complianceRate: this.calculateComplianceRate(revenueSources),
    };
  }

  // Private helper methods
  private isTaxRelated(revenueSource: RevenueSourceInput): boolean {
    return revenueSource.category === "Direct Tax" || revenueSource.category === "Indirect Tax";
  }

  private getMappingForRevenueCategory(category: RevenueCategory): RevenueTaxMapping {
    return (
      this.REVENUE_TAX_MAPPINGS.find((m) => m.revenueCategory === category) ||
      this.REVENUE_TAX_MAPPINGS[0]
    );
  }

  private getCollectionMethod(methodId: string): CollectionMethod | undefined {
    return this.COLLECTION_METHODS.find((m) => m.id === methodId);
  }

  private getCollectionMethodByTaxCategory(taxCategory: TaxCategoryInput): string {
    const method = this.COLLECTION_METHODS.find(
      (m) => m.taxCategoryType === taxCategory.categoryType && m.isTaxRelated
    );
    return method?.id || "self_assessment";
  }

  private getDefaultCollectionMethod(taxCategoryType: string): CollectionMethod {
    return (
      this.COLLECTION_METHODS.find(
        (m) => m.taxCategoryType === taxCategoryType && m.isTaxRelated
      ) || this.COLLECTION_METHODS[0]
    );
  }

  private getRevenueCategoryForTaxType(taxCategoryType: string): RevenueCategory {
    const mapping = this.REVENUE_TAX_MAPPINGS.find((m) => m.taxCategoryType === taxCategoryType);
    return mapping?.revenueCategory || "Other";
  }

  private calculateRevenueAmount(taxCategory: TaxCategoryInput, totalRevenue: number): number {
    // Simple calculation - in reality this would be more complex
    const defaultPercentage = this.getDefaultPercentageForTaxType(taxCategory.categoryType);
    return totalRevenue * (defaultPercentage / 100);
  }

  private getDefaultPercentageForTaxType(taxCategoryType: string): number {
    const percentages: Record<string, number> = {
      "Direct Tax": 35,
      "Indirect Tax": 25,
      "Non-Tax Revenue": 20,
      "Fees and Fines": 10,
      Other: 10,
    };
    return percentages[taxCategoryType] || 10;
  }

  private getDefaultAdministrator(taxCategoryType: string): string {
    const administrators: Record<string, string> = {
      "Direct Tax": "Tax Authority",
      "Indirect Tax": "Customs Authority",
      "Non-Tax Revenue": "Treasury Department",
      "Fees and Fines": "Ministry of Justice",
      Other: "Ministry of Finance",
    };
    return administrators[taxCategoryType] || "Ministry of Finance";
  }

  private getCategoryColor(category: RevenueCategory): string {
    const colors: Record<RevenueCategory, string> = {
      "Direct Tax": "#059669",
      "Indirect Tax": "#0891b2",
      "Non-Tax Revenue": "#7c3aed",
      "Fees and Fines": "#ea580c",
      Other: "#6b7280",
    };
    return colors[category];
  }

  private getCategoryIcon(category: RevenueCategory): string {
    const icons: Record<RevenueCategory, string> = {
      "Direct Tax": "Receipt",
      "Indirect Tax": "Building2",
      "Non-Tax Revenue": "DollarSign",
      "Fees and Fines": "FileText",
      Other: "MoreHorizontal",
    };
    return icons[category];
  }

  private getCategoryBreakdown(revenueSources: RevenueSourceInput[]): any {
    return revenueSources.reduce((breakdown, rs) => {
      if (!breakdown[rs.category]) {
        breakdown[rs.category] = { count: 0, amount: 0 };
      }
      breakdown[rs.category].count++;
      breakdown[rs.category].amount += rs.revenueAmount;
      return breakdown;
    }, {} as any);
  }

  private assessDepartmentCapacity(departments: any[], revenueSources: RevenueSourceInput[]): any {
    // Simplified capacity assessment
    return {
      totalCapacity: departments.length * 100,
      utilizationRate: revenueSources.length / departments.length,
      recommendations: ["Increase tax collection staff", "Implement digital systems"],
    };
  }

  private calculateCollectionEfficiency(revenueSources: RevenueSourceInput[]): number {
    // Simplified efficiency calculation
    const taxSources = revenueSources.filter((rs) => this.isTaxRelated(rs));
    return taxSources.length > 0 ? 85 : 70; // Default efficiency rates
  }

  private calculateComplianceRate(revenueSources: RevenueSourceInput[]): number {
    // Simplified compliance calculation
    const taxSources = revenueSources.filter((rs) => this.isTaxRelated(rs));
    return taxSources.length > 0 ? 90 : 75; // Default compliance rates
  }

  // Event system for real-time updates
  public subscribe(listener: (data: any) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public notify(data: any): void {
    this.listeners.forEach((listener) => listener(data));
  }
}

// Export singleton instance
export const revenueTaxIntegrationService = RevenueTaxIntegrationService.getInstance();
