"use client";

import React, { useState, useRef, useCallback } from "react";
import { usePendingLocks } from "~/app/mycountry/editor/hooks/usePendingLocks";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { GlassCard, GlassCardContent } from "~/app/builder/components/glass/GlassCard";
import { cn } from "~/lib/utils";
import {
  Plus,
  X,
  DollarSign,
  Receipt,
  Building2,
  FileText,
  MoreHorizontal,
  Zap,
  Calculator,
  CreditCard,
  Shield,
  FileCheck,
  AlertTriangle,
  Mountain,
  Coins,
} from "lucide-react";
import type { RevenueSourceInput, RevenueCategory } from "~/types/government";
import {
  revenueTaxIntegrationService,
  type CollectionMethod,
} from "~/app/builder/services/RevenueTaxIntegrationService";

interface RevenueSourceFormProps {
  data: RevenueSourceInput[];
  onChange: (data: RevenueSourceInput[]) => void;
  totalRevenue: number;
  currency: string;
  isReadOnly?: boolean;
  availableDepartments?: { id: string; name: string }[];
}

const revenueCategories: RevenueCategory[] = [
  "Direct Tax",
  "Indirect Tax",
  "Non-Tax Revenue",
  "Fees and Fines",
  "Other",
];

const revenueCategoryIcons = {
  "Direct Tax": Receipt,
  "Indirect Tax": Building2,
  "Non-Tax Revenue": DollarSign,
  "Fees and Fines": FileText,
  Other: MoreHorizontal,
};

const revenueCategoryColors = {
  "Direct Tax": "#10b981", // Emerald
  "Indirect Tax": "#06b6d4", // Cyan
  "Non-Tax Revenue": "#8b5cf6", // Purple
  "Fees and Fines": "#f97316", // Orange
  Other: "#71717a", // Zinc
};

const commonRevenueSources = {
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

// Icon mapping for collection methods
const getCollectionMethodIcon = (iconName: string) => {
  const iconMap: Record<string, any> = {
    Zap: Zap,
    Calculator: Calculator,
    CreditCard: CreditCard,
    Shield: Shield,
    FileText: FileText,
    FileCheck: FileCheck,
    AlertTriangle: AlertTriangle,
    Mountain: Mountain,
    Receipt: Receipt,
    DollarSign: DollarSign,
    Building2: Building2,
    MoreHorizontal: MoreHorizontal,
  };
  return iconMap[iconName] || MoreHorizontal;
};

// Get relevant collection methods for a revenue category
const getCollectionMethodsForCategory = (category: RevenueCategory): CollectionMethod[] => {
  const allMethods = revenueTaxIntegrationService.COLLECTION_METHODS;

  if (category === "Direct Tax") {
    return allMethods.filter((m) => m.isTaxRelated && m.taxCategoryType === "Direct Tax");
  } else if (category === "Indirect Tax") {
    return allMethods.filter((m) => m.isTaxRelated && m.taxCategoryType === "Indirect Tax");
  } else if (category === "Non-Tax Revenue") {
    return allMethods.filter((m) => !m.isTaxRelated && m.taxCategoryType === "Non-Tax Revenue");
  } else if (category === "Fees and Fines") {
    return allMethods.filter((m) => !m.isTaxRelated && m.taxCategoryType === "Fees and Fines");
  } else {
    return allMethods; // Show all for 'Other' category
  }
};

export function RevenueSourceForm({
  data,
  onChange,
  totalRevenue,
  currency = "USD",
  isReadOnly = false,
  availableDepartments = [],
}: RevenueSourceFormProps) {
  const { isLocked } = usePendingLocks();
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RevenueCategory>("Direct Tax");
  const [newRevenue, setNewRevenue] = useState<RevenueSourceInput>({
    name: "",
    category: "Direct Tax",
    description: "",
    rate: 0,
    revenueAmount: 0,
    collectionMethod: "",
    administeredBy: "",
  });

  // Use refs to access latest values without causing re-renders
  const dataRef = useRef(data);
  dataRef.current = data;
  const totalRevenueRef = useRef(totalRevenue);
  totalRevenueRef.current = totalRevenue;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const totalCalculated = data.reduce((sum, item) => sum + item.revenueAmount, 0);
  const totalPercent = data.reduce((sum, item) => sum + (item.revenuePercent ?? 0), 0);

  const handleUpdate = useCallback(
    (index: number, field: keyof RevenueSourceInput, value: any) => {
      const updated = [...dataRef.current];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };

      // Auto-calculate percentage when amount changes
      if (field === "revenueAmount" && totalRevenueRef.current > 0) {
        updated[index].revenuePercent = (value / totalRevenueRef.current) * 100;
      }

      onChange(updated);
    },
    [onChange]
  );

  const handleAdd = useCallback(() => {
    if (newRevenue.name.trim()) {
      const revenueToAdd = {
        ...newRevenue,
        revenuePercent:
          totalRevenueRef.current > 0
            ? (newRevenue.revenueAmount / totalRevenueRef.current) * 100
            : 0,
      };

      onChange([...dataRef.current, revenueToAdd]);
      setNewRevenue({
        name: "",
        category: selectedCategory,
        description: "",
        rate: 0,
        revenueAmount: 0,
        collectionMethod: "",
        administeredBy: "",
      });
      setIsAddingNew(false);
    }
  }, [newRevenue, selectedCategory, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      const updated = dataRef.current.filter((_, i) => i !== index);
      onChange(updated);
    },
    [onChange]
  );

  const addPresetRevenue = (name: string) => {
    const preset: RevenueSourceInput = {
      name,
      category: selectedCategory,
      description: `${name} revenue collection`,
      rate: selectedCategory.includes("Tax") ? 10 : undefined,
      revenueAmount: totalRevenue * 0.1,
      collectionMethod: "automatic_deduction",
      administeredBy:
        availableDepartments.find((d) => d.name.includes("Finance") || d.name.includes("Treasury"))
          ?.name || "Ministry of Finance",
    };

    onChange([
      ...data,
      {
        ...preset,
        revenuePercent: totalRevenue > 0 ? (preset.revenueAmount / totalRevenue) * 100 : 0,
      },
    ]);
  };

  const getCategoryStats = () => {
    const stats = revenueCategories.map((category) => {
      const categoryData = data.filter((item) => item.category === category);
      const amount = categoryData.reduce((sum, item) => sum + item.revenueAmount, 0);
      const percent = totalCalculated > 0 ? (amount / totalCalculated) * 100 : 0;
      return {
        category,
        amount,
        percent,
        count: categoryData.length,
      };
    });

    return stats.filter((stat) => stat.count > 0);
  };

  return (
    <GlassCard
      depth="base"
      theme="teal"
      className="border-cyan-500/20"
      texture="chevron"
      textureOpacity={0.04}
    >
      <div className="border-border/40 flex items-center justify-between border-b bg-white/[0.02] px-6 py-4 dark:bg-black/[0.1]">
        <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
          <Coins className="h-5 w-5 text-cyan-400" />
          Revenue Channels
        </h3>
        <div className="flex items-center gap-2">
          <Badge className={cn(
            "shadow-none border font-semibold",
            totalPercent > 100 
              ? "bg-red-500/10 border-red-500/20 text-red-400" 
              : "bg-cyan-500/10 border-cyan-500/20 text-cyan-400"
          )}>
            {data.length} Channels
          </Badge>
          <Badge className="bg-zinc-800 text-zinc-300 border border-white/5 font-semibold">
            {formatCurrency(totalCalculated)}
          </Badge>
        </div>
      </div>

      <GlassCardContent className="space-y-6 p-6">
        {/* Revenue KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-zinc-950/40 border border-white/5 p-4 text-center">
            <div className="text-xl font-extrabold text-white tracking-tight">
              {formatNumber(totalCalculated)}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Total Revenue</div>
          </div>
          <div className="rounded-xl bg-zinc-950/40 border border-white/5 p-4 text-center">
            <div className="text-xl font-extrabold text-emerald-400 tracking-tight">
              {data.filter((r) => r.category.includes("Tax")).length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Tax Sources</div>
          </div>
          <div className="rounded-xl bg-zinc-950/40 border border-white/5 p-4 text-center">
            <div className="text-xl font-extrabold text-cyan-400 tracking-tight">
              {data.filter((r) => !r.category.includes("Tax")).length}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Non-Tax Sources</div>
          </div>
          <div className="rounded-xl bg-zinc-950/40 border border-white/5 p-4 text-center">
            <div className="text-xl font-extrabold text-purple-400 tracking-tight">
              {data.length > 0 ? formatNumber(totalCalculated / data.length) : "0"}
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mt-1">Avg per Channel</div>
          </div>
        </div>

        {/* Category Breakdown list */}
        {getCategoryStats().length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Revenue Shares by Category
            </h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {getCategoryStats().map((stat) => {
                const Icon = revenueCategoryIcons[stat.category];
                const color = revenueCategoryColors[stat.category];
                return (
                  <div
                    key={stat.category}
                    className="flex items-center justify-between rounded-xl bg-zinc-950/20 border border-white/5 p-3"
                    style={{ borderLeft: `3px solid ${color}` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-lg flex items-center justify-center bg-zinc-900 border border-white/5">
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {stat.category}
                        </div>
                        <div className="text-[9px] font-semibold text-zinc-500 uppercase">
                          {stat.count} active channels
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-extrabold text-zinc-300">
                        {formatNumber(stat.amount)}
                      </div>
                      <div className="text-[10px] font-bold text-zinc-500">
                        {stat.percent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing Revenue Channels list */}
        <div className="space-y-4">
          {data.map((item, index) => {
            const Icon = revenueCategoryIcons[item.category];
            const color = revenueCategoryColors[item.category];

            return (
              <div 
                key={index} 
                className="relative rounded-xl border border-white/5 bg-zinc-900/40 p-4 transition-all hover:bg-zinc-900/60 overflow-hidden"
                style={{ borderLeft: `3px solid ${color}` }}
              >
                {!isReadOnly && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(index)}
                    className="absolute top-2 right-2 h-7 w-7 p-1 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Column 1: Basic Info */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded flex items-center justify-center bg-zinc-950 border border-white/5 shrink-0">
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <Input
                        value={item.name}
                        onChange={(e) => handleUpdate(index, "name", e.target.value)}
                        placeholder="Revenue source name"
                        disabled={isReadOnly}
                        className="h-8 font-bold bg-zinc-950/40 border-white/10 text-white placeholder:text-zinc-600 focus:border-cyan-500/30"
                      />
                    </div>

                    <Select
                      value={item.category}
                      onValueChange={(value: RevenueCategory) =>
                        handleUpdate(index, "category", value)
                      }
                      disabled={isReadOnly}
                    >
                      <SelectTrigger className="h-8 bg-zinc-950/40 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                        {revenueCategories.map((category) => {
                          const CategoryIcon = revenueCategoryIcons[category];
                          return (
                            <SelectItem key={category} value={category} className="focus:bg-zinc-800">
                              <div className="flex items-center">
                                <CategoryIcon
                                  className="mr-2 h-3.5 w-3.5"
                                  style={{ color: revenueCategoryColors[category] }}
                                />
                                {category}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>

                    <textarea
                      value={item.description || ""}
                      onChange={(e) => handleUpdate(index, "description", e.target.value)}
                      placeholder="Specify funding notes or legislative codes..."
                      disabled={isReadOnly}
                      rows={2}
                      className="w-full resize-none rounded-md border border-white/10 bg-zinc-950/40 px-3 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none"
                    />
                  </div>

                  {/* Column 2: Financial Details */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Annual Yield Amount
                      </Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1.5 text-zinc-500 text-xs">$</span>
                        <Input
                          type="number"
                          value={item.revenueAmount}
                          onChange={(e) =>
                            handleUpdate(index, "revenueAmount", parseFloat(e.target.value) || 0)
                          }
                          disabled={isReadOnly || isLocked("revenueSources")}
                          min="0"
                          step="1000000"
                          className="h-8 pl-6 bg-zinc-950/40 border-white/10 text-white focus:border-cyan-500/30"
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                        {formatCurrency(item.revenueAmount)} ({(item.revenuePercent ?? 0).toFixed(1)}% share)
                      </p>
                    </div>

                    {item.category.includes("Tax") && (
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                          Active Tax Rate (%)
                        </Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={item.rate || 0}
                            onChange={(e) =>
                              handleUpdate(index, "rate", parseFloat(e.target.value) || 0)
                            }
                            disabled={isReadOnly}
                            min="0"
                            max="100"
                            step="0.1"
                            className="h-8 pr-6 bg-zinc-950/40 border-white/10 text-white focus:border-cyan-500/30"
                          />
                          <span className="absolute right-2.5 top-1.5 text-zinc-500 text-xs">%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 3: Administration */}
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Collection Channel
                      </Label>
                      <Select
                        value={item.collectionMethod || ""}
                        onValueChange={(value) => handleUpdate(index, "collectionMethod", value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger className="h-8 bg-zinc-950/40 border-white/10 text-white text-xs">
                          <SelectValue placeholder="Select collection method" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950/95 border-white/10 text-white max-h-80">
                          {getCollectionMethodsForCategory(item.category).map((method) => {
                            const IconComponent = getCollectionMethodIcon(method.icon);
                            return (
                              <SelectItem key={method.id} value={method.id} className="focus:bg-zinc-800">
                                <div className="flex items-center gap-2">
                                  <IconComponent
                                    className="h-3.5 w-3.5 shrink-0"
                                    style={{ color: method.color }}
                                  />
                                  <div className="flex flex-col text-left">
                                    <span className="text-xs font-bold">{method.name}</span>
                                    <span className="text-[9px] text-zinc-500">
                                      {method.description}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                        Administrative Authority
                      </Label>
                      {availableDepartments.length > 0 ? (
                        <Select
                          value={item.administeredBy || ""}
                          onValueChange={(value) => handleUpdate(index, "administeredBy", value)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger className="h-8 bg-zinc-950/40 border-white/10 text-white text-xs">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                            {availableDepartments.filter(dept => dept.name && dept.name.trim() !== "").map((dept) => (
                              <SelectItem key={dept.id} value={dept.name} className="focus:bg-zinc-800">
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={item.administeredBy || ""}
                          onChange={(e) => handleUpdate(index, "administeredBy", e.target.value)}
                          placeholder="Ministry or Agency Name"
                          disabled={isReadOnly}
                          className="h-8 bg-zinc-950/40 border-white/10 text-white focus:border-cyan-500/30"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add New Revenue Source forms */}
        {!isReadOnly && (
          <div className="space-y-4">
            {!isAddingNew ? (
              <div className="space-y-4">
                <Button
                  variant="outline"
                  onClick={() => setIsAddingNew(true)}
                  className="h-12 w-full border-2 border-dashed border-white/10 bg-zinc-950/10 text-zinc-300 hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-white transition-all rounded-xl"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Custom Revenue Source
                </Button>

                {/* Quick Add Presets badges */}
                <div className="space-y-2.5 rounded-xl border border-white/5 bg-black/10 p-4">
                  <Label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Quick Add Common Channels:
                  </Label>
                  <div className="space-y-3">
                    {revenueCategories.map((category) => (
                      <div key={category} className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                          {React.createElement(revenueCategoryIcons[category], {
                            className: "h-3.5 w-3.5",
                            style: { color: revenueCategoryColors[category] },
                          })}
                          {category}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {commonRevenueSources[category].map((source) => (
                            <Button
                              key={source}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCategory(category);
                                addPresetRevenue(source);
                              }}
                              className="h-7 text-xs border-white/5 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {source}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-2 border-dashed border-cyan-500/25 bg-cyan-500/5 rounded-xl p-4 space-y-4">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Configure Custom Revenue Channel</div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <Input
                      value={newRevenue.name}
                      onChange={(e) =>
                        setNewRevenue((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Revenue channel name (e.g. Carbon Levy)"
                      className="bg-zinc-950/40 border-white/10 text-white"
                    />

                    <Select
                      value={newRevenue.category}
                      onValueChange={(value: RevenueCategory) =>
                        setNewRevenue((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger className="bg-zinc-950/40 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                        {revenueCategories.map((category) => {
                          const CategoryIcon = revenueCategoryIcons[category];
                          return (
                            <SelectItem key={category} value={category} className="focus:bg-zinc-800">
                              <div className="flex items-center">
                                <CategoryIcon
                                  className="mr-2 h-4 w-4"
                                  style={{ color: revenueCategoryColors[category] }}
                                />
                                {category}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Input
                      type="number"
                      value={newRevenue.revenueAmount || ""}
                      onChange={(e) =>
                        setNewRevenue((prev) => ({
                          ...prev,
                          revenueAmount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      placeholder="Annual yield amount"
                      min="0"
                      step="1000000"
                      className="bg-zinc-950/40 border-white/10 text-white"
                    />

                    {newRevenue.category.includes("Tax") && (
                      <Input
                        type="number"
                        value={newRevenue.rate || ""}
                        onChange={(e) =>
                          setNewRevenue((prev) => ({
                            ...prev,
                            rate: parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="Tax rate (%)"
                        min="0"
                        max="100"
                        step="0.1"
                        className="bg-zinc-950/40 border-white/10 text-white"
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">
                      Collection Method
                    </Label>
                    <Select
                      value={newRevenue.collectionMethod || ""}
                      onValueChange={(value) =>
                        setNewRevenue((prev) => ({ ...prev, collectionMethod: value }))
                      }
                    >
                      <SelectTrigger className="bg-zinc-950/40 border-white/10 text-white text-xs">
                        <SelectValue placeholder="Select collection method" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                        {getCollectionMethodsForCategory(newRevenue.category).map((method) => {
                          const IconComponent = getCollectionMethodIcon(method.icon);
                          return (
                            <SelectItem key={method.id} value={method.id} className="focus:bg-zinc-800">
                              <div className="flex items-center gap-2">
                                <IconComponent
                                  className="h-4 w-4 shrink-0"
                                  style={{ color: method.color }}
                                />
                                <div className="flex flex-col text-left">
                                  <span className="text-xs font-bold">{method.name}</span>
                                  <span className="text-[9px] text-zinc-500">
                                    {method.description}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-300">
                      Administrative Authority
                    </Label>
                    {availableDepartments.length > 0 ? (
                      <Select
                        value={newRevenue.administeredBy || ""}
                        onValueChange={(value) =>
                          setNewRevenue((prev) => ({ ...prev, administeredBy: value }))
                        }
                      >
                        <SelectTrigger className="bg-zinc-950/40 border-white/10 text-white text-xs">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950/95 border-white/10 text-white">
                          {availableDepartments.filter(dept => dept.name && dept.name.trim() !== "").map((dept) => (
                            <SelectItem key={dept.id} value={dept.name} className="focus:bg-zinc-800">
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={newRevenue.administeredBy || ""}
                        onChange={(e) =>
                          setNewRevenue((prev) => ({ ...prev, administeredBy: e.target.value }))
                        }
                        placeholder="Department or agency name"
                        className="bg-zinc-950/40 border-white/10 text-white"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-zinc-300">Description</Label>
                  <Input
                    value={newRevenue.description || ""}
                    onChange={(e) =>
                      setNewRevenue((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Brief description of this revenue source"
                    className="bg-zinc-950/40 border-white/10 text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleAdd} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Channel
                  </Button>
                  <Button variant="outline" onClick={() => setIsAddingNew(false)} size="sm" className="border-white/10 text-zinc-300 hover:bg-white/5">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </GlassCardContent>
    </GlassCard>
  );
}
