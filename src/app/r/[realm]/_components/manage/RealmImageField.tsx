"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MediaImage, Trash, Upload } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { assetUrl, stripBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import { uploadImageFile } from "~/lib/media/upload-image";
import { isRealmImageUrl } from "~/lib/realms/realm-region";

// The repository picker is large; load it only when it opens.
const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

/** The image upload route's limit (`/api/upload/image` enforces it; this only saves a doomed upload). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/**
 * A realm image (banner, thumbnail or emblem): upload a file through the site's image upload route, pick one from
 * the image repository, or type an https:// address. Checked as typed, with a preview.
 */
export function RealmImageField({
  id,
  label,
  value,
  onChange,
  previewClassName,
  valid,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Size of the preview: the banner is wide, the thumbnail square. */
  previewClassName: string;
  /** Overrides the address check, for a stored value from before the check existed. */
  valid?: boolean;
}) {
  const notify = useNotify();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ok = valid ?? isRealmImageUrl(value);
  // An uploaded or repository image is a site path nobody needs to read: no address box, a Remove button instead.
  const hosted = ok && value.trim().startsWith("/");
  const preview = ok ? assetUrl(value) : null;

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      notify.error("Not an image", "Upload a PNG, JPG, GIF, WEBP or SVG file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      notify.error("Image too large", "Images can be up to 5MB.");
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadImageFile(file));
      notify.success("Image uploaded", "Save to apply it.");
    } catch (error) {
      notify.error("Upload failed", error instanceof Error ? error.message : undefined);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label id={`${id}-label`} htmlFor={hosted ? undefined : id}>
        {label}
      </Label>
      <div
        className="flex flex-wrap gap-2"
        role={hosted ? "group" : undefined}
        aria-labelledby={hosted ? `${id}-label` : undefined}
      >
        {!hosted && (
          <Input
            id={id}
            className="min-w-48 flex-1"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://"
            aria-invalid={!ok}
          />
        )}
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden="true" />
          {uploading ? "Uploading…" : hosted ? "Replace" : "Upload"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          <MediaImage aria-hidden="true" />
          Repository
        </Button>
        {hosted && (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            <Trash aria-hidden="true" />
            Remove
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="hidden"
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {pickerOpen && (
        <MediaSearchModal
          isOpen
          onClose={() => setPickerOpen(false)}
          // The picker's local paths carry the base path; the realm stores them without it.
          onImageSelect={(url) => onChange(stripBasePath(url))}
        />
      )}
      {!ok && (
        <p className="text-destructive text-footnote">
          Use an https:// image address, upload an image or pick one from the repository.
        </p>
      )}
      {preview && (
        <img
          src={preview}
          referrerPolicy="no-referrer"
          alt={`${label} preview`}
          className={cn("border-separator rounded-row mt-1 border object-cover", previewClassName)}
        />
      )}
    </div>
  );
}
