"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { MediaImage, Trash, Upload } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { assetUrl, stripBasePath } from "~/lib/base-path";
import { uploadImageFile } from "~/lib/media/upload-image";
import { isRealmImageUrl } from "~/lib/realms/realm-region";
import { Field, fieldAria } from "./StepCard";

// The repository picker is large; load it only when it opens.
const MediaSearchModal = dynamic(
  () =>
    import("~/components/wiki-os/media-search/MediaSearchModal").then((m) => m.MediaSearchModal),
  { ssr: false }
);

/** The image upload route's limit (`/api/upload/image` enforces it; this only saves a doomed upload). */
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const HELPER = "Upload an image, pick one from the repository, or paste an https:// address.";

/** The nation's flag: upload, repository or address, as a realm's images are chosen. */
export function FlagField({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const notify = useNotify();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const ok = isRealmImageUrl(value);
  // An uploaded or repository image is a site path nobody needs to read: no address box.
  const hosted = ok && value.trim().startsWith("/");
  const preview = ok && value.trim() ? assetUrl(value.trim()) : null;

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
    } catch (uploadError) {
      notify.error(
        "Upload failed",
        uploadError instanceof Error ? uploadError.message : "Try another image."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field id={hosted ? `${id}-upload` : id} label="Flag" helper={HELPER} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        {preview && (
          <img
            src={preview}
            referrerPolicy="no-referrer"
            alt="Flag preview"
            className="border-separator rounded-control-sm h-10 w-16 shrink-0 border object-cover"
          />
        )}
        {!hosted && (
          <Input
            id={id}
            className="min-w-48 flex-1"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="https://"
            inputMode="url"
            {...fieldAria(id, error, HELPER)}
          />
        )}
        <Button
          id={hosted ? `${id}-upload` : undefined}
          type="button"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Upload aria-hidden />
          {uploading ? "Uploading…" : hosted ? "Replace" : "Upload"}
        </Button>
        <Button type="button" variant="outline" onClick={() => setPickerOpen(true)}>
          <MediaImage aria-hidden />
          Repository
        </Button>
        {hosted && (
          <Button type="button" variant="ghost" onClick={() => onChange("")}>
            <Trash aria-hidden />
            Remove
          </Button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
          className="hidden"
          aria-label="Upload a flag"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </div>
      {pickerOpen && (
        <MediaSearchModal
          isOpen
          onClose={() => setPickerOpen(false)}
          // The picker's local paths carry the base path; the nation stores them without it.
          onImageSelect={(url) => onChange(stripBasePath(url))}
        />
      )}
    </Field>
  );
}
