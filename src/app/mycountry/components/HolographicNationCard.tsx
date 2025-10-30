"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Flag,
  MapPin,
  Calendar,
  Users,
  TrendingUp,
  Building2,
  Crown,
  Globe2,
  Sparkles,
  Activity,
  Settings,
  Share2,
  ExternalLink,
  MoreHorizontal,
  Eye,
  Download,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
} from "~/components/ui/dropdown-menu";
import { ActivityRings, createDefaultActivityRings } from "./ActivityRings";

interface ActivityRing {
  id: string;
  title: string;
  description: string;
  value: number;
  max: number;
  color: string;
  icon: React.ElementType;
  metrics: {
    primary: string;
    secondary: string;
    trend: "up" | "down" | "stable";
    change: string;
  };
}

interface HolographicNationCardProps {
  country: {
    id: string;
    name: string;
    region: string;
    continent: string;
    capital?: string;
    founded?: string;
    governmentType?: string;
    currentPopulation: number;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    economicTier: string;
    populationTier: string;
    // Calculated vitality scores
    economicVitality: number;
    populationWellbeing: number;
    diplomaticStanding: number;
    governmentalEfficiency: number;
    // Growth and trends
    populationGrowthRate: number;
    realGDPGrowthRate: number;
    adjustedGdpGrowth: number;
    landArea?: number;
    populationDensity?: number;
    lastCalculated: number;
    baselineDate: number;
  };
  flagUrl?: string | null;
  flagColors?: string[];
  isOwner?: boolean;
  showInteractionControls?: boolean;
  className?: string;
}

export function HolographicNationCard({
  country,
  flagUrl,
  flagColors = ["#3B82F6", "#10B981", "#F59E0B"],
  isOwner = false,
  showInteractionControls = false,
  className = "",
}: HolographicNationCardProps) {
  const primaryColor = flagColors[0] || "#3B82F6";

  // Generate activity rings data from country vitality scores
  const activityRingsData = createDefaultActivityRings({
    economicVitality: country.economicVitality,
    populationWellbeing: country.populationWellbeing,
    diplomaticStanding: country.diplomaticStanding,
    governmentalEfficiency: country.governmentalEfficiency,
    economicMetrics: {
      gdpPerCapita: `$${(country.currentGdpPerCapita / 1000).toFixed(0)}k`,
      growthRate: `${(country.realGDPGrowthRate * 100).toFixed(1)}%`,
      tier: country.economicTier,
    },
    populationMetrics: {
      population: `${(country.currentPopulation / 1000000).toFixed(1)}M`,
      growthRate: `${(country.populationGrowthRate * 100).toFixed(1)}%`,
      tier: country.populationTier,
    },
    diplomaticMetrics: {
      allies: "12",
      reputation: "Rising",
      treaties: "8",
    },
    governmentMetrics: {
      approval: "72%",
      efficiency: "High",
      stability: "Stable",
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, rotateX: 15 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{
        duration: 0.8,
        ease: [0.4, 0, 0.2, 1],
        type: "spring",
        stiffness: 100,
      }}
      className={`relative ${className}`}
    >
      <Card className="glass-hierarchy-parent relative overflow-hidden border-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl">
        {/* Holographic Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, ${primaryColor}15 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, ${flagColors[1] || "#10B981"}15 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, ${flagColors[2] || "#F59E0B"}15 0%, transparent 50%)
              `,
            }}
            animate={{
              transform: [
                "translateX(0%) translateY(0%) scale(1)",
                "translateX(1%) translateY(-0.5%) scale(1.01)",
                "translateX(-0.5%) translateY(0.5%) scale(0.99)",
                "translateX(0%) translateY(0%) scale(1)",
              ],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Flag Background */}
          {flagUrl && (
            <motion.div
              className="absolute inset-0 opacity-[0.05] dark:opacity-[0.02]"
              style={{
                backgroundImage: `url(${flagUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                filter: "blur(1px) saturate(1.1) brightness(1.05)",
                mixBlendMode: "overlay",
              }}
              animate={{
                scale: [1, 1.01, 1],
                opacity: [0.05, 0.08, 0.05],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}
        </div>

        {/* Prismatic Effect */}
        <motion.div
          className="absolute inset-0 rounded-lg"
          style={{
            background: `
              linear-gradient(
                45deg,
                transparent 30%,
                ${primaryColor}08 40%,
                ${flagColors[1] || "#10B981"}12 50%,
                ${flagColors[2] || "#F59E0B"}08 60%,
                transparent 70%
              )
            `,
            backgroundSize: "300% 300%",
          }}
          animate={{
            backgroundPosition: ["0% 0%", "100% 100%", "0% 100%", "100% 0%", "0% 0%"],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Content */}
        <CardContent className="relative z-10 p-6">
          <div className="mb-6 flex items-start gap-6">
            {/* Flag Section */}
            <motion.div
              whileHover={{ scale: 1.05, rotateY: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="flex-shrink-0"
            >
              <div className="relative">
                {flagUrl ? (
                  <div className="group relative h-14 w-20 overflow-hidden rounded-lg border-2 shadow-xl">
                    <img
                      src={flagUrl}
                      alt={`${country.name} flag`}
                      className="h-full w-full object-cover transition-transform group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                ) : (
                  <div
                    className="flex h-14 w-20 items-center justify-center rounded-lg border-2 shadow-xl"
                    style={{
                      background: `linear-gradient(135deg, ${primaryColor}40, ${flagColors[1] || "#10B981"}30)`,
                    }}
                  >
                    <Flag className="h-6 w-6 text-white/80" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <motion.h1
                    className="mb-1 flex items-center gap-3 text-2xl font-bold"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {isOwner && <Crown className="h-6 w-6 text-amber-500" />}
                    <span className="from-foreground to-foreground/80 bg-gradient-to-r bg-clip-text text-transparent">
                      {country.name}
                    </span>
                  </motion.h1>
                  <motion.p
                    className="text-muted-foreground flex items-center gap-2"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                  >
                    <MapPin className="h-4 w-4" />
                    {country.region}, {country.continent}
                  </motion.p>
                </div>

                <div className="flex items-center gap-3">
                  {isOwner && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Badge className="border-amber-400/30 bg-amber-500/20 text-amber-200">
                        <Sparkles className="mr-1 h-3 w-3" />
                        MyCountry®
                      </Badge>
                    </motion.div>
                  )}

                  {/* Interaction Controls */}
                  {showInteractionControls && (
                    <motion.div
                      className="flex items-center gap-2"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 }}
                    >
                      {/* Quick Actions */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="glass-hierarchy-interactive h-8 w-8 p-0 transition hover:scale-105"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="glass-hierarchy-interactive h-8 w-8 p-0 transition hover:scale-105"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>

                      {/* More Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="glass-hierarchy-interactive ring-offset-background focus-visible:ring-ring hover:bg-accent hover:text-accent-foreground inline-flex h-8 w-8 items-center justify-center rounded-md p-0 text-sm font-medium whitespace-nowrap transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuGroup>
                            <DropdownMenuGroupLabel>Country Actions</DropdownMenuGroupLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              <span>View Public Profile</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Generate Report</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem>
                              <Download className="mr-2 h-4 w-4" />
                              <span>Export Data</span>
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            {isOwner && (
                              <DropdownMenuItem>
                                <Settings className="mr-2 h-4 w-4" />
                                <span>Country Settings</span>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Compact Stats Grid */}
          <motion.div
            className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="bg-background/60 border-border/20 rounded-lg border p-3 text-center backdrop-blur-sm">
              <Users className="mx-auto mb-1 h-4 w-4 text-blue-500" />
              <div className="text-foreground text-sm font-bold">
                {(country.currentPopulation / 1000000).toFixed(1)}M
              </div>
              <div className="text-muted-foreground mb-1 text-xs">Population</div>
              <Badge variant="outline" className="bg-blue-50 text-xs dark:bg-blue-950/30">
                T{country.populationTier}
              </Badge>
            </div>

            <div className="bg-background/60 border-border/20 rounded-lg border p-3 text-center backdrop-blur-sm">
              <TrendingUp className="mx-auto mb-1 h-4 w-4 text-green-500" />
              <div className="text-foreground text-sm font-bold">
                ${(country.currentGdpPerCapita / 1000).toFixed(0)}k
              </div>
              <div className="text-muted-foreground mb-1 text-xs">GDP/Capita</div>
              <Badge variant="outline" className="bg-green-50 text-xs dark:bg-green-950/30">
                {country.economicTier}
              </Badge>
            </div>

            <div className="bg-background/60 border-border/20 rounded-lg border p-3 text-center backdrop-blur-sm">
              <Building2 className="mx-auto mb-1 h-4 w-4 text-purple-500" />
              <div className="text-foreground text-sm font-bold">
                {country.landArea
                  ? country.landArea >= 1000000
                    ? `${(country.landArea / 1000000).toFixed(1)}M`
                    : country.landArea >= 1000
                      ? `${(country.landArea / 1000).toFixed(0)}K`
                      : country.landArea.toFixed(0)
                  : "N/A"}
              </div>
              <div className="text-muted-foreground mb-1 text-xs">km² Area</div>
              <Badge variant="outline" className="bg-purple-50 text-xs dark:bg-purple-950/30">
                {country.populationDensity ? `${country.populationDensity.toFixed(0)}/km²` : "N/A"}
              </Badge>
            </div>

            <div className="bg-background/60 border-border/20 rounded-lg border p-3 text-center backdrop-blur-sm">
              <Globe2 className="mx-auto mb-1 h-4 w-4 text-orange-500" />
              <div className="text-foreground text-sm font-bold">{country.capital || "N/A"}</div>
              <div className="text-muted-foreground mb-1 text-xs">Capital</div>
              <Badge variant="outline" className="bg-orange-50 text-xs dark:bg-orange-950/30">
                {country.founded || "N/A"}
              </Badge>
            </div>
          </motion.div>

          {/* Activity Rings Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="border-border/20 border-t pt-4"
          >
            <div className="mb-4 flex items-center justify-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-foreground text-sm font-medium">National Vitality</span>
            </div>
            <div className="flex justify-center">
              <ActivityRings
                rings={activityRingsData}
                size="sm"
                interactive={false}
                className="justify-center"
              />
            </div>
          </motion.div>

          {/* Government Info */}
          <motion.div
            className="text-muted-foreground mt-4 flex flex-wrap gap-2 text-xs"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
          >
            {country.governmentType && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {country.governmentType}
              </span>
            )}
          </motion.div>
        </CardContent>

        {/* Floating Particles */}
        <div className="pointer-events-none absolute inset-0 z-5 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute h-1 w-1 rounded-full"
              style={{
                background: flagColors[i % flagColors.length] || "#3B82F6",
                left: `${20 + i * 15}%`,
                top: `${30 + i * 10}%`,
              }}
              animate={{
                y: [-10, -20, -10],
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 4 + i * 0.5,
                repeat: Infinity,
                delay: i * 0.5,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </Card>
    </motion.div>
  );
}

export default HolographicNationCard;
