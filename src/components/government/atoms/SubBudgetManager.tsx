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
  Users, 
  Cog, 
  Building2, 
  FlaskConical, 
  MoreHorizontal,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import type { SubBudgetInput, BudgetType, BudgetPriority } from '~/types/government';

interface SubBudgetManagerProps {
  data: SubBudgetInput[];
  onChange: (data: SubBudgetInput[]) => void;
  departmentBudget: number;
  currency: string;
  isReadOnly?: boolean;
}

const budgetTypes: BudgetType[] = ['Personnel', 'Operations', 'Capital', 'Research', 'Other'];
const budgetPriorities: BudgetPriority[] = ['Critical', 'High', 'Medium', 'Low'];

const budgetTypeIcons = {
  'Personnel': Users,
  'Operations': Cog,
  'Capital': Building2,
  'Research': FlaskConical,
  'Other': MoreHorizontal
};

const budgetTypeColors = {
  'Personnel': '#059669',
  'Operations': '#0891b2',
  'Capital': '#7c3aed',
  'Research': '#ea580c',
  'Other': '#6b7280'
};

const priorityColors = {
  'Critical': '#dc2626',
  'High': '#ea580c',
  'Medium': '#eab308',
  'Low': '#6b7280'
};

export function SubBudgetManager({ 
  data, 
  onChange, 
  departmentBudget,
  currency = 'USD',
  isReadOnly = false 
}: SubBudgetManagerProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newBudget, setNewBudget] = useState<SubBudgetInput>({
    name: '',
    description: '',
    amount: 0,
    percent: 0,
    budgetType: 'Operations',
    isRecurring: true,
    priority: 'Medium'
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const totalAllocated = data.reduce((sum, item) => sum + item.percent, 0);
  const remainingPercent = Math.max(0, 100 - totalAllocated);

  const handleUpdate = (index: number, field: keyof SubBudgetInput, value: any) => {
    const updated = [...data];
    updated[index] = {
      ...updated[index],
      [field]: value
    };

    // Auto-calculate amount when percent changes
    if (field === 'percent') {
      updated[index].amount = (departmentBudget * value) / 100;
    }

    // Auto-calculate percent when amount changes
    if (field === 'amount') {
      updated[index].percent = departmentBudget > 0 ? (value / departmentBudget) * 100 : 0;
    }

    onChange(updated);
  };

  const handleAdd = () => {
    if (newBudget.name.trim()) {
      const budgetToAdd = {
        ...newBudget,
        amount: departmentBudget > 0 ? (departmentBudget * newBudget.percent) / 100 : 0
      };
      
      onChange([...data, budgetToAdd]);
      setNewBudget({
        name: '',
        description: '',
        amount: 0,
        percent: 0,
        budgetType: 'Operations',
        isRecurring: true,
        priority: 'Medium'
      });
      setIsAddingNew(false);
    }
  };

  const handleRemove = (index: number) => {
    const updated = data.filter((_, i) => i !== index);
    onChange(updated);
  };

  const autoBalance = () => {
    if (data.length === 0) return;
    
    const equalPercent = 100 / data.length;
    const updated = data.map(item => ({
      ...item,
      percent: equalPercent,
      amount: (departmentBudget * equalPercent) / 100
    }));
    
    onChange(updated);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-semibold text-[var(--color-text-primary)]">
            <Building2 className="h-5 w-5 mr-2 text-[var(--color-brand-primary)]" />
            Sub-Budget Categories
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={totalAllocated > 100 ? "destructive" : totalAllocated === 100 ? "default" : "secondary"}>
              {totalAllocated.toFixed(1)}% Allocated
            </Badge>
            {!isReadOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={autoBalance}
                disabled={data.length === 0}
              >
                Auto-Balance
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Budget Summary */}
        <div className="grid grid-cols-2 gap-4 p-3 bg-[var(--color-bg-tertiary)] rounded-lg">
          <div>
            <div className="text-sm text-[var(--color-text-muted)]">Department Budget</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {formatCurrency(departmentBudget)}
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-text-muted)]">Remaining</div>
            <div className={`text-lg font-semibold ${remainingPercent < 0 ? 'text-red-600' : 'text-green-600'}`}>
              {remainingPercent.toFixed(1)}% ({formatCurrency((departmentBudget * remainingPercent) / 100)})
            </div>
          </div>
        </div>

        {/* Existing Sub-Budgets */}
        <div className="space-y-3">
          {data.map((item, index) => {
            const Icon = budgetTypeIcons[item.budgetType];
            const typeColor = budgetTypeColors[item.budgetType];
            const priorityColor = priorityColors[item.priority];

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
                        <Icon className="h-4 w-4" style={{ color: typeColor }} />
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                          placeholder="Budget category name"
                          disabled={isReadOnly}
                          className="font-medium"
                        />
                      </div>
                      
                      <Select
                        value={item.budgetType}
                        onValueChange={(value: BudgetType) => handleUpdate(index, 'budgetType', value)}
                        disabled={isReadOnly}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetTypes.map((type) => {
                            const TypeIcon = budgetTypeIcons[type];
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center">
                                  <TypeIcon className="h-4 w-4 mr-2" style={{ color: budgetTypeColors[type] }} />
                                  {type}
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

                    {/* Budget Allocation */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-[var(--color-text-muted)]">
                          Percentage: {item.percent.toFixed(1)}%
                        </Label>
                        <Slider
                          value={[item.percent]}
                          onValueChange={(value) => handleUpdate(index, 'percent', value[0])}
                          min={0}
                          max={50}
                          step={0.5}
                          disabled={isReadOnly}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-[var(--color-text-muted)]">Amount</Label>
                        <Input
                          type="number"
                          value={item.amount}
                          onChange={(e) => handleUpdate(index, 'amount', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          min="0"
                          step="10000"
                        />
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    </div>

                    {/* Settings */}
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs text-[var(--color-text-muted)]">Priority</Label>
                        <Select
                          value={item.priority}
                          onValueChange={(value: BudgetPriority) => handleUpdate(index, 'priority', value)}
                          disabled={isReadOnly}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {budgetPriorities.map((priority) => (
                              <SelectItem key={priority} value={priority}>
                                <div className="flex items-center">
                                  <div 
                                    className="w-3 h-3 rounded-full mr-2" 
                                    style={{ backgroundColor: priorityColors[priority] }}
                                  />
                                  {priority}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-[var(--color-text-muted)]">Recurring</Label>
                        <Switch
                          checked={item.isRecurring}
                          onCheckedChange={(checked) => handleUpdate(index, 'isRecurring', checked)}
                          disabled={isReadOnly}
                        />
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        {item.isRecurring ? (
                          <CheckCircle className="h-3 w-3 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-3 w-3 text-yellow-600" />
                        )}
                        <span className="text-[var(--color-text-muted)]">
                          {item.isRecurring ? 'Annual recurring' : 'One-time expense'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add New Sub-Budget */}
        {!isReadOnly && (
          <div className="space-y-3">
            {!isAddingNew ? (
              <Button
                variant="outline"
                onClick={() => setIsAddingNew(true)}
                className="w-full h-12 border-2 border-dashed border-[var(--color-border-primary)] hover:border-[var(--color-brand-primary)]"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Sub-Budget Category
              </Button>
            ) : (
              <Card className="border-2 border-dashed border-[var(--color-brand-primary)]">
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <Input
                        value={newBudget.name}
                        onChange={(e) => setNewBudget(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Category name"
                      />
                      
                      <Select
                        value={newBudget.budgetType}
                        onValueChange={(value: BudgetType) => setNewBudget(prev => ({ ...prev, budgetType: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {budgetTypes.map((type) => {
                            const TypeIcon = budgetTypeIcons[type];
                            return (
                              <SelectItem key={type} value={type}>
                                <div className="flex items-center">
                                  <TypeIcon className="h-4 w-4 mr-2" style={{ color: budgetTypeColors[type] }} />
                                  {type}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">Percentage: {newBudget.percent.toFixed(1)}%</Label>
                        <Slider
                          value={[newBudget.percent]}
                          onValueChange={(value) => setNewBudget(prev => ({ 
                            ...prev, 
                            percent: value[0],
                            amount: (departmentBudget * value[0]) / 100
                          }))}
                          min={0}
                          max={remainingPercent}
                          step={0.5}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Recurring</Label>
                        <Switch
                          checked={newBudget.isRecurring}
                          onCheckedChange={(checked) => setNewBudget(prev => ({ ...prev, isRecurring: checked }))}
                        />
                      </div>
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