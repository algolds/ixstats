"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Slider } from "~/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import {
  Receipt,
  Building,
  DollarSign,
  Home,
  TrendingUp,
  Trash2,
  Edit3,
  ChevronDown,
  ChevronRight,
  Plus,
  Settings,
  AlertCircle,
  CheckCircle2,
  Zap,
  Calculator,
  CreditCard,
  Shield,
  FileText,
  FileCheck,
  AlertTriangle,
  Mountain,
  Link2,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import type { TaxCategoryInput, TaxBracketInput } from "~/types/tax-system";
import { TAX_CATEGORIES, TAX_TYPES, CALCULATION_METHODS } from "~/types/tax-system";

interface TaxCategoryFormProps {
  data: TaxCategoryInput;
  onChange: (data: TaxCategoryInput) => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
  showBrackets?: boolean;
  brackets?: TaxBracketInput[];
  onBracketsChange?: (brackets: TaxBracketInput[]) => void;
  categoryIndex?: number;
  errors?: Record<string, string[]>;
  collectionMethod?: string;
  administeredBy?: string;
  isSyncedFromRevenue?: boolean;
  onApplyStandardBrackets?: () => void;
  availableDepartments?: Array<{ id: string; name: string }>;
}

const categoryIcons = {
  [TAX_CATEGORIES.INCOME]: DollarSign,
  [TAX_CATEGORIES.CORPORATE]: Building,
  [TAX_CATEGORIES.SALES]: Receipt,
  [TAX_CATEGORIES.PROPERTY]: Home,
  [TAX_CATEGORIES.CAPITAL_GAINS]: TrendingUp,
  [TAX_CATEGORIES.OTHER]: Settings,
};

const categoryColors = {
  [TAX_CATEGORIES.INCOME]: "#3b82f6",
  [TAX_CATEGORIES.CORPORATE]: "#059669",
  [TAX_CATEGORIES.SALES]: "#dc2626",
  [TAX_CATEGORIES.PROPERTY]: "#7c3aed",
  [TAX_CATEGORIES.CAPITAL_GAINS]: "#ea580c",
  [TAX_CATEGORIES.OTHER]: "#6b7280",
};

const collectionMethodIcons: Record<string, any> = {
  automatic_deduction: Zap,
  self_assessment: Calculator,
  point_of_sale: CreditCard,
  withholding_tax: Shield,
  annual_return: FileText,
  direct_billing: Receipt,
  licensing_fee: FileCheck,
  fine_penalty: AlertTriangle,
  royalty_payment: Mountain,
  dividend_distribution: TrendingUp,
};

const collectionMethodColors: Record<string, string> = {
  automatic_deduction: "#059669",
  self_assessment: "#0891b2",
  point_of_sale: "#dc2626",
  withholding_tax: "#7c3aed",
  annual_return: "#ea580c",
  direct_billing: "#059669",
  licensing_fee: "#0891b2",
  fine_penalty: "#dc2626",
  royalty_payment: "#7c3aed",
  dividend_distribution: "#059669",
};

const getCollectionMethodName = (methodId: string): string => {
  const names: Record<string, string> = {
    automatic_deduction: "Automatic Deduction",
    self_assessment: "Self Assessment",
    point_of_sale: "Point of Sale",
    withholding_tax: "Withholding Tax",
    annual_return: "Annual Return",
    direct_billing: "Direct Billing",
    licensing_fee: "Licensing Fee",
    fine_penalty: "Fine/Penalty",
    royalty_payment: "Royalty Payment",
    dividend_distribution: "Dividend Distribution",
  };
  return names[methodId] || methodId;
};

const getCollectionMethodDescription = (methodId: string): string => {
  const descriptions: Record<string, string> = {
    automatic_deduction: "Automatically deducted from income/salary",
    self_assessment: "Taxpayers calculate and pay themselves",
    point_of_sale: "Collected at time of purchase/transaction",
    withholding_tax: "Deducted at source by payers",
    annual_return: "Filed annually with tax returns",
    direct_billing: "Government bills directly for services",
    licensing_fee: "Periodic fees for licenses/permits",
    fine_penalty: "One-time fines and penalties",
    royalty_payment: "Payments for resource extraction",
    dividend_distribution: "Profits from state-owned enterprises",
  };
  return descriptions[methodId] || "Custom collection method";
};

export function TaxCategoryForm({
  data,
  onChange,
  onDelete,
  isReadOnly = false,
  showBrackets = false,
  brackets = [],
  onBracketsChange,
  categoryIndex = 0,
  errors = {},
  collectionMethod,
  administeredBy,
  isSyncedFromRevenue = false,
  onApplyStandardBrackets,
  availableDepartments = [],
}: TaxCategoryFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field: keyof TaxCategoryInput, value: any) => {
    const updatedData = { ...data, [field]: value };

    // Auto-set icon and color based on category
    if (field === "categoryName") {
      const icon = Object.keys(categoryIcons).find(
        (key) => TAX_CATEGORIES[key as keyof typeof TAX_CATEGORIES] === value
      );
      if (icon) {
        updatedData.icon = icon;
        updatedData.color = categoryColors[value as keyof typeof categoryColors];
      }
    }

    onChange(updatedData);
  };

  const addBracket = () => {
    if (!onBracketsChange) return;

    const newBracket: TaxBracketInput = {
      // Use the highest defined boundary as the next min. If an open-ended bracket exists,
      // fall back to the highest of its minIncome to keep ordering monotonic.
      minIncome:
        brackets.length > 0
          ? Math.max(
              ...brackets.map((b) => (b.maxIncome !== undefined ? b.maxIncome : b.minIncome))
            )
          : 0,
      maxIncome: undefined,
      rate: data.baseRate || 0,
      marginalRate: true,
      isActive: true,
      priority: brackets.length + 1,
    };

    onBracketsChange([...brackets, newBracket]);
  };

  const updateBracket = (index: number, bracket: TaxBracketInput) => {
    if (!onBracketsChange) return;

    const newBrackets = [...brackets];
    newBrackets[index] = bracket;

    // Maintain continuity with adjacent brackets when boundaries change
    // If this bracket's maxIncome is set, propagate as the minIncome for the next bracket
    if (bracket.maxIncome !== undefined && index < newBrackets.length - 1) {
      const next = { ...newBrackets[index + 1] };
      // Ensure non-decreasing boundary
      next.minIncome = Math.max(bracket.maxIncome, next.minIncome);
      newBrackets[index + 1] = next as TaxBracketInput;
    }

    // If this bracket's minIncome changed, set previous bracket's maxIncome to match
    if (index > 0) {
      const prev = { ...newBrackets[index - 1] };
      prev.maxIncome = bracket.minIncome;
      newBrackets[index - 1] = prev as TaxBracketInput;
    }
    onBracketsChange(newBrackets);
  };

  const removeBracket = (index: number) => {
    if (!onBracketsChange) return;
    onBracketsChange(brackets.filter((_, i) => i !== index));
  };

  const IconComponent = categoryIcons[data.categoryName as keyof typeof categoryIcons] || Settings;
  const hasErrors = Object.keys(errors).length > 0;
  const isValid = data.categoryName && data.categoryType && data.calculationMethod;

  const CollectionMethodIcon = collectionMethod
    ? collectionMethodIcons[collectionMethod] || Receipt
    : null;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="flex-1">
            <CollapsibleTrigger asChild>
              <div className="flex w-full cursor-pointer items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-lg p-2"
                    style={{
                      backgroundColor: `${data.color || "#6b7280"}20`,
                      color: data.color || "#6b7280",
                    }}
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg font-semibold">
                        {data.categoryName || `Tax Category ${categoryIndex + 1}`}
                      </CardTitle>
                      {isSyncedFromRevenue && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Badge
                                variant="outline"
                                className="border-green-200 bg-green-50 text-green-700"
                              >
                                <Link2 className="mr-1 h-3 w-3" />
                                Synced
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>
                                This tax category is synchronized from a government revenue source
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {data.categoryType} • {data.calculationMethod}
                      {data.baseRate && ` • ${data.baseRate}%`}
                    </p>
                    {administeredBy && (
                      <div className="mt-1 flex items-center gap-1">
                        <Building className="text-muted-foreground h-3 w-3" />
                        <span className="text-muted-foreground text-xs">
                          Administered by: <span className="font-medium">{administeredBy}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <Badge variant="default" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      {hasErrors ? `${Object.keys(errors).length} Errors` : "Incomplete"}
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
          </Collapsible>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="categoryName" className="text-sm font-medium">
                  Tax Category *
                </Label>
                <Select
                  value={data.categoryName}
                  onValueChange={(value) => handleChange("categoryName", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className={errors.categoryName ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select tax category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TAX_CATEGORIES).map((category) => {
                      const IconComp =
                        categoryIcons[category as keyof typeof categoryIcons] || Settings;
                      return (
                        <SelectItem key={category} value={category}>
                          <div className="flex items-center gap-2">
                            <IconComp className="h-4 w-4" />
                            {category}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.categoryName && (
                  <p className="text-xs text-red-500">{errors.categoryName[0]}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryType" className="text-sm font-medium">
                  Tax Type *
                </Label>
                <Select
                  value={data.categoryType}
                  onValueChange={(value) => handleChange("categoryType", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tax type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TAX_TYPES).map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="calculationMethod" className="text-sm font-medium">
                    Calculation Method *
                  </Label>
                  {collectionMethod && CollectionMethodIcon && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge
                            variant="outline"
                            style={{
                              backgroundColor: `${collectionMethodColors[collectionMethod]}15`,
                              borderColor: collectionMethodColors[collectionMethod],
                              color: collectionMethodColors[collectionMethod],
                            }}
                          >
                            <CollectionMethodIcon className="mr-1 h-3 w-3" />
                            {getCollectionMethodName(collectionMethod)}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-medium">Collection Method</p>
                          <p className="text-muted-foreground text-xs">
                            {getCollectionMethodDescription(collectionMethod)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <Select
                  value={data.calculationMethod}
                  onValueChange={(value) => handleChange("calculationMethod", value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select calculation method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Rate</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="tiered">Tiered System</SelectItem>
                    <SelectItem value="progressive">Progressive Brackets</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Base Rate (%)</Label>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Slider
                    value={[data.baseRate || 0]}
                    onValueChange={([value]) => handleChange("baseRate", value)}
                    max={100}
                    min={0}
                    step={0.1}
                    disabled={isReadOnly}
                    className="w-full"
                  />
                  <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                    <span>0%</span>
                    <span className="font-medium">{(data.baseRate || 0).toFixed(1)}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id="description"
                value={data.description || ""}
                onChange={(e) => handleChange("description", e.target.value)}
                placeholder="Describe this tax category..."
                disabled={isReadOnly}
                className="min-h-[80px]"
              />
            </div>

            {/* Advanced Settings Toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-sm"
              >
                <Settings className="mr-2 h-4 w-4" />
                {showAdvanced ? "Hide" : "Show"} Advanced Settings
                {showAdvanced ? (
                  <ChevronDown className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-6 border-t pt-4">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {/* Amount Limits */}
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium">Amount Limits</h5>

                    <div className="space-y-2">
                      <Label className="text-xs">Minimum Taxable Amount</Label>
                      <Input
                        type="number"
                        value={data.minimumAmount || ""}
                        onChange={(e) =>
                          handleChange("minimumAmount", parseFloat(e.target.value) || undefined)
                        }
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Maximum Taxable Amount</Label>
                      <Input
                        type="number"
                        value={data.maximumAmount || ""}
                        onChange={(e) =>
                          handleChange("maximumAmount", parseFloat(e.target.value) || undefined)
                        }
                        placeholder="No limit"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {/* Exemptions and Deductions */}
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium">Exemptions & Deductions</h5>

                    <div className="space-y-2">
                      <Label className="text-xs">Standard Exemption Amount</Label>
                      <Input
                        type="number"
                        value={data.exemptionAmount || ""}
                        onChange={(e) =>
                          handleChange("exemptionAmount", parseFloat(e.target.value) || undefined)
                        }
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label htmlFor="deductionAllowed" className="text-xs">
                        Allow Deductions
                      </Label>
                      <Switch
                        id="deductionAllowed"
                        checked={data.deductionAllowed}
                        onCheckedChange={(checked) => handleChange("deductionAllowed", checked)}
                        disabled={isReadOnly}
                      />
                    </div>

                    {data.deductionAllowed && (
                      <div className="space-y-2">
                        <Label className="text-xs">Standard Deduction Amount</Label>
                        <Input
                          type="number"
                          value={data.standardDeduction || ""}
                          onChange={(e) =>
                            handleChange(
                              "standardDeduction",
                              parseFloat(e.target.value) || undefined
                            )
                          }
                          placeholder="0"
                          disabled={isReadOnly}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Priority and Status */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Priority Level</Label>
                    <div className="bg-muted rounded-lg px-3 py-2">
                      <Slider
                        value={[data.priority]}
                        onValueChange={([value]) => handleChange("priority", value)}
                        max={100}
                        min={1}
                        step={1}
                        disabled={isReadOnly}
                        className="w-full"
                      />
                      <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                        <span>Low (1)</span>
                        <span className="font-medium">{data.priority}</span>
                        <span>High (100)</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="isActive" className="text-sm font-medium">
                      Active Status
                    </Label>
                    <Switch
                      id="isActive"
                      checked={data.isActive}
                      onCheckedChange={(checked) => handleChange("isActive", checked)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tax Brackets */}
            {showBrackets && data.calculationMethod === "progressive" && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">Tax Brackets</h5>
                  <div className="flex items-center gap-2">
                    {isSyncedFromRevenue && onApplyStandardBrackets && !isReadOnly && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onApplyStandardBrackets}
                              className="border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                            >
                              <Sparkles className="mr-2 h-4 w-4" />
                              Apply Standard Brackets
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Apply the recommended tax brackets for this revenue source</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {!isReadOnly && (
                      <Button variant="outline" size="sm" onClick={addBracket}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Bracket
                      </Button>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  {brackets.map((bracket, index) => (
                    <div key={index} className="bg-muted rounded-lg p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Min Income</Label>
                          <Input
                            type="number"
                            value={bracket.minIncome}
                            onChange={(e) =>
                              updateBracket(index, {
                                ...bracket,
                                minIncome: parseFloat(e.target.value) || 0,
                              })
                            }
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Max Income</Label>
                          <Input
                            type="number"
                            value={bracket.maxIncome || ""}
                            onChange={(e) =>
                              updateBracket(index, {
                                ...bracket,
                                maxIncome: parseFloat(e.target.value) || undefined,
                              })
                            }
                            placeholder="No limit"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Tax Rate (%)</Label>
                          <Input
                            type="number"
                            value={bracket.rate}
                            onChange={(e) =>
                              updateBracket(index, {
                                ...bracket,
                                rate: parseFloat(e.target.value) || 0,
                              })
                            }
                            step="0.1"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="flex items-end">
                          {!isReadOnly && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeBracket(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            {!isReadOnly && (
              <div className="flex items-center justify-end gap-2 border-t pt-4">
                {onDelete && (
                  <Button variant="destructive" size="sm" onClick={onDelete}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Category
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
