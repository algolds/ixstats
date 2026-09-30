import type { ComponentType, ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { SettingsRow } from "./SettingsRow";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SettingsSelectRowProps {
  id: string;
  label: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  glyphClass?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
}

export function SettingsSelectRow({
  id: _id,
  label,
  description,
  icon,
  glyphClass,
  value,
  onValueChange,
  options,
  placeholder = "Select option",
  disabled = false,
  triggerClassName = "w-[180px]",
}: SettingsSelectRowProps) {
  return (
    <SettingsRow label={label} description={description} icon={icon} glyphClass={glyphClass}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="facet-modal">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} description={option.description}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SettingsRow>
  );
}
