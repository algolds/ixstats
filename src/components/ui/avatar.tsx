"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { assetUrl } from "~/lib/base-path";
import { cn } from "~/lib/utils/cn";

function Avatar({ className, ...props }: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn("relative flex size-8 shrink-0 overflow-hidden rounded-full", className)}
      {...props}
    />
  );
}

/** Resolves its `src` with `assetUrl`, so an uploaded picture (`/images/uploads/…`) carries the base path. */
function AvatarImage({
  className,
  src,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      src={typeof src === "string" ? (assetUrl(src) ?? undefined) : src}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn("bg-fill-3 flex size-full items-center justify-center rounded-full", className)}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
