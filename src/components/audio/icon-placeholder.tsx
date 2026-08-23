"use client";

import React from "react";
import * as IconoirIcons from "iconoir-react";
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
  PlayIcon: IconoirIcons.Play,
  PauseIcon: IconoirIcons.Pause,
  VolumeXIcon: IconoirIcons.SoundOff,
  VolumeOffIcon: IconoirIcons.SoundOff,
  VolumeIcon: IconoirIcons.SoundMin,
  VolumeMute02Icon: IconoirIcons.SoundMin,
  Volume1Icon: IconoirIcons.SoundLow,
  VolumeLowIcon: IconoirIcons.SoundLow,
  Volume2Icon: IconoirIcons.SoundHigh,
  VolumeHighIcon: IconoirIcons.SoundHigh,
  RewindIcon: IconoirIcons.Undo,
  BackwardIcon: IconoirIcons.Undo,
  FastForwardIcon: IconoirIcons.Redo,
  SkipForwardIcon: IconoirIcons.SkipNext,
  NextIcon: IconoirIcons.SkipNext,
  SkipBackIcon: IconoirIcons.SkipPrev,
  PreviousIcon: IconoirIcons.SkipPrev,
  RadioIcon: IconoirIcons.AntennaSignal,
  BroadcastIcon: IconoirIcons.AntennaSignal,
  MusicIcon: IconoirIcons.MusicNote,
  MusicNote01Icon: IconoirIcons.MusicNote,
  MusicNotesIcon: IconoirIcons.MusicDoubleNote,
  Cancel01Icon: IconoirIcons.X,
  XIcon: IconoirIcons.X,
  PlayListIcon: IconoirIcons.Playlist,
  ListMusicIcon: IconoirIcons.Playlist,
  QueueIcon: IconoirIcons.Playlist,
  RepeatIcon: IconoirIcons.Repeat,
  Repeat1Icon: IconoirIcons.RepeatOnce,
  RepeatOne01Icon: IconoirIcons.RepeatOnce,
  ShuffleIcon: IconoirIcons.Shuffle,
  Settings02Icon: IconoirIcons.ControlSlider,
  SlidersHorizontalIcon: IconoirIcons.ControlSlider,
  DotsVerticalIcon: IconoirIcons.MoreVert,
  DotsHorizontalIcon: IconoirIcons.MoreHoriz,
  PlusIcon: IconoirIcons.Plus,
  TrashIcon: IconoirIcons.Trash,
  CheckIcon: IconoirIcons.Check,
  SpeakerHighIcon: IconoirIcons.SoundHigh,
  SpeakerLowIcon: IconoirIcons.SoundLow,
  SpeakerNoneIcon: IconoirIcons.SoundMin,
  SpeakerSlashIcon: IconoirIcons.SoundOff,
  IconPlayerPlay: IconoirIcons.Play,
  IconPlayerPause: IconoirIcons.Pause,
  IconPlayerTrackPrev: IconoirIcons.SkipPrev,
  IconPlayerTrackNext: IconoirIcons.SkipNext,
  IconVolume: IconoirIcons.SoundHigh,
  IconVolumeOff: IconoirIcons.SoundOff,
  IconVolume2: IconoirIcons.SoundLow,
  IconVolume3: IconoirIcons.SoundMin,
};

export function IconPlaceholder({
  lucide,
  phosphor,
  hugeicons,
  className,
  ...props
}: IconPlaceholderProps) {
  const iconKey = lucide || phosphor || hugeicons || "";
  const IconComponent = iconMap[iconKey] || (IconoirIcons as any)[iconKey] || IconoirIcons.Circle;

  return <IconComponent className={cn("size-4 shrink-0", className)} {...(props as any)} />;
}
