"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

interface Track {
  id: string;
  title: string;
  artist?: string;
  artwork?: string;
  url: string;
  genre?: string;
}

const audioPlayerVariants = cva("relative w-full", {
  defaultVariants: {
    size: "default",
  },
  variants: {
    size: {
      default: "rounded-xl py-4",
      sm: "rounded-xl py-3",
    },
  },
});

type AudioPlayerProps = React.ComponentProps<"div"> &
  VariantProps<typeof audioPlayerVariants> & { tracks?: Track[] };

export function AudioPlayer({ children, className, size, ...props }: AudioPlayerProps) {
  return (
    <div
      className={cn(audioPlayerVariants({ size }), className)}
      data-size={size ?? "default"}
      data-slot="audio-player"
      role="presentation"
      {...props}
    >
      {children}
    </div>
  );
}

interface AudioPlayerButtonProps extends React.ComponentProps<typeof Button> {
  tooltipLabel?: string;
}

export function AudioPlayerButton({ tooltipLabel, className, ...props }: AudioPlayerButtonProps) {
  const button = (
    <Button
      aria-label={props["aria-label"] ?? tooltipLabel}
      className={cn("[&_svg]:text-primary", className)}
      data-slot="audio-player-button"
      {...props}
    />
  );

  if (tooltipLabel) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent sideOffset={4}>{tooltipLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return button;
}

const audioControlBarVariants = cva(
  "flex w-full min-w-0 items-center gap-4 in-data-[size=sm]:gap-3 in-data-[size=sm]:px-3 px-4",
  {
    defaultVariants: {
      variant: "compact",
    },
    variants: {
      variant: {
        compact: "flex-row",
        stacked: "flex-col",
      },
    },
  }
);

type AudioPlayerControlBarProps = React.ComponentProps<"div"> &
  VariantProps<typeof audioControlBarVariants>;

export const AudioPlayerControlBar = ({
  className,
  variant,
  ...props
}: AudioPlayerControlBarProps) => (
  <div
    className={cn(audioControlBarVariants({ variant }), className)}
    data-slot="audio-control-bar"
    data-variant={variant}
    {...props}
  />
);
