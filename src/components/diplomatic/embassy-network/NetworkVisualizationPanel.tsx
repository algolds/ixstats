/**
 * @file NetworkVisualizationPanel.tsx
 * @description A standalone React component to display a diplomatic network visualization graph.
 * This component is optimized using React.memo.
 */

import React from 'react';
import { cn } from '~/lib/utils';
import type { DiplomaticRelation, NetworkPosition, PrimaryCountry, RelationType } from '~/types/diplomatic-network';

/**
 * Configuration for styling different relation types.
 * This object maps each relation type to its corresponding display properties.
 */
const RELATION_TYPES: Record<RelationType, { color: string; bgColor: string; borderColor: string; label: string }> = {
  alliance: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    label: 'Alliance',
  },
  trade: {
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    label: 'Trade Partner',
  },
  neutral: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/40',
    label: 'Neutral',
  },
  tension: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40',
    label: 'Tension',
  }
};

/**
 * Props for the NetworkVisualizationPanel component.
 */
interface NetworkVisualizationPanelProps {
  /** The central country for the network visualization. */
  primaryCountry: PrimaryCountry;
  /** An array of objects containing relation data and their calculated positions. */
  networkPositions: NetworkPosition[];
  /** The currently selected relation, to be highlighted in the visualization. */
  selectedRelation: DiplomaticRelation | null;
  /** Callback function to handle clicks on a relation node. */
  onRelationClick: (relation: DiplomaticRelation) => void;
}

/**
 * A component that renders an SVG-based visualization of a diplomatic network.
 * It displays a central country and its connections to other countries, styled
 * according to the nature of their relationship. Includes a legend for clarity.
 */
const NetworkVisualizationPanelComponent: React.FC<NetworkVisualizationPanelProps> = ({
  primaryCountry,
  networkPositions,
  selectedRelation,
  onRelationClick,
}) => {
  return (
    <div className="relative w-full h-[400px] overflow-hidden">
      <svg
        width="400"
        height="400"
        className="w-full h-full"
        viewBox="0 0 400 400"
      >
        {/* Connection Lines */}
        {networkPositions.map(({ relation, x, y }) => (
          <line
            key={`line-${relation.id}`}
            x1="200"
            y1="200"
            x2={isNaN(x) ? 200 : x}
            y2={isNaN(y) ? 200 : y}
            stroke={`rgba(212, 175, 55, ${0.2 + ((relation.strength || 0) / 100) * 0.3})`}
            strokeWidth={1 + ((relation.strength || 0) / 100) * 2}
            strokeDasharray={relation.relationType === 'tension' ? '5,5' : 'none'}
            className="transition-all duration-300"
          />
        ))}

        {/* Central Country Node */}
        <g>
          <circle
            cx="200"
            cy="200"
            r="30"
            fill="rgba(212, 175, 55, 0.3)"
            stroke="rgba(212, 175, 55, 0.8)"
            strokeWidth="2"
          />
          <text
            x="200"
            y="205"
            textAnchor="middle"
            fontSize="12"
            fill="white"
            className="font-semibold pointer-events-none"
          >
            {primaryCountry.name.length > 10
              ? primaryCountry.name.substring(0, 8) + '...'
              : primaryCountry.name}
          </text>
        </g>

        {/* Relation Nodes */}
        {networkPositions.map(({ relation, x, y }) => {
          const typeConfig = RELATION_TYPES[relation.relationType];
          const isSelected = selectedRelation?.id === relation.id;

          return (
            <g
              key={relation.id}
              onClick={() => onRelationClick(relation)}
              className="cursor-pointer"
            >
              <circle
                cx={isNaN(x) ? 200 : x}
                cy={isNaN(y) ? 200 : y}
                r={isSelected ? 25 : 15 + ((relation.strength || 0) / 100) * 5}
                fill={typeConfig.bgColor.replace('bg-', 'rgba(').replace('/20', ', 0.2)')}
                stroke={typeConfig.color.replace('text-', 'rgba(').replace('400', '400, 1)')}
                strokeWidth={isSelected ? 3 : 2}
                className="transition-all duration-300 hover:opacity-80"
              />
              <text
                x={isNaN(x) ? 200 : x}
                y={(isNaN(y) ? 200 : y) + 4}
                textAnchor="middle"
                fontSize={isSelected ? "11" : "9"}
                fill="white"
                className="font-medium pointer-events-none"
              >
                {relation.countryName.length > 8
                  ? relation.countryName.substring(0, 6) + '..'
                  : relation.countryName}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Network Legend */}
      <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg p-3">
        <h4 className="text-foreground text-sm font-semibold mb-2">Relations</h4>
        <div className="space-y-1">
          {(Object.keys(RELATION_TYPES) as Array<RelationType>).map((type) => {
            const config = RELATION_TYPES[type];
            return (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div className={cn("w-3 h-3 rounded-full", config.bgColor, config.borderColor, "border")} />
                <span className="text-foreground">{config.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const NetworkVisualizationPanel = React.memo(NetworkVisualizationPanelComponent);
