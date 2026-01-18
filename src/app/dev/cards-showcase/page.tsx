/**
 * Cards Showcase - Development Test Harness
 * Comprehensive testing environment for all card variations, styles, and effects
 *
 * Features:
 * - All rarity levels side-by-side comparison
 * - All card types (NATION, LORE, NS_IMPORT, SPECIAL)
 * - All holographic patterns including Pokemon-inspired effects
 * - Size variants (small, medium, large)
 * - Performance mode toggle
 * - Card style selector
 * - Interactive controls for all effects
 * - Performance metrics
 */

"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import { cn } from "~/lib/utils";
import { CardRarity, CardType, getAllRarities, getAllCardTypes } from "~/lib/card-enums";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";

/**
 * Mock card data generator
 */
function generateMockCard(
  rarity: typeof CardRarity[keyof typeof CardRarity],
  cardType: typeof CardType[keyof typeof CardType],
  overrides?: Partial<CardInstance>
): CardInstance {
  const rarityLabels = {
    COMMON: "Common",
    UNCOMMON: "Uncommon",
    RARE: "Rare",
    ULTRA_RARE: "Ultra Rare",
    EPIC: "Epic",
    LEGENDARY: "Legendary",
  };

  const typeLabels = {
    NATION: "Nation",
    LORE: "Lore",
    NS_IMPORT: "NS Import",
    SPECIAL: "Special",
    COMMUNITY: "Community",
  };

  const marketValues = {
    COMMON: 50,
    UNCOMMON: 150,
    RARE: 500,
    ULTRA_RARE: 1500,
    EPIC: 5000,
    LEGENDARY: 15000,
  };

  const supplies = {
    COMMON: 10000,
    UNCOMMON: 5000,
    RARE: 2000,
    ULTRA_RARE: 750,
    EPIC: 250,
    LEGENDARY: 50,
  };

  return {
    id: `mock-${rarity}-${cardType}-${Date.now()}`,
    title: `${rarityLabels[rarity]} ${typeLabels[cardType]} Card`,
    description: `A test ${rarityLabels[rarity].toLowerCase()} card of type ${typeLabels[cardType]}`,
    artwork: "/images/cards/lore-placeholder.svg", // Fallback artwork (NS cards use nation flags, not card images)
    artworkVariants: null,
    cardType: cardType,
    rarity: rarity,
    season: 3,
    nsCardId: 314514,
    nsSeason: 3,
    nsData: null,
    wikiSource: null,
    wikiArticleTitle: null,
    wikiUrl: null,
    countryId: "test-country",
    stats: {
      economic: Math.floor(Math.random() * 100),
      diplomatic: Math.floor(Math.random() * 100),
      military: Math.floor(Math.random() * 100),
      social: Math.floor(Math.random() * 100),
    },
    marketValue: marketValues[rarity],
    totalSupply: supplies[rarity],
    level: Math.floor(Math.random() * 5) + 1,
    evolutionStage: 1,
    enhancements: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastTrade: new Date(),
    country: {
      id: "test-country",
      name: "Test Nation",
      continent: "Test Continent",
      region: "Test Region",
      flag: "🏴",
    },
    owners: [],
    ...overrides,
  };
}

/**
 * Performance monitor hook
 */
function usePerformanceMonitor() {
  const [fps, setFps] = useState(60);
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const measureFPS = () => {
      frameCount++;
      const currentTime = performance.now();
      const delta = currentTime - lastTime;

      if (delta >= 1000) {
        setFps(Math.round((frameCount * 1000) / delta));
        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measureFPS);
    };

    animationFrameId = requestAnimationFrame(measureFPS);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const measureRender = (callback: () => void) => {
    const start = performance.now();
    callback();
    const end = performance.now();
    setRenderTime(end - start);
  };

  return { fps, renderTime, measureRender };
}

/**
 * Cards Showcase Page
 */
export default function CardsShowcasePage() {
  // Control states
  const [selectedSize, setSelectedSize] = useState<CardDisplaySize>("medium");
  const [performanceMode, setPerformanceMode] = useState(false);
  const [enable3D, setEnable3D] = useState(true);
  const [enableHolographic, setEnableHolographic] = useState(true);
  const [enableAnimations, setEnableAnimations] = useState(true);
  const [selectedRarity, setSelectedRarity] = useState<typeof CardRarity[keyof typeof CardRarity]>(CardRarity.LEGENDARY);
  const [selectedType, setSelectedType] = useState<typeof CardType[keyof typeof CardType]>(CardType.NATION);

  const { fps, renderTime } = usePerformanceMonitor();

  // Generate mock cards (memoized to prevent regeneration on every render)
  const allRarities = React.useMemo(() => getAllRarities(), []);
  const allTypes = React.useMemo(() => getAllCardTypes(), []);

  const rarityCards = React.useMemo(
    () => allRarities.map((rarity) => generateMockCard(rarity, CardType.NATION)),
    [allRarities]
  );

  const typeCards = React.useMemo(
    () => allTypes.map((type) => generateMockCard(CardRarity.LEGENDARY, type)),
    [allTypes]
  );

  const interactiveCard = React.useMemo(
    () => generateMockCard(selectedRarity, selectedType),
    [selectedRarity, selectedType]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="container mx-auto px-4 py-6">
          <h1 className="font-mono text-3xl font-bold text-green-400">
            📊 IxCards Development Showcase
          </h1>
          <p className="mt-2 font-mono text-sm text-slate-400">
            Comprehensive test harness for card display components • v1.42
          </p>

          {/* Performance Metrics */}
          <div className="mt-4 flex gap-6 font-mono text-xs">
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full",
                fps >= 55 ? "bg-green-500" : fps >= 30 ? "bg-yellow-500" : "bg-red-500"
              )} />
              <span className="text-slate-400">FPS:</span>
              <span className="text-white">{fps}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Render Time:</span>
              <span className="text-white">{renderTime.toFixed(2)}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Performance Mode:</span>
              <span className={performanceMode ? "text-green-400" : "text-slate-400"}>
                {performanceMode ? "ON" : "OFF"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Controls Panel */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="container mx-auto px-4 py-6">
          <h2 className="mb-4 font-mono text-sm font-bold uppercase tracking-wider text-green-400">
            🎮 Controls
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Size Selector */}
            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                Card Size
              </label>
              <div className="flex gap-2">
                {(["small", "medium", "large"] as CardDisplaySize[]).map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={cn(
                      "rounded-md px-3 py-2 font-mono text-xs transition-all",
                      selectedSize === size
                        ? "bg-green-500 text-black font-bold"
                        : "bg-white/5 text-slate-400 hover:bg-white/10"
                    )}
                  >
                    {size.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Rarity Selector */}
            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                Rarity Level
              </label>
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value as typeof CardRarity[keyof typeof CardRarity])}
                className="w-full rounded-md bg-white/5 px-3 py-2 font-mono text-xs text-white border border-white/10 focus:border-green-500 focus:outline-none"
              >
                {allRarities.map((rarity) => (
                  <option key={rarity} value={rarity} className="bg-slate-900">
                    {rarity.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            {/* Type Selector */}
            <div>
              <label className="mb-2 block font-mono text-xs text-slate-400">
                Card Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as typeof CardType[keyof typeof CardType])}
                className="w-full rounded-md bg-white/5 px-3 py-2 font-mono text-xs text-white border border-white/10 focus:border-green-500 focus:outline-none"
              >
                {allTypes.map((type) => (
                  <option key={type} value={type} className="bg-slate-900">
                    {type.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Toggle Controls */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ToggleControl
              label="Performance Mode"
              enabled={performanceMode}
              onChange={setPerformanceMode}
              description="Disable heavy effects"
            />
            <ToggleControl
              label="3D Tilt Effect"
              enabled={enable3D}
              onChange={setEnable3D}
              description="Card tilt on hover"
            />
            <ToggleControl
              label="Holographic Effects"
              enabled={enableHolographic}
              onChange={setEnableHolographic}
              description="Shimmer & particles"
            />
            <ToggleControl
              label="Animations"
              enabled={enableAnimations}
              onChange={setEnableAnimations}
              description="All animations"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* All Rarities Section */}
        <section>
          <SectionHeader
            title="All Rarity Levels"
            description="Complete rarity progression from Common to Legendary"
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-6">
            {rarityCards.map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-2">
                <CardDisplay
                  card={card}
                  size={selectedSize}
                  enable3D={enable3D && enableAnimations}
                  enableHolographic={enableHolographic}
                  performanceMode={performanceMode}
                />
                <span className="font-mono text-xs text-slate-400">
                  {card.rarity.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* All Types Section */}
        <section>
          <SectionHeader
            title="All Card Types"
            description="Different card categories with unique styling"
          />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {typeCards.map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-2">
                <CardDisplay
                  card={card}
                  size={selectedSize}
                  enable3D={enable3D && enableAnimations}
                  enableHolographic={enableHolographic}
                  performanceMode={performanceMode}
                />
                <span className="font-mono text-xs text-slate-400">
                  {card.cardType.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Holographic Patterns Section */}
        <section>
          <SectionHeader
            title="Holographic Patterns"
            description="Showcase of all holographic effects including Pokemon-inspired patterns"
          />
          <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-md">
            <div className="grid gap-4 font-mono text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>Rainbow Shimmer</span>
                <span className="text-cyan-400">RARE</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Prismatic Wave (Pokemon-style)</span>
                <span className="text-violet-400">ULTRA_RARE</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sparkle Grid (Pokemon-style)</span>
                <span className="text-orange-400">EPIC</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Cosmic Drift</span>
                <span className="text-yellow-400">LEGENDARY</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Liquid Glass</span>
                <span className="text-slate-400">Custom Pattern</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Holofoil Texture</span>
                <span className="text-slate-400">Available</span>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-6 md:grid-cols-3">
              {[CardRarity.RARE, CardRarity.ULTRA_RARE, CardRarity.EPIC, CardRarity.LEGENDARY].map((rarity) => (
                <div key={rarity} className="flex flex-col items-center gap-2">
                  <CardDisplay
                    card={generateMockCard(rarity, CardType.LORE)}
                    size="medium"
                    enable3D={enable3D && enableAnimations}
                    enableHolographic={enableHolographic}
                    performanceMode={performanceMode}
                  />
                  <span className="font-mono text-xs text-slate-400">
                    {rarity.replace("_", " ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Size Comparison Section */}
        <section>
          <SectionHeader
            title="Size Comparison"
            description="Same card rendered at all available sizes"
          />
          <div className="flex flex-wrap items-end justify-center gap-8">
            {(["small", "medium", "large"] as CardDisplaySize[]).map((size) => (
              <div key={size} className="flex flex-col items-center gap-2">
                <CardDisplay
                  card={generateMockCard(CardRarity.LEGENDARY, CardType.NATION)}
                  size={size}
                  enable3D={enable3D && enableAnimations}
                  enableHolographic={enableHolographic}
                  performanceMode={performanceMode}
                />
                <span className="font-mono text-xs text-slate-400">
                  {size.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section>
          <SectionHeader
            title="Interactive Demo"
            description="Single card with all controls • Test rarity, type, and effects"
          />
          <div className="rounded-xl border border-white/10 bg-black/20 p-8 backdrop-blur-md">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
              <div className="flex-shrink-0">
                <CardDisplay
                  card={interactiveCard}
                  size="large"
                  enable3D={enable3D && enableAnimations}
                  enableHolographic={enableHolographic}
                  performanceMode={performanceMode}
                />
              </div>
              <div className="flex-1 max-w-md space-y-4 font-mono text-xs">
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <h3 className="mb-3 font-bold text-green-400">CURRENT CONFIG</h3>
                  <div className="space-y-2 text-slate-300">
                    <ConfigLine label="Rarity" value={selectedRarity.replace("_", " ")} />
                    <ConfigLine label="Type" value={selectedType.replace("_", " ")} />
                    <ConfigLine label="Size" value={selectedSize.toUpperCase()} />
                    <ConfigLine label="3D Tilt" value={enable3D ? "ENABLED" : "DISABLED"} />
                    <ConfigLine label="Holographic" value={enableHolographic ? "ENABLED" : "DISABLED"} />
                    <ConfigLine label="Performance" value={performanceMode ? "ON" : "OFF"} />
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-4">
                  <h3 className="mb-3 font-bold text-green-400">CARD STATS</h3>
                  <div className="space-y-2 text-slate-300">
                    <ConfigLine label="Market Value" value={`${interactiveCard.marketValue} IX`} />
                    <ConfigLine label="Supply" value={interactiveCard.totalSupply.toLocaleString()} />
                    <ConfigLine label="Level" value={interactiveCard.level.toString()} />
                    <ConfigLine label="Season" value={interactiveCard.season.toString()} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Info */}
        <section>
          <SectionHeader
            title="Technical Information"
            description="Implementation details and performance characteristics"
          />
          <div className="rounded-xl border border-white/10 bg-black/20 p-6 backdrop-blur-md font-mono text-xs">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-bold text-green-400">FEATURES</h3>
                <ul className="space-y-1 text-slate-400">
                  <li>✓ 6 rarity levels with unique styling</li>
                  <li>✓ 5 card types (NATION, LORE, NS_IMPORT, SPECIAL, COMMUNITY)</li>
                  <li>✓ 6+ holographic patterns including Pokemon-inspired</li>
                  <li>✓ GPU-accelerated animations</li>
                  <li>✓ Responsive sizing (small, medium, large)</li>
                  <li>✓ Performance mode for low-end devices</li>
                  <li>✓ 3D tilt effect with parallax</li>
                  <li>✓ Animated light rays and particles</li>
                  <li>✓ Embossed text with metallic gradients</li>
                  <li>✓ Rarity-based foil stamps</li>
                </ul>
              </div>
              <div>
                <h3 className="mb-3 font-bold text-green-400">PERFORMANCE</h3>
                <ul className="space-y-1 text-slate-400">
                  <li>• Target: 60 FPS on modern devices</li>
                  <li>• GPU acceleration: transform3d, will-change</li>
                  <li>• Lazy loading for images</li>
                  <li>• React.memo optimization</li>
                  <li>• Conditional effect rendering</li>
                  <li>• Performance mode disables heavy effects</li>
                  <li>• Mobile-optimized with reduced particles</li>
                  <li>• RequestAnimationFrame for smooth animations</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 bg-black/40 backdrop-blur-xl mt-12">
        <div className="container mx-auto px-4 py-6 text-center font-mono text-xs text-slate-500">
          IxCards Development Showcase • IxStats v1.42 • Built with Next.js 15 & Framer Motion
        </div>
      </div>
    </div>
  );
}

/**
 * Section Header Component
 */
function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-mono text-xl font-bold text-green-400">{title}</h2>
      <p className="mt-1 font-mono text-xs text-slate-500">{description}</p>
    </div>
  );
}

/**
 * Toggle Control Component
 */
function ToggleControl({
  label,
  enabled,
  onChange,
  description,
}: {
  label: string;
  enabled: boolean;
  onChange: (value: boolean) => void;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3">
      <div>
        <div className="font-mono text-xs font-medium text-white">{label}</div>
        <div className="font-mono text-[10px] text-slate-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          enabled ? "bg-green-500" : "bg-slate-700"
        )}
      >
        <motion.div
          className="absolute top-1 h-4 w-4 rounded-full bg-white"
          animate={{ left: enabled ? "24px" : "4px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

/**
 * Config Line Component
 */
function ConfigLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-slate-500">{label}:</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
