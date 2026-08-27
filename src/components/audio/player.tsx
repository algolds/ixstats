"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

export interface Track {
  id: string;
  title: string;
  artist?: string;
  artwork?: string;
  url: string;
  genre?: string;
}

const audioPlayerVariants = cva(
  "before:backdrop-blur-xl before:backdrop-saturate-150 before:-z-1 relative w-full before:pointer-events-none before:absolute before:inset-0 before:rounded-[inherit]",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "rounded-xl py-4",
        sm: "rounded-xl py-3",
      },
      variant: {
        default: "bg-card/70 ring-1 ring-foreground/10",
        ghost: "bg-transparent before:hidden hover:bg-transparent",
        widget: "bg-card/70 ring-1 ring-foreground/10",
      },
    },
  }
);

export type AudioPlayerProps = React.ComponentProps<"div"> &
  VariantProps<typeof audioPlayerVariants> & { tracks?: Track[] };

export function AudioPlayer({
  children,
  className,
  size,
  variant,
  ...props
}: AudioPlayerProps) {
  return (
    <div
      className={cn(audioPlayerVariants({ size, variant }), className)}
      data-size={size ?? "default"}
      data-slot="audio-player"
      data-variant={variant ?? "default"}
      role="presentation"
      {...props}
    >
      {children}
    </div>
  );
}

export interface AudioPlayerButtonProps extends React.ComponentProps<typeof Button> {
  tooltipLabel?: string;
}

export function AudioPlayerButton({
  tooltipLabel,
  className,
  ...props
}: AudioPlayerButtonProps) {
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
  "flex w-full min-w-0 items-center gap-4 in-data-[size=sm]:gap-3 in-data-[size=sm]:px-3 px-4 in-data-[size=sm]:in-data-[variant=widget]:pt-3 in-data-[variant=widget]:pt-4",
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

export type AudioPlayerControlBarProps = React.ComponentProps<"div"> &
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

export type AudioPlayerControlGroupProps = React.ComponentProps<"div">;

export const AudioPlayerControlGroup = ({
  className,
  ...props
}: AudioPlayerControlGroupProps) => (
  <div
    className={cn(
      "no-scrollbar scroll-fade-x -m-1 flex w-full snap-x snap-mandatory items-center gap-3 overflow-x-auto p-1 in-data-[size=sm]:gap-2 *:snap-start",
      className
    )}
    data-slot="audio-control-group"
    {...props}
  />
);

export { audioPlayerVariants };