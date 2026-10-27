// The image on a `File:` page, above its description. Plain markup, rendered on the server so the
// image is in the first HTML (it is the largest thing on the page), with the file's BlurHash behind
// it until it loads (WK-17).

import { PlaceholderImage } from "~/components/wiki-os/shared/PlaceholderImage";
import { assetUrl } from "~/lib/base-path";
import { BlurHashService } from "~/lib/wiki-os/core/blurhash-service";
import type { FileInfo } from "~/lib/wiki-os/core/file-page-service";

function formatBytes(bytes: number): string {
  return bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function FileImage({ file }: { file: FileInfo }) {
  const src = assetUrl(file.url);
  if (!src) return null;

  const facts = [
    file.width && file.height ? `${file.width} × ${file.height} pixels` : null,
    file.sizeBytes ? formatBytes(file.sizeBytes) : null,
    file.mimeType,
  ].filter(Boolean);

  // A PDF (plan 411) has no picture to show: the link is the file.
  const isPicture = !file.mimeType || file.mimeType.startsWith("image/");

  return (
    <figure className="mb-6">
      {isPicture ? (
        <a href={src} target="_blank" rel="noopener">
          <PlaceholderImage
            placeholder={BlurHashService.placeholderDataUri(file.blurhash, file.width, file.height)}
            src={src}
            alt={file.name}
            width={file.width ?? undefined}
            height={file.height ?? undefined}
            referrerPolicy="no-referrer"
            fetchPriority="high"
            className="max-h-[70vh] max-w-full rounded-lg border border-white/10 object-contain"
          />
        </a>
      ) : (
        <a
          href={src}
          target="_blank"
          rel="noopener"
          className="text-wiki text-sm font-medium underline"
        >
          Download {file.name}
        </a>
      )}
      <figcaption className="text-muted-foreground mt-2 text-xs">
        {file.name}
        {facts.length > 0 ? ` (${facts.join(", ")})` : ""}
      </figcaption>
    </figure>
  );
}
