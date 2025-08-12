"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { 
  RiShakeHandsLine,
  RiGlobalLine,
  RiEyeLine,
  RiShieldLine,
  RiSearchLine,
  RiFilterLine,
  RiCloseLine,
  RiArrowRightLine,
  RiInformationLine,
  RiMapPinLine,
  RiBuildingLine,
  RiCalendarLine
} from "react-icons/ri";

interface DiplomaticRelation {
  id: string;
  countryId: string;
  countryName: string;
  relationType: 'alliance' | 'trade' | 'neutral' | 'tension';
  strength: number;
  recentActivity?: string;
  establishedAt: string;
  flagUrl?: string;
  economicTier?: string;
}

interface EmbassyNetworkVisualizationProps {
  primaryCountry: {
    id: string;
    name: string;
    flagUrl?: string;
    economicTier?: string;
  };
  diplomaticRelations: DiplomaticRelation[];
  onRelationClick?: (relation: DiplomaticRelation) => void;
  onEstablishEmbassy?: (targetCountryId: string) => void;
  viewerClearanceLevel?: 'PUBLIC' | 'RESTRICTED' | 'CONFIDENTIAL';
}

// Relation type configurations
const RELATION_TYPES = {
  alliance: {
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500/40',
    icon: RiShakeHandsLine,
    label: 'Alliance',
    priority: 4
  },
  trade: {
    color: 'text-blue-400', 
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/40',
    icon: RiGlobalLine,
    label: 'Trade Partner',
    priority: 3
  },
  neutral: {
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20', 
    borderColor: 'border-gray-500/40',
    icon: RiEyeLine,
    label: 'Neutral',
    priority: 2
  },
  tension: {
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500/40', 
    icon: RiShieldLine,
    label: 'Tension',
    priority: 1
  }
} as const;

const EmbassyNetworkVisualizationComponent: React.FC<EmbassyNetworkVisualizationProps> = ({
  primaryCountry,
  diplomaticRelations,
  onRelationClick,
  onEstablishEmbassy,
  viewerClearanceLevel = 'PUBLIC'
}) => {
  const [selectedRelation, setSelectedRelation] = useState<DiplomaticRelation | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'network' | 'list'>('network');
  const networkContainerRef = useRef<HTMLDivElement>(null);

  // Filter and sort relations
  const filteredRelations = useMemo(() => {
    let filtered = diplomaticRelations;

    // Apply type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(relation => relation.relationType === filterType);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(relation => 
        relation.countryName.toLowerCase().includes(query) ||
        relation.relationType.toLowerCase().includes(query)
      );
    }

    // Sort by priority and strength
    return filtered.sort((a, b) => {
      const aPriority = RELATION_TYPES[a.relationType]?.priority || 0;
      const bPriority = RELATION_TYPES[b.relationType]?.priority || 0;
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return b.strength - a.strength; // Higher strength first
    });
  }, [diplomaticRelations, filterType, searchQuery]);

  // Calculate network positions for visualization
  const networkPositions = useMemo(() => {
    const positions: Array<{ relation: DiplomaticRelation; x: number; y: number; angle: number }> = [];
    const centerX = 200;
    const centerY = 200;
    const baseRadius = 120;
    
    filteredRelations.forEach((relation, index) => {
      // Calculate position based on relation type and strength
      const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
      const radius = baseRadius + ((relation.strength || 0) / 100) * 40; // Stronger relations further out
      const angleStep = filteredRelations.length > 0 ? (Math.PI * 2) / filteredRelations.length : 0;
      const angle = angleStep * index - Math.PI / 2; // Start from top
      
      // Add some variation based on relation type
      const typeOffset = (typeConfig?.priority || 0) * 10;
      const finalRadius = radius + (Math.sin(angle * 3) * typeOffset);
      
      // Ensure coordinates are valid numbers
      const x = isFinite(finalRadius) && isFinite(angle) 
        ? centerX + Math.cos(angle) * finalRadius 
        : centerX;
      const y = isFinite(finalRadius) && isFinite(angle) 
        ? centerY + Math.sin(angle) * finalRadius 
        : centerY;
      
      positions.push({ relation, x, y, angle });
    });
    
    return positions;
  }, [filteredRelations]);

  const handleRelationClick = useCallback((relation: DiplomaticRelation) => {
    setSelectedRelation(relation);
    onRelationClick?.(relation);
  }, [onRelationClick]);

  return (
    <div className="embassy-network-visualization space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
            <RiBuildingLine className="h-6 w-6" />
            Embassy Network
            <span className="text-sm font-normal text-[--intel-silver] ml-2">
              ({filteredRelations.length} active relations)
            </span>
          </h3>
          <p className="text-[--intel-silver] text-sm mt-1">
            Interactive diplomatic relationship visualization for {primaryCountry.name}
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode('network')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'network' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-white"
              )}
            >
              Network
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                viewMode === 'list' 
                  ? "bg-[--intel-gold]/20 text-[--intel-gold]" 
                  : "text-[--intel-silver] hover:text-white"
              )}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-[--intel-gold]/20">
        <div className="flex-1 relative">
          <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--intel-silver]" />
          <input
            type="text"
            placeholder="Search diplomatic relations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-[--intel-silver] focus:outline-none focus:border-[--intel-gold]/50"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
          >
            <option value="all">All Relations</option>
            <option value="alliance">Alliances</option>
            <option value="trade">Trade Partners</option>
            <option value="neutral">Neutral</option>
            <option value="tension">Tensions</option>
          </select>
        </div>
      </div>

      {/* Main Visualization Area */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Network/List View */}
        <div className="xl:col-span-2">
          <div className="glass-hierarchy-child rounded-lg p-6" style={{ minHeight: '500px' }}>
            {viewMode === 'network' ? (
              /* Network Visualization */
              <div className="relative w-full h-[400px] overflow-hidden">
                <svg
                  ref={networkContainerRef}
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
                  <circle
                    cx="200"
                    cy="200"
                    r="30"
                    fill="rgba(212, 175, 55, 0.3)"
                    stroke="rgba(212, 175, 55, 0.8)"
                    strokeWidth="2"
                    className="cursor-pointer"
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
                  
                  {/* Relation Nodes */}
                  {networkPositions.map(({ relation, x, y }) => {
                    const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                    const isSelected = selectedRelation?.id === relation.id;
                    
                    return (
                      <g key={relation.id}>
                        <circle
                          cx={isNaN(x) ? 200 : x}
                          cy={isNaN(y) ? 200 : y}
                          r={isSelected ? 25 : 15 + ((relation.strength || 0) / 100) * 5}
                          fill={(typeConfig.bgColor || 'bg-white/20').replace('bg-', 'rgba(').replace('/20', ', 0.2)')}
                          stroke={(typeConfig.color || 'text-white').replace('text-', 'rgba(').replace('400', '400, 1)')}
                          strokeWidth={isSelected ? 3 : 2}
                          className="cursor-pointer transition-all duration-300 hover:opacity-80"
                          onClick={() => handleRelationClick(relation)}
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
                  <h4 className="text-white text-sm font-semibold mb-2">Relations</h4>
                  <div className="space-y-1">
                    {Object.entries(RELATION_TYPES).map(([type, config]) => (
                      <div key={type} className="flex items-center gap-2 text-xs">
                        <div className={cn("w-3 h-3 rounded-full", config.bgColor, config.borderColor, "border")} />
                        <span className="text-white">{config.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              /* List View */
              <div className="space-y-3">
                {filteredRelations.map((relation, index) => {
                  const typeConfig = RELATION_TYPES[relation.relationType] || { priority: 0 };
                  const Icon = typeConfig.icon || RiGlobalLine;
                  
                  return (
                    <motion.div
                      key={relation.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleRelationClick(relation)}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer",
                        "bg-white/5 hover:bg-white/10 border-white/10 hover:border-[--intel-gold]/30",
                        selectedRelation?.id === relation.id && "border-[--intel-gold]/50 bg-[--intel-gold]/10"
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          typeConfig.bgColor || "bg-white/20", typeConfig.borderColor || "border-white/20", "border"
                        )}>
                          <Icon className={cn("h-5 w-5", typeConfig.color || "text-white")} />
                        </div>
                        
                        <div>
                          <div className="font-semibold text-white">{relation.countryName}</div>
                          <div className="flex items-center gap-3 text-sm text-[--intel-silver]">
                            <span className={cn("capitalize", typeConfig.color || "text-white")}>
                              {typeConfig.label || relation.relationType}
                            </span>
                            <span>•</span>
                            <span>Strength: {relation.strength || 0}%</span>
                            {relation.economicTier && (
                              <>
                                <span>•</span>
                                <span>{relation.economicTier}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[--intel-silver] text-sm">
                          Est. {new Date(relation.establishedAt).getFullYear()}
                        </div>
                        {relation.recentActivity && (
                          <div className="text-[--intel-amber] text-xs mt-1">
                            Recent Activity
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
                
                {filteredRelations.length === 0 && (
                  <div className="text-center py-12 text-[--intel-silver]">
                    <RiSearchLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No diplomatic relations found</p>
                    <p className="text-sm">Try adjusting your search or filter criteria</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Relation Details Panel */}
        <div className="xl:col-span-1">
          <div className="glass-hierarchy-child rounded-lg p-6 sticky top-6">
            {selectedRelation ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg font-bold text-white">Diplomatic Relation</h4>
                  <button
                    onClick={() => setSelectedRelation(null)}
                    className="p-2 text-[--intel-silver] hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </button>
                </div>

                {/* Country Info */}
                <div className="flex items-center gap-4">
                  {selectedRelation.flagUrl && (
                    <img
                      src={selectedRelation.flagUrl}
                      alt={`${selectedRelation.countryName} flag`}
                      className="w-12 h-8 object-cover rounded border border-white/20"
                    />
                  )}
                  <div>
                    <h5 className="text-xl font-bold text-white">{selectedRelation.countryName}</h5>
                    {selectedRelation.economicTier && (
                      <p className="text-[--intel-silver] text-sm">{selectedRelation.economicTier}</p>
                    )}
                  </div>
                </div>

                {/* Relation Details */}
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      {React.createElement(RELATION_TYPES[selectedRelation.relationType]?.icon || RiGlobalLine, {
                        className: cn("h-5 w-5", RELATION_TYPES[selectedRelation.relationType]?.color || "text-white")
                      })}
                      <span className="font-medium text-white">
                        {RELATION_TYPES[selectedRelation.relationType]?.label || selectedRelation.relationType}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div
                          className={cn("h-full rounded-full transition-all duration-300", 
                            RELATION_TYPES[selectedRelation.relationType]?.bgColor || "bg-white/20"
                          )}
                          style={{ width: `${selectedRelation.strength}%` }}
                        />
                      </div>
                      <span className="text-sm text-[--intel-silver] min-w-[3rem]">
                        {selectedRelation.strength}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-[--intel-silver]">
                    <RiCalendarLine className="h-4 w-4" />
                    <span>Established: {new Date(selectedRelation.establishedAt).toLocaleDateString()}</span>
                  </div>

                  {selectedRelation.recentActivity && (
                    <div className="p-3 bg-[--intel-amber]/10 rounded-lg border border-[--intel-amber]/20">
                      <div className="flex items-start gap-2">
                        <RiInformationLine className="h-4 w-4 text-[--intel-amber] mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[--intel-amber] text-sm font-medium">Recent Activity</p>
                          <p className="text-white text-sm mt-1">{selectedRelation.recentActivity}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-4 border-t border-white/10">
                  <button
                    onClick={() => onRelationClick?.(selectedRelation)}
                    className="w-full flex items-center justify-center gap-2 bg-[--intel-gold]/20 hover:bg-[--intel-gold]/30 text-[--intel-gold] px-4 py-3 rounded-lg font-medium transition-colors"
                  >
                    <RiArrowRightLine className="h-4 w-4" />
                    View Country Profile
                  </button>
                  
                  {viewerClearanceLevel !== 'PUBLIC' && (
                    <button className="w-full flex items-center justify-center gap-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 px-4 py-3 rounded-lg font-medium transition-colors">
                      <RiMapPinLine className="h-4 w-4" />
                      View Embassy Details
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-[--intel-silver]">
                <RiBuildingLine className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a diplomatic relation</p>
                <p className="text-sm">Click on a country node or list item to view detailed information</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

EmbassyNetworkVisualizationComponent.displayName = 'EmbassyNetworkVisualization';

export const EmbassyNetworkVisualization = React.memo(EmbassyNetworkVisualizationComponent);