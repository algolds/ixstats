export type MediaType =
  "MUSIC" | "SPEECH" | "LANGUAGE" | "RADIO" | "PODCAST" | "NARRATION" | "AMBIENT";

export interface Chapter {
  title: string;
  startTime: number;
  endTime: number;
}

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
  words?: { word: string; start: number; end: number }[];
}

export interface Media {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  type: MediaType;
  audioUrl: string;
  duration: number;
  coverArt?: string;
  peaks?: number[];
  chapters?: Chapter[];
  transcript?: TranscriptSegment[];
  isDynamicTts?: boolean;
  voice?: string;
  speed?: number;
}
