"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import { Badge } from '~/components/ui/badge';
import { Slider } from '~/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
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
  CheckCircle2
} from 'lucide-react';
import type { TaxCategoryInput, TaxBracketInput } from '~/types/tax-system';
import { TAX_CATEGORIES, TAX_TYPES, CALCULATION_METHODS } from '~/types/tax-system';

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
}

const categoryIcons = {
  [TAX_CATEGORIES.INCOME]: DollarSign,
  [TAX_CATEGORIES.CORPORATE]: Building,
  [TAX_CATEGORIES.SALES]: Receipt,
  [TAX_CATEGORIES.PROPERTY]: Home,
  [TAX_CATEGORIES.CAPITAL_GAINS]: TrendingUp,
  [TAX_CATEGORIES.OTHER]: Settings
};

const categoryColors = {
  [TAX_CATEGORIES.INCOME]: '#3b82f6',
  [TAX_CATEGORIES.CORPORATE]: '#059669',
  [TAX_CATEGORIES.SALES]: '#dc2626',
  [TAX_CATEGORIES.PROPERTY]: '#7c3aed',
  [TAX_CATEGORIES.CAPITAL_GAINS]: '#ea580c',
  [TAX_CATEGORIES.OTHER]: '#6b7280'
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
  errors = {}
}: TaxCategoryFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field: keyof TaxCategoryInput, value: any) => {
    const updatedData = { ...data, [field]: value };
    
    // Auto-set icon and color based on category
    if (field === 'categoryName') {
      const icon = Object.keys(categoryIcons).find(key => 
        TAX_CATEGORIES[key as keyof typeof TAX_CATEGORIES] === value
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
      minIncome: brackets.length > 0
        ? Math.max(
            ...brackets.map(b => (b.maxIncome !== undefined ? b.maxIncome : b.minIncome))
          )
        : 0,
      maxIncome: undefined,
      rate: data.baseRate || 0,
      marginalRate: true,
      isActive: true,
      priority: brackets.length + 1
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

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded} className="flex-1">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between w-full cursor-pointer">
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ 
                      backgroundColor: `${data.color || '#6b7280'}20`,
                      color: data.color || '#6b7280'
                    }}
                  >
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      {data.categoryName || `Tax Category ${categoryIndex + 1}`}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {data.categoryType} • {data.calculationMethod}
                      {data.baseRate && ` • ${data.baseRate}%`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isValid ? (
                    <Badge variant="default" className="bg-green-100 text-green-700">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Valid
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      {hasErrors ? `${Object.keys(errors).length} Errors` : 'Incomplete'}
                    </Badge>
                  )}
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="categoryName" className="text-sm font-medium">
                  Tax Category *
                </Label>
                <Select
                  value={data.categoryName}
                  onValueChange={(value) => handleChange('categoryName', value)}
                  disabled={isReadOnly}
                >
                  <SelectTrigger className={errors.categoryName ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Select tax category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(TAX_CATEGORIES).map((category) => {
                      const IconComp = categoryIcons[category as keyof typeof categoryIcons] || Settings;
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
                  onValueChange={(value) => handleChange('categoryType', value)}
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
                <Label htmlFor="calculationMethod" className="text-sm font-medium">
                  Calculation Method *
                </Label>
                <Select
                  value={data.calculationMethod}
                  onValueChange={(value) => handleChange('calculationMethod', value)}
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
                <Label className="text-sm font-medium">
                  Base Rate (%)
                </Label>
                <div className="px-3 py-2 bg-muted rounded-lg">
                  <Slider
                    value={[data.baseRate || 0]}
                    onValueChange={([value]) => handleChange('baseRate', value)}
                    max={100}
                    min={0}
                    step={0.1}
                    disabled={isReadOnly}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
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
                value={data.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
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
                <Settings className="h-4 w-4 mr-2" />
                {showAdvanced ? 'Hide' : 'Show'} Advanced Settings
                {showAdvanced ? <ChevronDown className="h-4 w-4 ml-2" /> : <ChevronRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>

            {/* Advanced Settings */}
            {showAdvanced && (
              <div className="space-y-6 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Amount Limits */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm">Amount Limits</h5>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Minimum Taxable Amount</Label>
                      <Input
                        type="number"
                        value={data.minimumAmount || ''}
                        onChange={(e) => handleChange('minimumAmount', parseFloat(e.target.value) || undefined)}
                        placeholder="0"
                        disabled={isReadOnly}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Maximum Taxable Amount</Label>
                      <Input
                        type="number"
                        value={data.maximumAmount || ''}
                        onChange={(e) => handleChange('maximumAmount', parseFloat(e.target.value) || undefined)}
                        placeholder="No limit"
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {/* Exemptions and Deductions */}
                  <div className="space-y-4">
                    <h5 className="font-medium text-sm">Exemptions & Deductions</h5>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">Standard Exemption Amount</Label>
                      <Input
                        type="number"
                        value={data.exemptionAmount || ''}
                        onChange={(e) => handleChange('exemptionAmount', parseFloat(e.target.value) || undefined)}
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
                        onCheckedChange={(checked) => handleChange('deductionAllowed', checked)}
                        disabled={isReadOnly}
                      />
                    </div>

                    {data.deductionAllowed && (
                      <div className="space-y-2">
                        <Label className="text-xs">Standard Deduction Amount</Label>
                        <Input
                          type="number"
                          value={data.standardDeduction || ''}
                          onChange={(e) => handleChange('standardDeduction', parseFloat(e.target.value) || undefined)}
                          placeholder="0"
                          disabled={isReadOnly}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Priority and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      Priority Level
                    </Label>
                    <div className="px-3 py-2 bg-muted rounded-lg">
                      <Slider
                        value={[data.priority]}
                        onValueChange={([value]) => handleChange('priority', value)}
                        max={100}
                        min={1}
                        step={1}
                        disabled={isReadOnly}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
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
                      onCheckedChange={(checked) => handleChange('isActive', checked)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tax Brackets */}
            {showBrackets && data.calculationMethod === 'progressive' && (
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium">Tax Brackets</h5>
                  {!isReadOnly && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addBracket}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Bracket
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {brackets.map((bracket, index) => (
                    <div key={index} className="p-4 bg-muted rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Min Income</Label>
                          <Input
                            type="number"
                            value={bracket.minIncome}
                            onChange={(e) => updateBracket(index, {
                              ...bracket,
                              minIncome: parseFloat(e.target.value) || 0
                            })}
                            disabled={isReadOnly}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Max Income</Label>
                          <Input
                            type="number"
                            value={bracket.maxIncome || ''}
                            onChange={(e) => updateBracket(index, {
                              ...bracket,
                              maxIncome: parseFloat(e.target.value) || undefined
                            })}
                            placeholder="No limit"
                            disabled={isReadOnly}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs">Tax Rate (%)</Label>
                          <Input
                            type="number"
                            value={bracket.rate}
                            onChange={(e) => updateBracket(index, {
                              ...bracket,
                              rate: parseFloat(e.target.value) || 0
                            })}
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
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                {onDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
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