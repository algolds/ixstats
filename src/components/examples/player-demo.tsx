import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
} from "~/components/audio/player";

export function AudioDemoPlayer() {
  return (
    <AudioPlayer>
      <AudioPlayerControlBar>
        <AudioPlayerPlay />
        <AudioPlayerSeekBar />
        <AudioPlayerTimeDisplay />
        <AudioPlayerVolume />
      </AudioPlayerControlBar>
    </AudioPlayer>
  );
}