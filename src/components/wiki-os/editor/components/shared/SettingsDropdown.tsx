"use client";
/**
 * SettingsDropdown.tsx — Reusable Popover dropdown for editor preferences (autocomplete, word wrap, line numbers).
 */

import React, { memo } from "react";
import { Settings } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Switch } from "~/components/ui/switch";
import { useEditorModalContext } from "../../context/EditorModalContext";
import { Button } from "~/components/ui/button";

export interface SettingsDropdownProps {
  showLineNumbersOption?: boolean;
  showWordWrapOption?: boolean;
}

export const SettingsDropdown = memo(function SettingsDropdown({
  showLineNumbersOption = false,
  showWordWrapOption = false,
}: SettingsDropdownProps) {
  const modal = useEditorModalContext();

  return (
    <Popover open={modal.settingsOpen} onOpenChange={modal.setSettingsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-label-secondary"
          title="Editor settings"
          aria-label="Editor settings"
        >
          <Settings className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="text-label w-56 p-2">
        <div className="text-footnote flex flex-col gap-2 p-1">
          <div className="border-separator text-label-secondary mb-1 border-b pb-2 font-semibold">
            Editor settings
          </div>

          {showLineNumbersOption && (
            <div className="flex items-center justify-between select-none">
              <span className="font-medium">Line numbers</span>
              <Switch
                checked={modal.showLineNumbers}
                onCheckedChange={modal.handleToggleLineNumbers}
                size="sm"
              />
            </div>
          )}

          {showWordWrapOption && (
            <div className="flex items-center justify-between select-none">
              <span className="font-medium">Word wrap</span>
              <Switch
                checked={modal.enableWordWrap}
                onCheckedChange={modal.handleToggleWordWrap}
                size="sm"
              />
            </div>
          )}

          <div className="flex items-center justify-between select-none">
            <span className="font-medium">Autocomplete</span>
            <Switch
              checked={modal.enableAutocomplete}
              onCheckedChange={modal.handleToggleAutocomplete}
              size="sm"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
