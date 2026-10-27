"use client";
// An <img> that shows a placeholder (an asset's BlurHash, drawn by BlurHashService) behind itself until its own
// pixels arrive (WK-17). The placeholder is a CSS background on the element, so the box keeps the file's shape and
// nothing moves; it is removed once the picture has loaded, so a transparent picture never shows the blur through.

import { useEffect, useRef, useState, type CSSProperties, type ImgHTMLAttributes } from "react";

export interface PlaceholderImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
  /** A data URI to show until the picture has loaded; null shows nothing behind it. */
  placeholder: string | null;
}

export function PlaceholderImage({
  placeholder,
  alt,
  style,
  onLoad,
  ...props
}: PlaceholderImageProps) {
  const ref = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);

  // A picture that loaded before hydration fired no React `onLoad`: look once the page is interactive
  useEffect(() => {
    const image = ref.current;
    if (image?.complete && image.naturalWidth > 0) {
      // reads the DOM's state (an external system) after hydration, which no render can know
      // oxlint-disable-next-line
      setLoaded(true);
    }
  }, []);

  const placeholderStyle: CSSProperties | undefined =
    placeholder && !loaded
      ? {
          ...style,
          backgroundImage: `url("${placeholder}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }
      : style;

  return (
    <img
      ref={ref}
      alt={alt}
      {...props}
      style={placeholderStyle}
      data-placeholder={placeholder && !loaded ? "" : undefined}
      onLoad={(event) => {
        setLoaded(true);
        onLoad?.(event);
      }}
    />
  );
}
