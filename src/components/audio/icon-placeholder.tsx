"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { cn } from "~/lib/utils";

interface IconPlaceholderProps extends React.SVGProps<SVGSVGElement> {
  lucide?: string;
  phosphor?: string;
  hugeicons?: string;
  remixicon?: string;
  tabler?: string;
  className?: string;
}

// Map common audio-ui icon names to Lucide icons
const iconMap: Record<string, any> = {
  PlayIcon: LucideIcons.Play,
  PauseIcon: LucideIcons.Pause,
  VolumeXIcon: LucideIcons.VolumeX,
  VolumeOffIcon: LucideIcons.VolumeX,
  VolumeIcon: LucideIcons.Volume,
  VolumeMute02Icon: LucideIcons.Volume,
  Volume1Icon: LucideIcons.Volume1,
  VolumeLowIcon: LucideIcons.Volume1,
  Volume2Icon: LucideIcons.Volume2,
  VolumeHighIcon: LucideIcons.Volume2,
  RewindIcon: LucideIcons.RotateCcw,
  BackwardIcon: LucideIcons.RotateCcw,
  FastForwardIcon: LucideIcons.RotateCw,
  SkipForwardIcon: LucideIcons.SkipForward,
  NextIcon: LucideIcons.SkipForward,
  SkipBackIcon: LucideIcons.SkipBack,
  PreviousIcon: LucideIcons.SkipBack,
  RadioIcon: LucideIcons.Radio,
  BroadcastIcon: LucideIcons.Radio,
  MusicIcon: LucideIcons.Music,
  MusicNote01Icon: LucideIcons.Music,
  MusicNotesIcon: LucideIcons.Music,
  Cancel01Icon: LucideIcons.X,
  XIcon: LucideIcons.X,
  PlayListIcon: LucideIcons.ListMusic,
  ListMusicIcon: LucideIcons.ListMusic,
  QueueIcon: LucideIcons.ListMusic,
  RepeatIcon: LucideIcons.Repeat,
  Repeat1Icon: LucideIcons.Repeat1,
  RepeatOne01Icon: LucideIcons.Repeat1,
  ShuffleIcon: LucideIcons.Shuffle,
  Settings02Icon: LucideIcons.SlidersHorizontal,
  SlidersHorizontalIcon: LucideIcons.SlidersHorizontal,
  DotsVerticalIcon: LucideIcons.MoreVertical,
  DotsHorizontalIcon: LucideIcons.MoreHorizontal,
  PlusIcon: LucideIcons.Plus,
  TrashIcon: LucideIcons.Trash2,
  CheckIcon: LucideIcons.Check,
  SpeakerHighIcon: LucideIcons.Volume2,
  SpeakerLowIcon: LucideIcons.Volume1,
  SpeakerNoneIcon: LucideIcons.Volume,
  SpeakerSlashIcon: LucideIcons.VolumeX,
  IconPlayerPlay: LucideIcons.Play,
  IconPlayerPause: LucideIcons.Pause,
  IconPlayerTrackPrev: LucideIcons.SkipBack,
  IconPlayerTrackNext: LucideIcons.SkipForward,
  IconVolume: LucideIcons.Volume2,
  IconVolumeOff: LucideIcons.VolumeX,
  IconVolume2: LucideIcons.Volume1,
  IconVolume3: LucideIcons.Volume,
};

export function IconPlaceholder({
  lucide,
  phosphor,
  hugeicons,
  className,
  ...props
}: IconPlaceholderProps) {
  const iconKey = lucide || phosphor || hugeicons || "";
  const IconComponent = iconMap[iconKey] || (LucideIcons as any)[iconKey] || LucideIcons.Circle;

  return <IconComponent className={cn("size-4 shrink-0", className)} {...(props as any)} />;
}
