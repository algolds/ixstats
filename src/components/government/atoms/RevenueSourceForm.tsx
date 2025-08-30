"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Switch } from '~/components/ui/switch';
import { Slider } from '~/components/ui/slider';
import { 
  Plus, 
  X, 
  DollarSign, 
  Receipt, 
  Building2, 
  FileText, 
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import type { RevenueSourceInput, RevenueCategory } from '~/types/government';

interface RevenueSourceFormProps {
  data: RevenueSourceInput[];
  onChange: (data: RevenueSourceInput[]) => void;
  totalRevenue: number;
  currency: string;
  isReadOnly?: boolean;
  availableDepartments?: { id: string; name: string }[];
}

const revenueCategories: RevenueCategory[] = [
  'Direct Tax', 
  'Indirect Tax', 
  'Non-Tax Revenue', 
  'Fees and Fines', 
  'Other'
];

const revenueCategoryIcons = {
  'Direct Tax': Receipt,
  'Indirect Tax': Building2,
  'Non-Tax Revenue': DollarSign,
  'Fees and Fines': FileText,
  'Other': MoreHorizontal
};

const revenueCategoryColors = {
  'Direct Tax': '#059669',
  'Indirect Tax': '#0891b2',
  'Non-Tax Revenue': '#7c3aed',
  'Fees and Fines': '#ea580c',
  'Other': '#6b7280'
};

const commonRevenueSources = {
  'Direct Tax': [
    'Personal Income Tax',
    'Corporate Income Tax',
    'Capital Gains Tax',
    'Estate Tax',
    'Property Tax'
  ],
  'Indirect Tax': [
    'Value Added Tax (VAT)',
    'Goods and Services Tax (GST)',
    'Sales Tax',
    'Excise Tax',
    'Customs Duties',
    'Import Tariffs'
  ],
  'Non-Tax Revenue': [
    'State-Owned Enterprise Profits',
    'Natural Resource Royalties',
    'Investment Returns',
    'Public Asset Sales',
    'Licensing Fees'
  ],
  'Fees and Fines': [
    'Court Fines',
    'Traffic Violations',
    'Regulatory Fees',
    'Service Charges',
    'Permit Fees'
  ],
  'Other': [
    'Foreign Aid',
    'Grants',
    'Borrowing',
    'Special Levies'
  ]
};

export function RevenueSourceForm({ 
  data, 
  onChange, 
  totalRevenue,
  currency = 'USD',
  isReadOnly = false,
  availableDepartments = []
}: RevenueSourceFormProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<RevenueCategory>('Direct Tax');
  const [newRevenue, setNewRevenue] = useState<RevenueSourceInput>({
    name: '',
    category: 'Direct Tax',
    description: '',
    rate: 0,
    revenueAmount: 0,
    collectionMethod: '',
    administeredBy: ''
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const totalCalculated = data.reduce((sum, item) => sum + item.revenueAmount, 0);
  const totalPercent = data.reduce((sum, item) => sum + item.revenuePercent, 0);

  const handleUpdate = (index: number, field: keyof RevenueSourceInput, value: any) => {
    const updated = [...data];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    // Auto-calculate percentage when amount changes
    if (field === 'revenueAmount' && totalRevenue > 0) {
      updated[index].revenuePercent = (value / totalRevenue) * 100;
    }

    onChange(updated);
  };

  const handleAdd = () => {
    if (newRevenue.name.trim()) {
      const revenueToAdd = {
        ...newRevenue,
        revenuePercent: totalRevenue > 0 ? (newRevenue.revenueAmount / totalRevenue) * 100 : 0
      };
      
      onChange([...data, revenueToAdd]);
      setNewRevenue({
        name: '',
        category: selectedCategory,
        description: '',
        rate: 0,
        revenueAmount: 0,
        collectionMethod: '',
        administeredBy: ''
      });
      setIsAddingNew(false);
    }
  };

  const handleRemove = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    onChange(updated);
  };

  const addPresetRevenue = (name: string) => {
    const preset: RevenueSourceInput = {
      name,
      category: selectedCategory,
      description: `${name} revenue collection`,
      rate: selectedCategory.includes('Tax') ? 10 : undefined,
      revenueAmount: totalRevenue * 0.1,
      collectionMethod: 'Automatic deduction',
      administeredBy: availableDepartments.find(d => d.name.includes('Finance') || d.name.includes('Treasury'))?.name || 'Ministry of Finance'
    };

    onChange([...data, {
      ...preset,
      revenuePercent: totalRevenue > 0 ? (preset.revenueAmount / totalRevenue) * 100 : 0
    }]);
  };

  const getCategoryStats = () => {
    const stats = revenueCategories.map(category => {
      const categoryData = data.filter(item => item.category === category);
      const amount = categoryData.reduce((sum, item) => sum + item.revenueAmount, 0);
      const percent = totalCalculated > 0 ? (amount / totalCalculated) * 100 : 0;
      return {
        category,
        amount,
        percent,
        count: categoryData.length
      };
    });

    return stats.filter(stat => stat.count > 0);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-semibold text-[var(--color-text-primary)]">
            <DollarSign className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
            Revenue Sources
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={totalPercent > 100 ? "destructive" : "default"}>
              {data.length} Sources
            </Badge>
            <Badge variant="secondary">
              {formatCurrency(totalCalculated)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Revenue Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-[var(--color-bg-tertiary)] rounded-lg">
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {formatNumber(totalCalculated)}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Total Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {data.filter(r => r.category.includes('Tax')).length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Tax Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {data.filter(r => !r.category.includes('Tax')).length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Non-Tax Sources</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[var(--color-text-primary)]">
              {data.length > 0 ? formatNumber(totalCalculated / data.length) : '0'}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Avg per Source</div>
          </div>
        </div>

        {/* Category Breakdown */}
        {getCategoryStats().length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--color-text-primary)]">Revenue by Category</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {getCategoryStats().map(stat => {
                const Icon = revenueCategoryIcons[stat.category];
                const color = revenueCategoryColors[stat.category];
                return (
                  <div key={stat.category} className="flex items-center justify-between p-3 bg-[var(--color-bg-secondary)] rounded-lg">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" style={{ color }} />
                      <div>
                        <div className="font-medium text-[var(--color-text-primary)]">{stat.category}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{stat.count} sources</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-[var(--color-text-primary)]">
                        {formatNumber(stat.amount)}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {stat.percent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Existing Revenue Sources */}
        <div className="space-y-3">
          {data.map((item, index) => {
            const Icon = revenueCategoryIcons[item.category];
            const color = revenueCategoryColors[item.category];

            return (
              <Card key={index} className="relative">
                <CardContent className="p-4">
                  {!isReadOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(index)}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-800 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Basic Info */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" style={{ color }} />
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                          placeholder="Revenue source name"
                          disabled={isReadOnly}
                          className="font-medium"
                        />
                      </div>
                      
                      <Select
                        value={item.category}
                        onValueChange={(value: RevenueCategory) => handleUpdate(index, 'category', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {revenueCategories.map((category) => {
                            const CategoryIcon = revenueCategoryIcons[category];
                            return (
                              <SelectItem key={category} value={category}>
                                <div className="flex items-center">
                                  <CategoryIcon className="h-4 w-4 mr-2" style={{ color: revenueCategoryColors[category] }} />
                                  {category}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>

                      <textarea
                        value={item.description || ''}
                        onChange={(e) => handleUpdate(index, 'description', e.target.value)}
                        placeholder="Description..."
                        disabled={isReadOnly}
                        rows={2}
                        className="w-full px-3 py-2 border border-[var(--color-border-primary)] rounded-md bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] text-sm placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent resize-none"
                      />
                    </div>

                    {/* Financial Details */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-[var(--color-text-muted)]">Annual Revenue</Label>
                        <Input
                          type="number"
                          value={item.revenueAmount}
                          onChange={(e) => handleUpdate(index, 'revenueAmount', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          min="0"
                          step="1000000"
                        />
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatCurrency(item.revenueAmount)} ({item.revenuePercent.toFixed(1)}%)
                        </p>
                      </div>

                      {item.category.includes('Tax') && (
                        <div className="space-y-2">
                          <Label className="text-xs text-[var(--color-text-muted)]">Tax Rate (%)</Label>
                          <Input
                            type="number"
                            value={item.rate || 0}
                            onChange={(e) => handleUpdate(index, 'rate', parseFloat(e.target.value) || 0)}
                            disabled={isReadOnly}
                            min="0"
                            max="100"
                            step="0.1"
                          />
                        </div>
                      )}
                    </div>

                    {/* Administration */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-[var(--color-text-muted)]">Collection Method</Label>
                        <Input
                          value={item.collectionMethod || ''}
                          onChange={(e) => handleUpdate(index, 'collectionMethod', e.target.value)}
                          placeholder="How is this collected?"
                          disabled={isReadOnly}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs text-[var(--color-text-muted)]">Administered By</Label>
                        {availableDepartments.length > 0 ? (
                          <Select
                            value={item.administeredBy || ''}
                            onValueChange={(value) => handleUpdate(index, 'administeredBy', value)}
                            disabled={isReadOnly}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableDepartments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.name}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={item.administeredBy || ''}
                            onChange={(e) => handleUpdate(index, 'administeredBy', e.target.value)}
                            placeholder="Department name"
                            disabled={isReadOnly}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add New Revenue Source */}
        {!isReadOnly && (
          <div className="space-y-4">
            {!isAddingNew ? (
              <div className="space-y-3">
                <Button
                  variant="dashed"
                  onClick={() => setIsAddingNew(true)}
                  className="w-full h-12 border-2 border-dashed border-[var(--color-border-primary)] hover:border-[var(--color-brand-primary)]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Revenue Source
                </Button>

                {/* Quick Add Presets */}
                <div className="space-y-2">
                  <Label className="text-sm text-[var(--color-text-muted)]">Quick Add Common Sources:</Label>
                  <div className="space-y-2">
                    {revenueCategories.map(category => (
                      <div key={category} className="space-y-1">
                        <div className="text-xs font-medium text-[var(--color-text-secondary)] flex items-center gap-1">
                          {React.createElement(revenueCategoryIcons[category], { className: "h-3 w-3", style: { color: revenueCategoryColors[category] } })}
                          {category}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {commonRevenueSources[category].map(source => (
                            <Button
                              key={source}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedCategory(category);
                                addPresetRevenue(source);
                              }}
                              className="text-xs h-7"
                            >
                              <Plus className="h-3 w-3 mr-1" />
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
              <Card className="border-2 border-dashed border-[var(--color-brand-primary)]">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Input
                        value={newRevenue.name}
                        onChange={(e) => setNewRevenue(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Revenue source name"
                      />
                      
                      <Select
                        value={newRevenue.category}
                        onValueChange={(value: RevenueCategory) => setNewRevenue(prev => ({ ...prev, category: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {revenueCategories.map((category) => {
                            const CategoryIcon = revenueCategoryIcons[category];
                            return (
                              <SelectItem key={category} value={category}>
                                <div className="flex items-center">
                                  <CategoryIcon className="h-4 w-4 mr-2" style={{ color: revenueCategoryColors[category] }} />
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
                        value={newRevenue.revenueAmount}
                        onChange={(e) => setNewRevenue(prev => ({ ...prev, revenueAmount: parseFloat(e.target.value) || 0 }))}
                        placeholder="Annual revenue amount"
                        min="0"
                        step="1000000"
                      />

                      {newRevenue.category.includes('Tax') && (
                        <Input
                          type="number"
                          value={newRevenue.rate || 0}
                          onChange={(e) => setNewRevenue(prev => ({ ...prev, rate: parseFloat(e.target.value) || 0 }))}
                          placeholder="Tax rate (%)"
                          min="0"
                          max="100"
                          step="0.1"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleAdd} size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setIsAddingNew(false)} 
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}