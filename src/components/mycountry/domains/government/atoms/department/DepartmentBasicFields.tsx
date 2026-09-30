import React from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Slider } from "~/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { DepartmentInput, DepartmentCategory, OrganizationalLevel } from "~/types/government";
import {
  departmentCategories,
  organizationalLevels,
  getPriorityDetails,
} from "./department-constants";

interface DepartmentBasicFieldsProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  isReadOnly?: boolean;
  errors?: Record<string, string[]>;
}

export const DepartmentBasicFields = React.memo(function DepartmentBasicFields({
  data,
  onChange,
  isReadOnly,
  errors,
}: DepartmentBasicFieldsProps) {
  const priorityDetails = getPriorityDetails(data.priority || 5);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="dept-name">Department Name *</Label>
          <Input
            id="dept-name"
            value={data.name}
            onChange={(e) => onChange({ ...data, name: e.target.value })}
            placeholder="e.g. Ministry of Finance"
            disabled={isReadOnly}
          />
          {errors?.name && <p className="text-xs text-red-400">{errors.name[0]}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="dept-shortname">Short Name / Acronym</Label>
          <Input
            id="dept-shortname"
            value={data.shortName || ""}
            onChange={(e) => onChange({ ...data, shortName: e.target.value })}
            placeholder="e.g. MoF"
            disabled={isReadOnly}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select
            value={data.category}
            onValueChange={(val) => onChange({ ...data, category: val as DepartmentCategory })}
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {departmentCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Organizational Level</Label>
          <Select
            value={data.organizationalLevel || "Department"}
            onValueChange={(val) =>
              onChange({ ...data, organizationalLevel: val as OrganizationalLevel })
            }
            disabled={isReadOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
              {organizationalLevels.map((lvl) => (
                <SelectItem key={lvl} value={lvl}>
                  {lvl}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="minister-title">Minister Title</Label>
        <Input
          id="minister-title"
          value={data.ministerTitle || ""}
          onChange={(e) => onChange({ ...data, ministerTitle: e.target.value })}
          placeholder="e.g. Minister of Finance"
          disabled={isReadOnly}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dept-desc">Description</Label>
        <Textarea
          id="dept-desc"
          value={data.description || ""}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          placeholder="Mandate, responsibilities, and operational scope..."
          rows={3}
          disabled={isReadOnly}
        />
      </div>

      {/* Priority Level Slider */}
      <div className="border-border/40 bg-card/60 space-y-2 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Operational Priority
          </Label>
          <span
            className={`rounded-md border px-2 py-0.5 text-xs font-medium ${priorityDetails.color}`}
          >
            {priorityDetails.label} ({data.priority || 5}/10)
          </span>
        </div>
        <Slider
          value={[data.priority || 5]}
          min={1}
          max={10}
          step={1}
          onValueChange={([val]) => onChange({ ...data, priority: val })}
          disabled={isReadOnly}
          className="py-2"
        />
        <p className="text-muted-foreground text-xs">{priorityDetails.desc}</p>
      </div>
    </div>
  );
});
