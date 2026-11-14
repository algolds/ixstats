import {
  Basketball,
  BoxingGlove,
  Car,
  FootballBall,
  SoccerBall,
  TennisBall,
  Trophy,
} from "iconoir-react";
import type { ComponentProps } from "react";

const GLYPHS: Record<string, typeof Trophy> = {
  soccer: SoccerBall,
  football: FootballBall,
  basketball: Basketball,
  baseball: TennisBall,
  f1: Car,
  boxing: BoxingGlove,
};

/** The line icon for a sport. Sports without a drawn icon (ice hockey) show the trophy. */
export function SportGlyph({
  sportPreset,
  ...props
}: { sportPreset?: string | null } & ComponentProps<typeof Trophy>) {
  const Icon = GLYPHS[sportPreset ?? ""] ?? Trophy;
  return <Icon aria-hidden {...props} />;
}
