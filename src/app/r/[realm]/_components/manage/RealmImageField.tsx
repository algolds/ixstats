"use client";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { isRealmImageUrl } from "~/lib/realms/realm-region";

/** A realm image (banner or thumbnail): its address, checked as typed, with a preview. */
export function RealmImageField({
  id,
  label,
  value,
  onChange,
  previewClassName,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Size of the preview: the banner is wide, the thumbnail square. */
  previewClassName: string;
}) {
  const ok = isRealmImageUrl(value);
  const preview = ok ? assetUrl(value) : null;
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://"
        aria-invalid={!ok}
      />
      {!ok && <p className="text-destructive text-footnote">Use an https:// image address.</p>}
      {preview && (
        <img
          src={preview}
          alt={`${label} preview`}
          className={cn("border-separator rounded-row mt-1 border object-cover", previewClassName)}
        />
      )}
    </div>
  );
}
