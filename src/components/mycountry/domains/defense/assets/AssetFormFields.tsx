"use client";

import React from "react";
import { EditPencil as Edit, Trash as Trash2, MediaImage as Image } from "iconoir-react";
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
import { Slider } from "~/components/ui/slider";
import { Separator } from "~/components/ui/separator";
import {
  ASSET_TYPE_CONFIG,
  STATUS_CONFIG,
  isAssetStatusKey,
  isAssetTypeKey,
  type AssetFormData,
} from "./asset-config";

interface AssetFormFieldsProps {
  formData: AssetFormData;
  onChange: (formData: AssetFormData) => void;
}

interface NumberFieldProps {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
  parse: (raw: string) => number;
  max?: number;
}

function NumberField({ label, value, onValueChange, parse, max }: NumberFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onValueChange(parse(e.target.value))}
        max={max}
      />
    </div>
  );
}

const parseCount = (raw: string) => parseInt(raw) || 1;
const parseAmount = (raw: string) => parseFloat(raw) || 0;

function EquipmentImageField({ formData, onChange }: AssetFormFieldsProps) {
  return (
    <div className="space-y-2">
      <Label>Equipment Image</Label>
      {formData.imageUrl ? (
        <div className="border-separator rounded-control overflow-hidden border">
          <img
            src={formData.imageUrl}
            alt="Equipment preview"
            className="h-48 w-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="border-separator flex gap-2 border-t p-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                const url = window.prompt("Enter image URL:", formData.imageUrl || "");
                if (url !== null) {
                  onChange({ ...formData, imageUrl: url });
                }
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Change Image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Remove image"
              className="text-label-secondary hover:text-destructive"
              onClick={() => onChange({ ...formData, imageUrl: "" })}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-32 w-full border-dashed"
          onClick={() => {
            const url = window.prompt(
              "Enter image URL from Wikimedia Commons:",
              "https://upload.wikimedia.org/wikipedia/commons/"
            );
            if (url) {
              onChange({ ...formData, imageUrl: url });
            }
          }}
        >
          <div className="flex flex-col items-center gap-2">
            <Image aria-hidden="true" className="text-label-secondary h-8 w-8" />
            <span className="text-body font-medium">Add Equipment Image</span>
            <span className="text-label-secondary text-footnote">Click to enter image URL</span>
          </div>
        </Button>
      )}
      <p className="text-label-secondary text-footnote">
        Template equipment includes images automatically. Custom assets can add images from
        Wikimedia Commons.
      </p>
    </div>
  );
}

/** "Manual Entry" tab of the asset dialog. */
export const AssetFormFields = React.memo(function AssetFormFields({
  formData,
  onChange,
}: AssetFormFieldsProps) {
  return (
    <>
      {/* Asset Type */}
      <div className="space-y-2">
        <Label>Asset Type</Label>
        <Select
          value={formData.assetType}
          onValueChange={(value) => {
            if (isAssetTypeKey(value)) onChange({ ...formData, assetType: value });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ASSET_TYPE_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name & Category */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            placeholder="e.g., F-35 Lightning II"
          />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input
            value={formData.category}
            onChange={(e) => onChange({ ...formData, category: e.target.value })}
            placeholder="e.g., Multirole Fighter"
          />
        </div>
      </div>

      {/* Quantity */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Total Quantity"
          value={formData.quantity}
          onValueChange={(quantity) => onChange({ ...formData, quantity })}
          parse={parseCount}
        />
        <NumberField
          label="Operational"
          value={formData.operational}
          onValueChange={(operational) => onChange({ ...formData, operational })}
          parse={parseCount}
          max={formData.quantity}
        />
      </div>

      {/* Capability */}
      <div className="space-y-2">
        <Label>Capability / Description (Optional)</Label>
        <Input
          value={formData.capability}
          onChange={(e) => onChange({ ...formData, capability: e.target.value })}
          placeholder="Brief description of capabilities"
        />
      </div>

      {/* Performance */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Range (km) (Optional)"
          value={formData.range}
          onValueChange={(range) => onChange({ ...formData, range })}
          parse={parseAmount}
        />
        <NumberField
          label="Payload (kg) (Optional)"
          value={formData.payload}
          onValueChange={(payload) => onChange({ ...formData, payload })}
          parse={parseAmount}
        />
      </div>

      {/* Status */}
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          value={formData.status}
          onValueChange={(value) => {
            if (isAssetStatusKey(value)) onChange({ ...formData, status: value });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([key, config]) => (
              <SelectItem key={key} value={key}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Modernization Level */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Modernization Level</Label>
          <span className="text-body font-medium tabular-nums">{formData.modernizationLevel}%</span>
        </div>
        <Slider
          value={[formData.modernizationLevel]}
          onValueChange={([value]) => onChange({ ...formData, modernizationLevel: value })}
          max={100}
          step={1}
        />
      </div>

      <Separator />

      {/* Costs */}
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Acquisition Cost ($)"
          value={formData.acquisitionCost}
          onValueChange={(acquisitionCost) => onChange({ ...formData, acquisitionCost })}
          parse={parseAmount}
        />
        <NumberField
          label="Annual Maintenance ($)"
          value={formData.maintenanceCost}
          onValueChange={(maintenanceCost) => onChange({ ...formData, maintenanceCost })}
          parse={parseAmount}
        />
      </div>

      {/* Equipment Image */}
      <EquipmentImageField formData={formData} onChange={onChange} />
    </>
  );
});
