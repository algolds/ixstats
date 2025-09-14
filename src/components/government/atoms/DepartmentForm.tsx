"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Textarea } from '~/components/ui/textarea';
import { Button } from '~/components/ui/button';
import { Badge } from '~/components/ui/badge';
import { Slider } from '~/components/ui/slider';
import { 
  Plus, 
  X, 
  Shield, 
  GraduationCap, 
  Heart, 
  Briefcase, 
  Truck,
  Leaf,
  Users,
  Building,
  Globe,
  Zap,
  Wifi,
  Palette,
  Beaker,
  Home,
  Medal,
  Eye,
  AlertTriangle,
  MoreHorizontal
} from 'lucide-react';
import type { DepartmentInput, DepartmentCategory, OrganizationalLevel } from '~/types/government';

interface DepartmentFormProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
  availableParents?: { id: string; name: string }[];
}

const departmentCategories: DepartmentCategory[] = [
  'Defense', 'Education', 'Health', 'Finance', 'Foreign Affairs', 'Interior',
  'Justice', 'Transportation', 'Agriculture', 'Environment', 'Labor', 'Commerce',
  'Energy', 'Communications', 'Culture', 'Science and Technology', 'Social Services',
  'Housing', 'Veterans Affairs', 'Intelligence', 'Emergency Management', 'Other'
];

const organizationalLevels: OrganizationalLevel[] = [
  'Ministry', 'Department', 'Agency', 'Bureau', 'Office', 'Commission'
];

const categoryIcons = {
  'Defense': Shield,
  'Education': GraduationCap,
  'Health': Heart,
  'Finance': Briefcase,
  'Foreign Affairs': Globe,
  'Interior': Home,
  'Justice': Users,
  'Transportation': Truck,
  'Agriculture': Leaf,
  'Environment': Leaf,
  'Labor': Users,
  'Commerce': Building,
  'Energy': Zap,
  'Communications': Wifi,
  'Culture': Palette,
  'Science and Technology': Beaker,
  'Social Services': Heart,
  'Housing': Home,
  'Veterans Affairs': Medal,
  'Intelligence': Eye,
  'Emergency Management': AlertTriangle,
  'Other': MoreHorizontal
};

const categoryColors = {
  'Defense': '#dc2626',
  'Education': '#2563eb',
  'Health': '#059669',
  'Finance': '#7c3aed',
  'Foreign Affairs': '#0891b2',
  'Interior': '#ea580c',
  'Justice': '#4338ca',
  'Transportation': '#0d9488',
  'Agriculture': '#65a30d',
  'Environment': '#059669',
  'Labor': '#7c2d12',
  'Commerce': '#1d4ed8',
  'Energy': '#eab308',
  'Communications': '#6366f1',
  'Culture': '#ec4899',
  'Science and Technology': '#8b5cf6',
  'Social Services': '#ef4444',
  'Housing': '#f59e0b',
  'Veterans Affairs': '#10b981',
  'Intelligence': '#374151',
  'Emergency Management': '#dc2626',
  'Other': '#6b7280'
};

export function DepartmentForm({ 
  data, 
  onChange, 
  onDelete,
  isReadOnly = false,
  availableParents = []
}: DepartmentFormProps) {
  const [newFunction, setNewFunction] = useState('');

  const handleChange = (field: keyof DepartmentInput, value: any) => {
    onChange({
      ...data,
      [field]: value
    });
  };

  const addFunction = () => {
    if (newFunction.trim()) {
      const currentFunctions = data.functions || [];
      handleChange('functions', [...currentFunctions, newFunction.trim()]);
      setNewFunction('');
    }
  };

  const removeFunction = (index: number) => {
    const currentFunctions = data.functions || [];
    handleChange('functions', currentFunctions.filter((_, i) => i !== index));
  };

  const IconComponent = categoryIcons[data.category] || MoreHorizontal;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg font-semibold text-[var(--color-text-primary)]">
            <IconComponent className="h-5 w-5 mr-2" style={{ color: data.color || categoryColors[data.category] }} />
            {data.name || 'New Department'}
          </CardTitle>
          {onDelete && !isReadOnly && (
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Department Name *
            </Label>
            <Input
              id="name"
              value={data.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g., Ministry of Defense"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="shortName" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Short Name
            </Label>
            <Input
              id="shortName"
              value={data.shortName || ''}
              onChange={(e) => handleChange('shortName', e.target.value)}
              placeholder="e.g., MoD"
              disabled={isReadOnly}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Category *
            </Label>
            <Select
              value={data.category}
              onValueChange={(value: DepartmentCategory) => {
                handleChange('category', value);
                // Auto-update color when category changes
                handleChange('color', categoryColors[value]);
              }}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {departmentCategories.map((category) => {
                  const Icon = categoryIcons[category];
                  return (
                    <SelectItem key={category} value={category}>
                      <div className="flex items-center">
                        <Icon className="h-4 w-4 mr-2" style={{ color: categoryColors[category] }} />
                        {category}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="organizationalLevel" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Organizational Level
            </Label>
            <Select
              value={data.organizationalLevel}
              onValueChange={(value: OrganizationalLevel) => handleChange('organizationalLevel', value)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select level" />
              </SelectTrigger>
              <SelectContent>
                {organizationalLevels.map((level) => (
                  <SelectItem key={level} value={level}>
                    {level}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Description
          </Label>
          <Textarea
            id="description"
            value={data.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Brief description of the department's role and responsibilities"
            disabled={isReadOnly}
            rows={3}
          />
        </div>

        {/* Leadership */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="minister" className="text-sm font-medium text-[var(--color-text-secondary)]">
              {data.ministerTitle}
            </Label>
            <Input
              id="minister"
              value={data.minister || ''}
              onChange={(e) => handleChange('minister', e.target.value)}
              placeholder={`Name of ${data.ministerTitle.toLowerCase()}`}
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ministerTitle" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Title
            </Label>
            <Input
              id="ministerTitle"
              value={data.ministerTitle}
              onChange={(e) => handleChange('ministerTitle', e.target.value)}
              placeholder="e.g., Minister, Secretary"
              disabled={isReadOnly}
            />
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="headquarters" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Headquarters
            </Label>
            <Input
              id="headquarters"
              value={data.headquarters || ''}
              onChange={(e) => handleChange('headquarters', e.target.value)}
              placeholder="Location or building"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="established" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Established
            </Label>
            <Input
              id="established"
              value={data.established || ''}
              onChange={(e) => handleChange('established', e.target.value)}
              placeholder="Year established"
              disabled={isReadOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="employeeCount" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Employee Count
            </Label>
            <Input
              id="employeeCount"
              type="number"
              value={data.employeeCount || ''}
              onChange={(e) => handleChange('employeeCount', parseInt(e.target.value) || undefined)}
              placeholder="Number of employees"
              disabled={isReadOnly}
              min="0"
            />
          </div>
        </div>

        {/* Priority */}
        <div className="space-y-3">
          <Label htmlFor="priority" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Priority Level: {data.priority}
          </Label>
          <Slider
            id="priority"
            value={[data.priority]}
            onValueChange={(value) => handleChange('priority', value[0])}
            min={1}
            max={100}
            step={1}
            disabled={isReadOnly}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
            <span>Low Priority (1)</span>
            <span>High Priority (100)</span>
          </div>
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label htmlFor="color" className="text-sm font-medium text-[var(--color-text-secondary)]">
            Theme Color
          </Label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              id="color"
              value={data.color}
              onChange={(e) => handleChange('color', e.target.value)}
              disabled={isReadOnly}
              className="w-12 h-8 border border-[var(--color-border-primary)] rounded cursor-pointer"
            />
            <Input
              value={data.color}
              onChange={(e) => handleChange('color', e.target.value)}
              placeholder="#6366f1"
              disabled={isReadOnly}
              className="max-w-32"
            />
          </div>
        </div>

        {/* Parent Department */}
        {availableParents.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="parentDepartment" className="text-sm font-medium text-[var(--color-text-secondary)]">
              Parent Department
            </Label>
            <Select
              value={data.parentDepartmentId || 'no-parent'}
              onValueChange={(value) => handleChange('parentDepartmentId', value === 'no-parent' ? undefined : value)}
              disabled={isReadOnly}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent department (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="no-parent">No Parent</SelectItem>
                {availableParents.map((parent) => (
                  <SelectItem key={parent.id} value={parent.id}>
                    {parent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Functions */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-[var(--color-text-secondary)]">
            Functions & Responsibilities
          </Label>
          
          {!isReadOnly && (
            <div className="flex gap-2">
              <Input
                value={newFunction}
                onChange={(e) => setNewFunction(e.target.value)}
                placeholder="Add a function or responsibility"
                onKeyPress={(e) => e.key === 'Enter' && addFunction()}
              />
              <Button onClick={addFunction} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {(data.functions || []).map((func, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {func}
                {!isReadOnly && (
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-red-500"
                    onClick={() => removeFunction(index)}
                  />
                )}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}