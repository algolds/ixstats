"use client";
/**
 * SettingsDropdown.tsx — Reusable Popover dropdown for editor preferences (autocomplete, word wrap, line numbers).
 */

import React, { memo } from "react";
import { Settings } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { AppleSwitch } from "~/components/ui/apple-switch";
import { useEditorModalContext } from "../../context/EditorModalContext";

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
      <PopoverTrigger className="wikios-editor-format-btn" title="Editor Settings">
        <Settings className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent align="end" className="text-label w-56 p-2">
        <div className="text-footnote flex flex-col gap-2.5 p-1">
          <div className="border-separator text-label-secondary mb-1 border-b pb-1.5 font-semibold">
            Editor Settings
          </div>

          {showLineNumbersOption && (
            <div className="flex items-center justify-between select-none">
              <span className="font-medium">Line Numbers</span>
              <AppleSwitch
                checked={modal.showLineNumbers}
                onCheckedChange={modal.handleToggleLineNumbers}
                size="sm"
                tone="neutral"
              />
            </div>
          )}

          {showWordWrapOption && (
            <div className="flex items-center justify-between select-none">
              <span className="font-medium">Word Wrap</span>
              <AppleSwitch
                checked={modal.enableWordWrap}
                onCheckedChange={modal.handleToggleWordWrap}
                size="sm"
                tone="neutral"
              />
            </div>
          )}

          <div className="flex items-center justify-between select-none">
            <span className="font-medium">Autocomplete</span>
            <AppleSwitch
              checked={modal.enableAutocomplete}
              onCheckedChange={modal.handleToggleAutocomplete}
              size="sm"
              tone="neutral"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});
