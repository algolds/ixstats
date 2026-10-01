"use client";

import React from "react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/** Full-screen image viewer on the Dialog primitive (Escape and the close button dismiss it). */
export function ImageLightbox({ src, alt = "", onClose }: ImageLightboxProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-auto max-w-[90vw] border-0 bg-transparent p-0 shadow-none backdrop-blur-none sm:max-w-[90vw]">
        <DialogTitle className="sr-only">{alt || "Image"}</DialogTitle>
        <img
          src={src}
          alt={alt}
          className="rounded-control max-h-[90vh] max-w-[90vw] object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
