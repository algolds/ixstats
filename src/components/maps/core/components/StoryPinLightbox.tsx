"use client";

import React from "react";
import { ImageLightbox } from "./ImageLightbox";

interface StoryPinLightboxProps {
  src: string;
  alt: string;
  onClose: () => void;
}

export function StoryPinLightbox({ src, alt, onClose }: StoryPinLightboxProps) {
  return <ImageLightbox src={src} alt={alt} onClose={onClose} />;
}
