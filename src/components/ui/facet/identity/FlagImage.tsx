"use client";

import { useState } from "react";
import { assetUrl } from "~/lib/base-path";

interface FlagImageProps {
  src: string | null | undefined;
  name: string;
  className?: string;
  monogramClassName?: string;
  alt?: string;
  lazy?: boolean;
}

/** A flag image resolved through assetUrl, or the name's first letter when there is no flag or it fails to load. */
export function FlagImage({
  src,
  name,
  className,
  monogramClassName,
  alt = "",
  lazy = true,
}: FlagImageProps) {
  const resolved = assetUrl(src);
  const [failed, setFailed] = useState<string | null>(null);
  if (!resolved || failed === resolved) {
    return (
      <span aria-hidden className={monogramClassName}>
        {name.charAt(0)}
      </span>
    );
  }
  return (
    // oxlint-disable-next-line nextjs/no-img-element -- remote flag image
    <img
      src={resolved}
      alt={alt}
      loading={lazy ? "lazy" : undefined}
      onError={() => setFailed(resolved)}
      className={className}
    />
  );
}
