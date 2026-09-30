import React from "react";
import {
  Dollar as DollarSign,
  Page as Receipt,
  City as Building2,
  Page as FileText,
  MoreHoriz as MoreHorizontal,
  Flash as Zap,
  Calculator,
  CreditCard,
  Shield,
  PageSearch as FileCheck,
  WarningTriangle as AlertTriangle,
  ModernTv as Mountain,
} from "iconoir-react";
import {
  type RevenueCategory,
  type CollectionMethod,
  COLLECTION_METHODS,
} from "~/types/government";

export const revenueCategories: RevenueCategory[] = [
  "Direct Tax",
  "Indirect Tax",
  "Non-Tax Revenue",
  "Fees and Fines",
  "Other",
];

export const revenueCategoryIcons: Record<
  RevenueCategory,
  React.ComponentType<{ className?: string; style?: React.CSSProperties }>
> = {
  "Direct Tax": Receipt,
  "Indirect Tax": Building2,
  "Non-Tax Revenue": DollarSign,
  "Fees and Fines": FileText,
  Other: MoreHorizontal,
};

export const revenueCategoryColors: Record<RevenueCategory, string> = {
  "Direct Tax": "#10b981", // Emerald
  "Indirect Tax": "#06b6d4", // Cyan
  "Non-Tax Revenue": "#8b5cf6", // Purple
  "Fees and Fines": "#f97316", // Orange
  Other: "#71717a", // Zinc
};

export const commonRevenueSources: Record<RevenueCategory, string[]> = {
  "Direct Tax": [
    "Personal Income Tax",
    "Corporate Income Tax",
    "Capital Gains Tax",
    "Estate Tax",
    "Property Tax",
  ],
  "Indirect Tax": [
    "Value Added Tax (VAT)",
    "Goods and Services Tax (GST)",
    "Sales Tax",
    "Excise Tax",
    "Customs Duties",
  ],
  "Non-Tax Revenue": [
    "SOE Profits",
    "Resource Royalties",
    "Investment Returns",
    "Asset Sales",
    "Licensing Fees",
  ],
  "Fees and Fines": [
    "Court Fines",
    "Traffic Fines",
    "Regulatory Fees",
    "Service Charges",
    "Permit Fees",
  ],
  Other: ["Foreign Aid", "Grants", "Borrowing", "Special Levies"],
};

export function getCollectionMethodIcon(
  iconName: string
): React.ComponentType<{ className?: string; style?: React.CSSProperties }> {
  const iconMap: Record<
    string,
    React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  > = {
    Zap,
    Calculator,
    CreditCard,
    Shield,
    FileText,
    FileCheck,
    AlertTriangle,
    Mountain,
    Receipt,
    DollarSign,
    Building2,
    MoreHorizontal,
  };
  return iconMap[iconName] || MoreHorizontal;
}

export function getCollectionMethodsForCategory(category: RevenueCategory): CollectionMethod[] {
  const allMethods = COLLECTION_METHODS;

  if (category === "Direct Tax") {
    return allMethods.filter((m) => m.isTaxRelated && m.taxCategoryType === "Direct Tax");
  } else if (category === "Indirect Tax") {
    return allMethods.filter((m) => m.isTaxRelated && m.taxCategoryType === "Indirect Tax");
  } else if (category === "Non-Tax Revenue") {
    return allMethods.filter((m) => !m.isTaxRelated && m.taxCategoryType === "Non-Tax Revenue");
  } else if (category === "Fees and Fines") {
    return allMethods.filter((m) => !m.isTaxRelated && m.taxCategoryType === "Fees and Fines");
  } else {
    return allMethods;
  }
}
