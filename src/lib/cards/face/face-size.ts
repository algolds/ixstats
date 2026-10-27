import type { CardFaceSize } from "./types";

/**
 * Face widths per size; the 5:7 ratio sets the height. A grid passes `className="w-full"` to fill its cell. A plain
 * module, not CardFace's, so server components can size a face-down card or a card back too.
 */
export const CARD_FACE_WIDTH: Readonly<Record<CardFaceSize, string>> = {
  S: "w-32",
  M: "w-48",
  L: "w-72",
};
