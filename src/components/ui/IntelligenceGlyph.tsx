import React from "react";
import { cn } from "~/lib/utils";
import {
  RiShieldLine,
  RiEyeLine,
  RiLockLine,
  RiGlobalLine,
  RiFileTextLine,
  RiBarChartLine,
  RiShakeHandsLine,
  RiTeamLine,
  RiBuildingLine,
  RiFlagLine,
  RiNotification3Line,
  RiChat3Line,
  RiUserAddLine,
  RiStarLine,
  RiArrowRightLine,
  RiExternalLinkLine,
  RiRefreshLine,
  RiSearchLine,
  RiScanLine,
  RiWifiLine,
  RiSettings3Line,
  RiMoneyDollarCircleLine,
  RiSubtractLine,
  RiArrowUpLine,
  RiArrowDownLine,
  RiMapLine,
  RiInformationLine,
  RiMapPinLine
} from "react-icons/ri";

// Intelligence Glyph System
export const INTELLIGENCE_GLYPHS = {
  economic: RiBarChartLine,
  diplomatic: RiShakeHandsLine,
  security: RiShieldLine,
  surveillance: RiScanLine,
  intelligence: RiSearchLine,
  communications: RiWifiLine,
  analysis: RiSettings3Line,
  team: RiTeamLine,
  star: RiStarLine,
  money: RiMoneyDollarCircleLine,
  notification: RiNotification3Line,
  chat: RiChat3Line,
  userAdd: RiUserAddLine,
  mapPin: RiMapPinLine,
  externalLink: RiExternalLinkLine,
  refresh: RiRefreshLine,
  fileText: RiFileTextLine,
  global: RiGlobalLine,
  building: RiBuildingLine,
  flag: RiFlagLine,
  arrowUp: RiArrowUpLine,
  arrowDown: RiArrowDownLine,
  subtract: RiSubtractLine,
  map: RiMapLine,
  info: RiInformationLine,
} as const;

interface IntelligenceGlyphProps {
  type: keyof typeof INTELLIGENCE_GLYPHS;
  size?: number;
  className?: string;
}

export const IntelligenceGlyph: React.FC<IntelligenceGlyphProps> = ({ type, size = 5, className }) => {
  const Icon = INTELLIGENCE_GLYPHS[type];
  return <Icon className={cn(`h-${size} w-${size} text-[--intel-gold]`, className)} />;
};
