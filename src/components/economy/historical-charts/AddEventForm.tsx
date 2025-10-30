// src/components/economy/historical-charts/AddEventForm.tsx
/**
 * Add Event Form Component
 *
 * Form for creating new economic events
 */

import React, { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { IxTime } from "~/lib/ixtime";
import type { EconomicEvent } from "~/lib/historical-economic-data-transformers";

interface AddEventFormProps {
  onSubmit: (event: Omit<EconomicEvent, 'id'>) => void;
  onCancel: () => void;
}

const eventTypes = [
  { value: 'dm_input', label: 'DM Input' },
  { value: 'policy_change', label: 'Policy Change' },
  { value: 'economic_shift', label: 'Economic Shift' },
  { value: 'external_event', label: 'External Event' },
];

const eventCategories = [
  'Trade Agreement',
  'Natural Disaster',
  'Economic Policy',
  'Population Change',
  'Technology Advancement',
  'Political Change',
  'Infrastructure Development',
  'Resource Discovery',
  'Market Expansion',
  'Financial Crisis',
  'Regulatory Change',
  'Other'
];

export const AddEventForm = React.memo(function AddEventForm({
  onSubmit,
  onCancel,
}: AddEventFormProps) {
  const [formData, setFormData] = useState<Omit<EconomicEvent, 'id'>>({
    timestamp: IxTime.getCurrentIxTime(),
    type: 'dm_input',
    category: 'Economic Policy',
    title: '',
    description: '',
    impact: {},
    severity: 'moderate',
    source: 'dm',
    isActive: true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Event Title</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Enter event title"
            required
          />
        </div>
        <div>
          <Label htmlFor="type">Event Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as EconomicEvent['type'] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventTypes.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="category">Category</Label>
          <Select value={formData.category} onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eventCategories.map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="severity">Severity</Label>
          <Select value={formData.severity} onValueChange={(value) => setFormData(prev => ({ ...prev, severity: value as EconomicEvent['severity'] }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minor">Minor</SelectItem>
              <SelectItem value="moderate">Moderate</SelectItem>
              <SelectItem value="major">Major</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe the event and its context"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label htmlFor="gdpImpact">GDP Impact (%)</Label>
          <Input
            id="gdpImpact"
            type="number"
            step="0.1"
            placeholder="e.g., 2.5"
            value={formData.impact.gdp || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              impact: { ...prev.impact, gdp: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
        <div>
          <Label htmlFor="populationImpact">Population Impact (%)</Label>
          <Input
            id="populationImpact"
            type="number"
            step="0.1"
            placeholder="e.g., 1.2"
            value={formData.impact.population || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              impact: { ...prev.impact, population: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
        <div>
          <Label htmlFor="employmentImpact">Employment Impact (%)</Label>
          <Input
            id="employmentImpact"
            type="number"
            step="0.1"
            placeholder="e.g., -0.5"
            value={formData.impact.employment || ''}
            onChange={(e) => setFormData(prev => ({
              ...prev,
              impact: { ...prev.impact, employment: parseFloat(e.target.value) || undefined }
            }))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="duration">Duration (months)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            placeholder="e.g., 12"
            value={formData.duration || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, duration: parseInt(e.target.value) || undefined }))}
          />
        </div>
        <div className="flex items-center space-x-2 pt-6">
          <input
            type="checkbox"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
            className="rounded"
          />
          <Label htmlFor="isActive" className="text-sm">Event is currently active</Label>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          Add Event
        </Button>
      </div>
    </form>
  );
});
