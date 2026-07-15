"use client";

import React from "react";
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
  const { shield, charges, ordinaries } = computeLayout(composition);
  const clipId = `shield-clip-${composition.shield.shape}`;

  return (
    <svg
      id="vexel-shield-canvas"
      viewBox="0 0 1000 1000"
      width={width}
      height={height}
      className="overflow-visible select-none"
    >
      <defs>
        {/* Shield shape clip path */}
        <clipPath id={clipId}>
          <path d={renderShieldOutline(composition.shield.shape)} />
        </clipPath>

        {/* Drop shadow for shield depth */}
        <filter id="shield-shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000000" floodOpacity="0.45" />
        </filter>
      </defs>

      {/* Main Shield Group with Shadow */}
      <g filter="url(#shield-shadow)">
        {/* Clipped Shield Field & Elements */}
        <g clipPath={`url(#${clipId})`}>
          {/* Field Divisions */}
          <g onClick={() => onElementClick?.("shield.field")} className="cursor-pointer">
            {renderDivisionPaths(
              composition.shield.field.division,
              composition.shield.field.tinctures
            ).map((div, i) => {
              if (div.rect) {
                return (
                  <rect
                    key={i}
                    x={div.rect.x}
                    y={div.rect.y}
                    width={div.rect.width}
                    height={div.rect.height}
                    fill={div.color}
                  />
                );
              }
              return <path key={i} d={div.path} fill={div.color} />;
            })}
          </g>

          {/* Ordinaries */}
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
                  className="cursor-pointer transition-all duration-150 hover:brightness-105 active:brightness-95"
                />
              );
            })}
          </g>

          {/* Charges */}
          <g>
            {charges.map((layoutCharge, idx) => {
              // Find matching input charge ref
              let refChargeIndex = 0;
              let accumulatedCount = 0;
              for (let i = 0; i < (composition.shield.charges ?? []).length; i++) {
                accumulatedCount += composition.shield.charges![i]!.count;
                if (idx < accumulatedCount) {
                  refChargeIndex = i;
                  break;
                }
              }

              const chargeRef = composition.shield.charges?.[refChargeIndex];
              if (!chargeRef) return null;

              const color = getTinctureColor(chargeRef.tincture);
              const customSvg = customChargeSvgs[chargeRef.chargeId];

              // Render handler
              const handleChargeClick = (e: React.MouseEvent) => {
                e.stopPropagation();
                onElementClick?.(`shield.charges[${refChargeIndex}]`);
              };

              if (customSvg) {
                // Render custom SVG inline inside a nested viewport
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

              // Fallback to template shapes
              const dPath = CHARGE_PATHS[chargeRef.chargeId];

              if (dPath) {
                return (
                  <path
                    key={layoutCharge.id}
                    d={dPath}
                    fill={color}
                    onClick={handleChargeClick}
                    className="cursor-pointer hover:brightness-110"
                    transform={`translate(${layoutCharge.x}, ${layoutCharge.y}) scale(${layoutCharge.width / 100})`}
                  />
                );
              }

              // Double fallback: render a beautiful generic shield/star placeholder
              return (
                <path
                  key={layoutCharge.id}
                  d={CHARGE_PATHS.star}
                  fill={color}
                  opacity={0.85}
                  onClick={handleChargeClick}
                  className="cursor-pointer hover:brightness-110"
                  transform={`translate(${layoutCharge.x}, ${layoutCharge.y}) scale(${layoutCharge.width / 100})`}
                />
              );
            })}
          </g>
        </g>

        {/* Shield Outline Overlay (frame stroke) */}
        <path
          d={renderShieldOutline(composition.shield.shape)}
          fill="none"
          stroke="#1e1b4b"
          strokeWidth="14"
          className="pointer-events-none"
        />
        <path
          d={renderShieldOutline(composition.shield.shape)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="6"
          className="pointer-events-none"
        />
      </g>
    </svg>
  );
}
