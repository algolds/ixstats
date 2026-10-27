"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ShareAndroid } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { createUrl } from "~/lib/utils/url-utils";

/** An extra copy-link item a host adds to the sheet (the realm invite). */
export interface ShareSheetExtraLink {
  /** Stable key and the item's label, e.g. "Copy invite link". */
  label: string;
  /** App path, query string allowed (`/r/eurth?via=alex`); the sheet makes it absolute. */
  path: string;
}

interface ShareSheetProps {
  /** Canonical app path of the page (no base path, no query string), e.g. `/@alex`. */
  path: string;
  /** Title handed to the native share sheet. */
  title: string;
  /** App path of the page's Open Graph image; omit to hide Download card. */
  imagePath?: string;
  /** File name the downloaded card is saved as. */
  downloadName?: string;
  /** Host-specific copy-link items shown after the standard ones. */
  extraLinks?: readonly ShareSheetExtraLink[];
}

/** An absolute URL for an app path: the page's origin plus the base path. */
function absoluteUrl(path: string): string {
  return `${window.location.origin}${createUrl(path)}`;
}

/** The canonical link never carries a query string or fragment (`?tab=` and the like). */
function canonicalPath(path: string): string {
  return path.split(/[?#]/)[0] ?? path;
}

const COPIED_MS = 2000;

/**
 * A Share button that opens a small sheet: Copy link, the native share sheet when the browser has one,
 * Download card, and any items the host adds. Links are absolute and include the base path.
 */
export const ShareSheet = React.memo(function ShareSheet({
  path,
  title,
  imagePath,
  downloadName,
  extraLinks = [],
}: ShareSheetProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async (key: string, target: string) => {
    try {
      await navigator.clipboard.writeText(absoluteUrl(target));
      setCopied(key);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), COPIED_MS);
    } catch {
      // Clipboard unavailable (permission denied or insecure context): nothing copied.
    }
  }, []);

  const nativeShare = useCallback(async () => {
    try {
      await navigator.share({ title, url: absoluteUrl(canonicalPath(path)) });
      setOpen(false);
    } catch {
      // Dismissed by the user or refused by the browser.
    }
  }, [title, path]);

  // Read at render: the sheet's content only mounts after the user opens it, in the browser.
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const items: readonly { key: string; label: string; target: string }[] = [
    { key: "link", label: "Copy link", target: canonicalPath(path) },
    ...extraLinks.map((l) => ({ key: l.label, label: l.label, target: l.path })),
  ];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          <ShareAndroid aria-hidden />
          <span>Share</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-56 flex-col gap-1 p-2">
        {items.map((item) => (
          <Button
            key={item.key}
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void copy(item.key, item.target)}
          >
            {copied === item.key ? (
              <Check aria-hidden className="text-success" />
            ) : (
              <Copy aria-hidden />
            )}
            <span>{copied === item.key ? "Copied" : item.label}</span>
          </Button>
        ))}
        {canNativeShare && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => void nativeShare()}
          >
            <ShareAndroid aria-hidden />
            <span>Share to other apps</span>
          </Button>
        )}
        {imagePath && (
          <Button asChild variant="ghost" size="sm" className="w-full justify-start">
            <a href={createUrl(imagePath)} download={downloadName ?? ""}>
              <Download aria-hidden />
              <span>Download card</span>
            </a>
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
});
