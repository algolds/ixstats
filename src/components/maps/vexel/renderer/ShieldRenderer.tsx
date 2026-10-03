"use client";

import type { MouseEvent } from "react";
import type { HeraldryComposition } from "~/lib/heraldry";
import { computeLayout } from "~/lib/heraldry";
import {
  renderShieldOutline,
  renderDivisionPaths,
  renderOrdinaryPath,
  getTinctureColor,
} from "./svg-utils";
import { CHARGE_PATHS } from "./charge-paths";

interface ShieldRendererProps {
  composition: HeraldryComposition;
  width?: number | string;
  height?: number | string;
  onElementClick?: (path: string) => void;
  // Optional pre-loaded custom charge SVGs (mapping chargeId -> clean SVG content)
  customChargeSvgs?: Record<string, string>;
}

export default function ShieldRenderer({
  composition,
  width = "100%",
  height = "100%",
  onElementClick,
  customChargeSvgs = {},
}: ShieldRendererProps) {
  const { charges } = computeLayout(composition);
  const clipId = `shield-clip-${composition.shield.shape}`;
  const outline = renderShieldOutline(composition.shield.shape);
  // Which charge ref each laid-out charge instance belongs to (a ref expands to `count` instances).
  const chargeRefs = composition.shield.charges ?? [];
  const chargeOwner = chargeRefs.flatMap((ref, i) => Array.from({ length: ref.count }, () => i));

  return (
    <svg
      id="vexel-shield-canvas"
      viewBox="0 0 1000 1000"
      width={width}
      height={height}
      className="overflow-visible select-none"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>

        <filter id="shield-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter="url(#shield-shadow)">
        <g clipPath={`url(#${clipId})`}>
          <g onClick={() => onElementClick?.("shield.field")} className="cursor-pointer">
            {renderDivisionPaths(
              composition.shield.field.division,
              composition.shield.field.tinctures
            ).map((div, i) =>
              div.rect ? (
                <rect key={i} {...div.rect} fill={div.color} />
              ) : (
                <path key={i} d={div.path} fill={div.color} />
              )
            )}
          </g>

          <g>
            {(composition.shield.ordinaries ?? []).map((ord, i) => {
              const pathStr = renderOrdinaryPath(ord.type);
              if (!pathStr) return null;

              return (
                <path
                  key={i}
                  d={pathStr}
                  fill={getTinctureColor(ord.tincture)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onElementClick?.(`shield.ordinaries[${i}]`);
                  }}
                  className="cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:brightness-105 active:brightness-95"
                />
              );
            })}
          </g>

          <g>
            {charges.map((layoutCharge, idx) => {
              const refChargeIndex = chargeOwner[idx] ?? 0;
              const chargeRef = chargeRefs[refChargeIndex];
              if (!chargeRef) return null;

              const color = getTinctureColor(chargeRef.tincture);
              const customSvg = customChargeSvgs[chargeRef.chargeId];
              const handleChargeClick = (e: MouseEvent) => {
                e.stopPropagation();
                onElementClick?.(`shield.charges[${refChargeIndex}]`);
              };

              if (customSvg) {
                // Custom SVG rendered inline inside a nested viewport
                return (
                  <svg
                    key={layoutCharge.id}
                    x={layoutCharge.x - layoutCharge.width / 2}
                    y={layoutCharge.y - layoutCharge.height / 2}
                    width={layoutCharge.width}
                    height={layoutCharge.height}
                    viewBox="0 0 100 100"
                    onClick={handleChargeClick}
                    className="cursor-pointer hover:brightness-110"
                    dangerouslySetInnerHTML={{
                      __html: customSvg.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, ""),
                    }}
                  />
                );
              }

              // Template shape, or a star placeholder for unknown charges
              const template = CHARGE_PATHS[chargeRef.chargeId];
              return (
                <path
                  key={layoutCharge.id}
                  d={template ?? CHARGE_PATHS.star}
                  fill={color}
                  opacity={template ? undefined : 0.85}
                  onClick={handleChargeClick}
                  className="cursor-pointer hover:brightness-110"
                  transform={`translate(${layoutCharge.x}, ${layoutCharge.y}) scale(${layoutCharge.width / 100})`}
                />
              );
            })}
          </g>
        </g>

        <path
          d={outline}
          fill="none"
          stroke="#1e1b4b"
          strokeWidth="14"
          className="pointer-events-none"
        />
        <path
          d={outline}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="6"
          className="pointer-events-none"
        />
      </g>
    </svg>
  );
}
