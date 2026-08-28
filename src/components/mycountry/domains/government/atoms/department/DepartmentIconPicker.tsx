import React, { useState } from "react";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { MediaSearchModal } from "~/components/wiki-os/media-search/MediaSearchModal";
import {
  resolveNamedDepartmentIcon,
  isImageIconSource,
  categoryColors,
  categoryIcons,
} from "./department-constants";
import type { DepartmentInput } from "~/types/government";

interface DepartmentIconPickerProps {
  data: DepartmentInput;
  onChange: (data: DepartmentInput) => void;
  isReadOnly?: boolean;
}

export const DepartmentIconPicker = React.memo(function DepartmentIconPicker({
  data,
  onChange,
  isReadOnly,
}: DepartmentIconPickerProps) {
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const currentColor = data.color || categoryColors[data.category] || "#3b82f6";
  const CustomIcon = resolveNamedDepartmentIcon(data.icon);
  const FallbackIcon = categoryIcons[data.category] || categoryIcons.Other!;

  return (
    <div className="border-border/40 bg-card/60 grid grid-cols-1 gap-4 rounded-xl border p-4 sm:grid-cols-2">
      {/* Icon Display and Media Modal */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Department Emblem / Icon
        </Label>
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border shadow-md"
            style={{
              backgroundColor: `${currentColor}25`,
              borderColor: `${currentColor}40`,
              color: currentColor,
            }}
          >
            {isImageIconSource(data.icon) ? (
              <img src={data.icon} alt={data.name} className="h-8 w-8 rounded object-cover" />
            ) : CustomIcon ? (
              <CustomIcon className="h-6 w-6" />
            ) : (
              <FallbackIcon className="h-6 w-6" />
            )}
          </div>

          {!isReadOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMediaModalOpen(true)}
              className="text-xs"
            >
              Choose Custom Image
            </Button>
          )}
        </div>

        <MediaSearchModal
          isOpen={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          onImageSelect={(imageUrl) => {
            onChange({ ...data, icon: imageUrl });
            setMediaModalOpen(false);
          }}
        />
      </div>

      {/* Theme Color Picker */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          Department Accent Color
        </Label>
        <ColorPickerInput
          value={currentColor}
          onChange={(newColor) => onChange({ ...data, color: newColor })}
          disabled={isReadOnly}
        />
      </div>
    </div>
  );
});
