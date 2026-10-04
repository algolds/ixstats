import React, { useState } from "react";
import { Eyebrow } from "~/components/ui/eyebrow";
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
import { Card } from "~/components/ui/card";

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
    <Card variant="well" className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Eyebrow className="block">Department emblem / icon</Eyebrow>
        <div className="flex items-center gap-3">
          {/* The department's own chosen colour (user data) tints its emblem preview. */}
          <div
            className="border-separator rounded-control flex h-12 w-12 shrink-0 items-center justify-center border"
            style={{ color: currentColor }}
          >
            {isImageIconSource(data.icon) ? (
              <img
                src={data.icon}
                alt={data.name}
                className="rounded-control-sm h-8 w-8 object-cover"
              />
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
            >
              Choose custom image
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

      <div className="space-y-2">
        <Eyebrow className="block">Department accent color</Eyebrow>
        <ColorPickerInput
          value={currentColor}
          onChange={(newColor) => onChange({ ...data, color: newColor })}
          disabled={isReadOnly}
        />
      </div>
    </Card>
  );
});
