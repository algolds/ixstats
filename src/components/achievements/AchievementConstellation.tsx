"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { ReactElement } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { ConstellationBuilder } from "~/lib/constellation-builder";
import {
  RiStarLine,
  RiSearchLine,
  RiFilterLine,
  RiZoomInLine,
  RiZoomOutLine,
  RiRefreshLine,
  RiEyeLine,
  RiEyeOffLine,
  RiSettings3Line
} from "react-icons/ri";
import type {
  AchievementConstellation,
  DiplomaticAchievement,
  ConstellationLayout,
  AchievementCategory,
  AchievementTier,
  ConstellationTheme
} from "~/types/achievement-constellation";
import {
  ACHIEVEMENT_TIER_CONFIG,
  ACHIEVEMENT_CATEGORY_CONFIG,
  calculatePrestigeScore,
  getAchievementsByCategory,
  getUnlockedAchievements
} from "~/types/achievement-constellation";

interface AchievementConstellationProps {
  constellation: AchievementConstellation;
  onAchievementClick?: (achievement: DiplomaticAchievement) => void;
  onAchievementHover?: (achievement: DiplomaticAchievement | null) => void;
  viewMode?: 'full' | 'compact';
  interactive?: boolean;
  showConnections?: boolean;
  theme?: ConstellationTheme;
  className?: string;
}

interface ConstellationControls {
  zoom: number;
  panX: number;
  panY: number;
  showHidden: boolean;
  filterCategory?: AchievementCategory;
  filterTier?: AchievementTier;
  searchTerm: string;
}

const AchievementConstellationComponent: React.FC<AchievementConstellationProps> = ({
  constellation,
  onAchievementClick,
  onAchievementHover,
  viewMode = 'full',
  interactive = true,
  showConnections = true,
  theme = 'classic_gold',
  className
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredAchievement, setHoveredAchievement] = useState<DiplomaticAchievement | null>(null);
  const [controls, setControls] = useState<ConstellationControls>({
    zoom: 1,
    panX: 0,
    panY: 0,
    showHidden: false,
    searchTerm: ''
  });

  // Build constellation layout
  const constellationBuilder = useMemo(() => new ConstellationBuilder(800, 600), []);
  const layout = useMemo(() => {
    return constellationBuilder.buildConstellation(constellation.achievements, theme);
  }, [constellation.achievements, theme, constellationBuilder]);

  // Filter achievements based on controls
  const filteredAchievements = useMemo(() => {
    let filtered = [...constellation.achievements];

    // Filter by search term
    if (controls.searchTerm) {
      const term = controls.searchTerm.toLowerCase();
      filtered = filtered.filter(achievement => 
        achievement.title.toLowerCase().includes(term) ||
        achievement.description.toLowerCase().includes(term)
      );
    }

    // Filter by category
    if (controls.filterCategory) {
      filtered = filtered.filter(achievement => achievement.category === controls.filterCategory);
    }

    // Filter by tier
    if (controls.filterTier) {
      filtered = filtered.filter(achievement => achievement.tier === controls.filterTier);
    }

    // Filter hidden achievements
    if (!controls.showHidden) {
      filtered = filtered.filter(achievement => !achievement.hidden || achievement.achievedAt);
    }

    // Deduplicate achievements by ID to prevent duplicate React keys
    const uniqueAchievements = Array.from(
      new Map(filtered.map(achievement => [achievement.id, achievement])).values()
    );

    return uniqueAchievements;
  }, [constellation.achievements, controls]);

  // Handle zoom
  const handleZoom = useCallback((delta: number) => {
    setControls(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(3, prev.zoom + delta))
    }));
  }, []);

  // Handle pan
  const handlePan = useCallback((deltaX: number, deltaY: number) => {
    setControls(prev => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY
    }));
  }, []);

  // Reset view
  const resetView = useCallback(() => {
    setControls(prev => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0
    }));
  }, []);

  // Handle achievement interaction
  const handleAchievementClick = useCallback((achievement: DiplomaticAchievement) => {
    if (!interactive) return;
    onAchievementClick?.(achievement);
  }, [interactive, onAchievementClick]);

  const handleAchievementHover = useCallback((achievement: DiplomaticAchievement | null) => {
    setHoveredAchievement(achievement);
    onAchievementHover?.(achievement);
  }, [onAchievementHover]);

  // Calculate constellation metrics
  const constellationMetrics = useMemo(() => {
    const unlockedAchievements = getUnlockedAchievements(constellation.achievements);
    const totalPrestige = calculatePrestigeScore(unlockedAchievements);
    const categoryBreakdown = Object.keys(ACHIEVEMENT_CATEGORY_CONFIG).reduce((acc, category) => {
      const categoryAchievements = getAchievementsByCategory(
        unlockedAchievements, 
        category as AchievementCategory
      );
      acc[category as AchievementCategory] = categoryAchievements.length;
      return acc;
    }, {} as Record<AchievementCategory, number>);

    return {
      totalAchievements: constellation.achievements.length,
      unlockedAchievements: unlockedAchievements.length,
      totalPrestige,
      categoryBreakdown
    };
  }, [constellation.achievements]);

  // Render achievement star
  const renderAchievementStar = (achievement: DiplomaticAchievement) => {
    const position = layout.customPositions?.[achievement.id];
    if (!position) return null;

    const tierConfig = ACHIEVEMENT_TIER_CONFIG[achievement.tier];
    const categoryConfig = ACHIEVEMENT_CATEGORY_CONFIG[achievement.category];
    const isUnlocked = Boolean(achievement.achievedAt);
    const isHovered = hoveredAchievement?.id === achievement.id;

    return (
      <g key={`achievement-${achievement.id}`} className="achievement-star">
        {/* Achievement glow effect */}
        {isUnlocked && (
          <circle
            cx={position.x || 0}
            cy={position.y || 0}
            r={(position.size || 12) + 8}
            fill={`url(#glow-${achievement.tier})`}
            opacity={isHovered ? 0.8 : 0.4}
            className="transition-opacity duration-300"
          />
        )}

        {/* Main achievement star */}
        <motion.circle
          cx={position.x || 0}
          cy={position.y || 0}
          r={position.size || 12}
          fill={isUnlocked ? tierConfig.color : '#444444'}
          stroke={isHovered ? '#FFFFFF' : categoryConfig.color}
          strokeWidth={isHovered ? 3 : 1}
          opacity={isUnlocked ? (position.brightness || 0.8) : 0.5}
          className="cursor-pointer transition-all duration-300"
          whileHover={{ scale: 1.2 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleAchievementClick(achievement)}
          onMouseEnter={() => handleAchievementHover(achievement)}
          onMouseLeave={() => handleAchievementHover(null)}
        />

        {/* Achievement icon overlay */}
        {isUnlocked && (
          <text
            x={position.x || 0}
            y={(position.y || 0) + 4}
            textAnchor="middle"
            fontSize={(position.size || 12) * 0.6}
            fill="white"
            className="pointer-events-none font-bold"
          >
            ★
          </text>
        )}

        {/* Locked achievement indicator */}
        {!isUnlocked && (
          <text
            x={position.x || 0}
            y={(position.y || 0) + 4}
            textAnchor="middle"
            fontSize={(position.size || 12) * 0.5}
            fill="#666666"
            className="pointer-events-none"
          >
            ?
          </text>
        )}
      </g>
    );
  };

  // Render constellation connections
  const renderConnections = () => {
    if (!showConnections) return null;

    const connections: ReactElement[] = [];
    const processedConnections = new Set<string>(); // Track processed connections to prevent duplicates

    filteredAchievements.forEach(achievement => {
      const position = layout.customPositions?.[achievement.id];
      if (!position?.connections) return;

      position.connections.forEach(connectionId => {
        const connectedAchievement = constellation.achievements.find(a => a.id === connectionId);
        const connectedPosition = layout.customPositions?.[connectionId];
        
        if (!connectedAchievement || !connectedPosition) return;
        if (!filteredAchievements.some(a => a.id === connectionId)) return;

        // Create a normalized connection key to prevent duplicates
        // Sort the IDs to ensure consistent key regardless of direction
        const connectionKey = [achievement.id, connectionId].sort().join('-');
        
        if (processedConnections.has(connectionKey)) return;
        processedConnections.add(connectionKey);

        const isUnlocked = Boolean(achievement.achievedAt && connectedAchievement.achievedAt);
        
        connections.push(
          <line
            key={`connection-${connectionKey}`}
            x1={position.x || 0}
            y1={position.y || 0}
            x2={connectedPosition.x || 0}
            y2={connectedPosition.y || 0}
            stroke={isUnlocked ? '#FFD700' : '#333333'}
            strokeWidth={isUnlocked ? 2 : 1}
            opacity={isUnlocked ? 0.6 : 0.3}
            className="transition-all duration-300"
          />
        );
      });
    });

    return <g className="constellation-connections">{connections}</g>;
  };

  // Render gradient definitions
  const renderGradients = () => (
    <defs>
      {Object.entries(ACHIEVEMENT_TIER_CONFIG).map(([tier, config]) => (
        <radialGradient
          key={`glow-${tier}`}
          id={`glow-${tier}`}
          cx="50%" cy="50%" r="50%"
        >
          <stop offset="0%" stopColor={config.color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={config.color} stopOpacity="0" />
        </radialGradient>
      ))}
    </defs>
  );

  return (
    <div className={cn("achievement-constellation space-y-6", className)}>
      {/* Constellation Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-[--intel-gold] flex items-center gap-3">
            <RiStarLine className="h-6 w-6" />
            {constellation.constellationName}
            <span className="text-sm font-normal text-[--intel-silver] ml-2">
              ({constellationMetrics.unlockedAchievements}/{constellationMetrics.totalAchievements})
            </span>
          </h3>
          <p className="text-[--intel-silver] text-sm mt-1">
            Prestige Score: {constellationMetrics.totalPrestige.toLocaleString()}
          </p>
        </div>

        {interactive && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(0.2)}
              className="p-2 text-[--intel-silver] hover:text-[--intel-gold] hover:bg-white/10 rounded-lg transition-colors"
            >
              <RiZoomInLine className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleZoom(-0.2)}
              className="p-2 text-[--intel-silver] hover:text-[--intel-gold] hover:bg-white/10 rounded-lg transition-colors"
            >
              <RiZoomOutLine className="h-4 w-4" />
            </button>
            <button
              onClick={resetView}
              className="p-2 text-[--intel-silver] hover:text-[--intel-gold] hover:bg-white/10 rounded-lg transition-colors"
            >
              <RiRefreshLine className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Constellation Controls */}
      {interactive && viewMode === 'full' && (
        <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-[--intel-gold]/20">
          <div className="flex items-center gap-2">
            <RiSearchLine className="h-4 w-4 text-[--intel-silver]" />
            <input
              type="text"
              placeholder="Search achievements..."
              value={controls.searchTerm}
              onChange={(e) => setControls(prev => ({ ...prev, searchTerm: e.target.value }))}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
            />
          </div>

          <div className="flex items-center gap-2">
            <RiFilterLine className="h-4 w-4 text-[--intel-silver]" />
            <select
              value={controls.filterCategory || ''}
              onChange={(e) => setControls(prev => ({ 
                ...prev, 
                filterCategory: e.target.value as AchievementCategory || undefined 
              }))}
              className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[--intel-gold]/50"
            >
              <option value="">All Categories</option>
              {Object.entries(ACHIEVEMENT_CATEGORY_CONFIG).map(([category, config]) => (
                <option key={category} value={category}>{config.description}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setControls(prev => ({ ...prev, showHidden: !prev.showHidden }))}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              controls.showHidden
                ? "bg-[--intel-gold]/20 text-[--intel-gold]"
                : "text-[--intel-silver] hover:text-white"
            )}
          >
            {controls.showHidden ? <RiEyeLine className="h-4 w-4" /> : <RiEyeOffLine className="h-4 w-4" />}
            Hidden
          </button>
        </div>
      )}

      {/* Main Constellation SVG */}
      <div className="relative glass-hierarchy-child rounded-lg overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height={viewMode === 'compact' ? '400' : '600'}
          viewBox={`${-controls.panX} ${-controls.panY} ${800 / controls.zoom} ${600 / controls.zoom}`}
          className="constellation-svg bg-gradient-to-b from-slate-900 to-slate-800"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(147, 51, 234, 0.1) 0%, transparent 50%),
              linear-gradient(to bottom, #0f172a, #1e293b)
            `
          }}
        >
          {renderGradients()}
          {renderConnections()}
          
          <g className="achievements-layer">
            {filteredAchievements.map(renderAchievementStar)}
          </g>
        </svg>

        {/* Constellation overlay info */}
        {hoveredAchievement && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute top-4 left-4 glass-modal rounded-lg p-4 max-w-sm z-10"
          >
            <h4 className="font-bold text-white mb-2">{hoveredAchievement.title}</h4>
            <p className="text-[--intel-silver] text-sm mb-3">{hoveredAchievement.description}</p>
            
            <div className="flex items-center justify-between text-xs">
              <span className={cn(
                "px-2 py-1 rounded-full",
                `bg-${ACHIEVEMENT_CATEGORY_CONFIG[hoveredAchievement.category].color.replace('text-', '')}/20`,
                ACHIEVEMENT_CATEGORY_CONFIG[hoveredAchievement.category].color
              )}>
                {hoveredAchievement.category}
              </span>
              
              <span className={cn(
                "px-2 py-1 rounded-full",
                `text-[${ACHIEVEMENT_TIER_CONFIG[hoveredAchievement.tier].color}]`,
                "bg-white/10"
              )}>
                {hoveredAchievement.tier}
              </span>
            </div>
          </motion.div>
        )}
      </div>

      {/* Category Breakdown */}
      {viewMode === 'full' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(constellationMetrics.categoryBreakdown).map(([category, count]) => {
            const config = ACHIEVEMENT_CATEGORY_CONFIG[category as AchievementCategory];
            return (
              <div
                key={category}
                className="glass-hierarchy-child rounded-lg p-4 text-center cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => setControls(prev => ({ 
                  ...prev, 
                  filterCategory: prev.filterCategory === category ? undefined : category as AchievementCategory 
                }))}
              >
                <div className="text-2xl font-bold" style={{ color: config.color }}>
                  {count}
                </div>
                <div className="text-[--intel-silver] text-sm capitalize">{category}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

AchievementConstellationComponent.displayName = 'AchievementConstellation';

const AchievementConstellationMemoized = React.memo(AchievementConstellationComponent);
export { AchievementConstellationMemoized as AchievementConstellation };