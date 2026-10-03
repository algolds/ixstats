"use client";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";
import type { RevenueCategory } from "~/types/government";
import {
  getCollectionMethodIcon,
  getCollectionMethodsForCategory,
  revenueCategories,
  revenueCategoryIcons,
} from "./revenueConstants";

/** `dense` is the compact in-row variant; the add form uses the roomier one. */
interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dense?: boolean;
}

export function RevenueCategorySelect({
  value,
  onChange,
  disabled,
  dense,
}: SelectProps & { value: RevenueCategory; onChange: (value: RevenueCategory) => void }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={dense ? "h-8" : undefined}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {revenueCategories.map((category) => {
          const CategoryIcon = revenueCategoryIcons[category];
          return (
            <SelectItem key={category} value={category}>
              <div className="flex items-center">
                <CategoryIcon
                  className={cn("text-label-secondary mr-2", dense ? "h-3.5 w-3.5" : "h-4 w-4")}
                />
                {category}
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function CollectionMethodSelect({
  category,
  value,
  onChange,
  disabled,
  dense,
}: SelectProps & { category: RevenueCategory }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("text-footnote", dense && "h-8")}>
        <SelectValue placeholder="Select collection method" />
      </SelectTrigger>
      <SelectContent className={dense ? "max-h-80" : undefined}>
        {getCollectionMethodsForCategory(category).map((method) => {
          const IconComponent = getCollectionMethodIcon(method.icon);
          return (
            <SelectItem key={method.id} value={method.id}>
              <div className="flex items-center gap-2">
                <IconComponent
                  className={cn("text-label-secondary shrink-0", dense ? "h-3.5 w-3.5" : "h-4 w-4")}
                />
                <div className="flex flex-col text-left">
                  <span className="text-caption font-semibold">{method.name}</span>
                  <span className="text-label-secondary text-footnote">{method.description}</span>
                </div>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

/** A department picker, or a free-text input when the country has no departments yet. */
export function AdministeredBySelect({
  value,
  onChange,
  disabled,
  dense,
  departments,
  placeholder,
}: SelectProps & { departments: { id: string; name: string }[]; placeholder: string }) {
  if (departments.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={dense ? "h-8" : undefined}
      />
    );
  }
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={cn("text-footnote", dense && "h-8")}>
        <SelectValue placeholder="Select department" />
      </SelectTrigger>
      <SelectContent>
        {departments
          .filter((dept) => dept.name && dept.name.trim() !== "")
          .map((dept) => (
            <SelectItem key={dept.id} value={dept.name}>
              {dept.name}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
