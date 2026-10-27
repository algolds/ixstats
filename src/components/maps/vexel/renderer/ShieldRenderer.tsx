"use client";

import type { MouseEvent } from "react";
import type { HeraldryComposition } from "~/lib/heraldry";
import {
  buildShieldScene,
  SHIELD_SHADOW,
  SHIELD_STROKES,
  SHIELD_VIEWBOX,
} from "~/lib/heraldry/shield-scene";

interface ShieldRendererProps {
  composition: HeraldryComposition;
  width?: number | string;
  height?: number | string;
  onElementClick?: (path: string) => void;
  // Optional pre-loaded custom charge SVGs (mapping chargeId -> clean SVG content)
  customChargeSvgs?: Record<string, string>;
}

/**
 * The live shield. Draws the same scene the server rasterizes into the stored coat-of-arms image
 * (see serializeShieldSvg), plus click targets for the editor.
 */
export default function ShieldRenderer({
  composition,
  width = "100%",
  height = "100%",
  onElementClick,
  customChargeSvgs = {},
}: ShieldRendererProps) {
  const scene = buildShieldScene(composition, customChargeSvgs);
  const { clipId, outline } = scene;

  return (
    <svg
      id="vexel-shield-canvas"
      viewBox={SHIELD_VIEWBOX}
      width={width}
      height={height}
      className="overflow-visible select-none"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={outline} />
        </clipPath>

        <filter id="shield-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow
            dx={SHIELD_SHADOW.dx}
            dy={SHIELD_SHADOW.dy}
            stdDeviation={SHIELD_SHADOW.stdDeviation}
            floodColor={SHIELD_SHADOW.floodColor}
            floodOpacity={SHIELD_SHADOW.floodOpacity}
          />
        </filter>
      </defs>

      <g filter="url(#shield-shadow)">
        <g clipPath={`url(#${clipId})`}>
          <g onClick={() => onElementClick?.("shield.field")} className="cursor-pointer">
            {scene.field.map((piece, i) =>
              piece.rect ? (
                <rect key={i} {...piece.rect} fill={piece.color} />
              ) : (
                <path key={i} d={piece.path} fill={piece.color} />
              )
            )}
          </g>

          <g>
            {scene.ordinaries.map((ord) => (
              <path
                key={ord.index}
                d={ord.d}
                fill={ord.fill}
                onClick={(e) => {
                  e.stopPropagation();
                  onElementClick?.(`shield.ordinaries[${ord.index}]`);
                }}
                className="cursor-pointer transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 hover:brightness-105 active:brightness-95"
              />
            ))}
          </g>

          <g>
            {scene.charges.map((charge) => {
              const handleChargeClick = (e: MouseEvent) => {
                e.stopPropagation();
                onElementClick?.(`shield.charges[${charge.refIndex}]`);
              };

              if (charge.kind === "custom") {
                // Custom SVG (sanitized in buildShieldScene) inside a nested viewport
                return (
                  <svg
                    key={charge.key}
                    x={charge.x}
                    y={charge.y}
                    width={charge.width}
                    height={charge.height}
                    viewBox="0 0 100 100"
                    onClick={handleChargeClick}
                    className="cursor-pointer hover:brightness-110"
                    dangerouslySetInnerHTML={{ __html: charge.markup }}
                  />
                );
              }

              // Template shape, or a star placeholder for unknown charges
              return (
                <path
                  key={charge.key}
                  d={charge.d}
                  fill={charge.fill}
                  opacity={charge.placeholder ? 0.85 : undefined}
                  onClick={handleChargeClick}
                  className="cursor-pointer hover:brightness-110"
                  transform={charge.transform}
                />
              );
            })}
          </g>
        </g>

        {SHIELD_STROKES.map((stroke) => (
          <path
            key={stroke.color}
            d={outline}
            fill="none"
            stroke={stroke.color}
            strokeWidth={stroke.width}
            className="pointer-events-none"
          />
        ))}
      </g>
    </svg>
  );
}
