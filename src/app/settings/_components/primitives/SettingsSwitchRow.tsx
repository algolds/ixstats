import type { ComponentType, ReactNode } from "react";
import { Switch } from "~/components/ui/switch";
import { SettingsRow } from "./SettingsRow";

interface SettingsSwitchRowProps {
  id: string;
  label: string;
  description?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  glyphClass?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function SettingsSwitchRow({
  id,
  label,
  description,
  icon,
  glyphClass,
  checked,
  onCheckedChange,
  disabled = false,
}: SettingsSwitchRowProps) {
  return (
    <SettingsRow label={label} description={description} icon={icon} glyphClass={glyphClass}>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-cuelume-press="soft"
      />
    </SettingsRow>
  );
}
