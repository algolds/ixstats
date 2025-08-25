"use client";

import React from 'react';
import { motion } from 'framer-motion';
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
  FileText
} from 'lucide-react';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuGroupLabel
} from '~/components/ui/dropdown-menu';
import { ActivityRings, createDefaultActivityRings } from './ActivityRings';

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
    trend: 'up' | 'down' | 'stable';
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
  flagColors = ['#3B82F6', '#10B981', '#F59E0B'],
  isOwner = false,
  showInteractionControls = false,
  className = ''
}: HolographicNationCardProps) {
  const primaryColor = flagColors[0] || '#3B82F6';
  
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
      allies: '12',
      reputation: 'Rising',
      treaties: '8',
    },
    governmentMetrics: {
      approval: '72%',
      efficiency: 'High',
      stability: 'Stable',
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
        stiffness: 100
      }}
      className={`relative ${className}`}
    >
      <Card className="relative overflow-hidden glass-hierarchy-parent border-0 bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl">
        {/* Holographic Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(circle at 20% 30%, ${primaryColor}15 0%, transparent 50%),
                radial-gradient(circle at 80% 70%, ${flagColors[1] || '#10B981'}15 0%, transparent 50%),
                radial-gradient(circle at 40% 80%, ${flagColors[2] || '#F59E0B'}15 0%, transparent 50%)
              `,
            }}
            animate={{
              transform: [
                'translateX(0%) translateY(0%) scale(1)',
                'translateX(1%) translateY(-0.5%) scale(1.01)',
                'translateX(-0.5%) translateY(0.5%) scale(0.99)',
                'translateX(0%) translateY(0%) scale(1)',
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
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: 'blur(1px) saturate(1.1) brightness(1.05)',
                mixBlendMode: 'overlay',
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
                ${flagColors[1] || '#10B981'}12 50%,
                ${flagColors[2] || '#F59E0B'}08 60%,
                transparent 70%
              )
            `,
            backgroundSize: '300% 300%',
          }}
          animate={{
            backgroundPosition: [
              '0% 0%',
              '100% 100%',
              '0% 100%', 
              '100% 0%',
              '0% 0%'
            ],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Content */}
        <CardContent className="p-6 relative z-10">
          <div className="flex items-start gap-6 mb-6">
            {/* Flag Section */}
            <motion.div
              whileHover={{ scale: 1.05, rotateY: 5 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="flex-shrink-0"
            >
              <div className="relative">
                {flagUrl ? (
                  <div className="w-20 h-14 rounded-lg overflow-hidden border-2 shadow-xl relative group">
                    <img 
                      src={flagUrl} 
                      alt={`${country.name} flag`} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-110" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ) : (
                  <div 
                    className="w-20 h-14 rounded-lg border-2 shadow-xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(135deg, ${primaryColor}40, ${flagColors[1] || '#10B981'}30)`
                    }}
                  >
                    <Flag className="h-6 w-6 text-white/80" />
                  </div>
                )}
              </div>
            </motion.div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <motion.h1 
                    className="text-2xl font-bold flex items-center gap-3 mb-1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    {isOwner && <Crown className="h-6 w-6 text-amber-500" />}
                    <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">
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
                      <Badge className="bg-amber-500/20 text-amber-200 border-amber-400/30">
                        <Sparkles className="h-3 w-3 mr-1" />
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
                        className="h-8 w-8 p-0 glass-hierarchy-interactive hover:scale-105 transition"
                      >
                        <Share2 className="h-4 w-4" />
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 glass-hierarchy-interactive hover:scale-105 transition"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      
                      {/* More Actions Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger className="h-8 w-8 p-0 glass-hierarchy-interactive hover:scale-105 transition inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground rounded-md">
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
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <div className="text-center p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/20">
              <Users className="h-4 w-4 mx-auto mb-1 text-blue-500" />
              <div className="text-sm font-bold text-foreground">
                {(country.currentPopulation / 1000000).toFixed(1)}M
              </div>
              <div className="text-xs text-muted-foreground mb-1">Population</div>
              <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30">
                T{country.populationTier}
              </Badge>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/20">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-green-500" />
              <div className="text-sm font-bold text-foreground">
                ${(country.currentGdpPerCapita / 1000).toFixed(0)}k
              </div>
              <div className="text-xs text-muted-foreground mb-1">GDP/Capita</div>
              <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950/30">
                {country.economicTier}
              </Badge>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/20">
              <Building2 className="h-4 w-4 mx-auto mb-1 text-purple-500" />
              <div className="text-sm font-bold text-foreground">
                {country.landArea ? (
                  country.landArea >= 1000000 
                    ? `${(country.landArea / 1000000).toFixed(1)}M`
                    : country.landArea >= 1000
                    ? `${(country.landArea / 1000).toFixed(0)}K`
                    : country.landArea.toFixed(0)
                ) : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mb-1">km² Area</div>
              <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-950/30">
                {country.populationDensity ? `${country.populationDensity.toFixed(0)}/km²` : 'N/A'}
              </Badge>
            </div>
            
            <div className="text-center p-3 rounded-lg bg-background/60 backdrop-blur-sm border border-border/20">
              <Globe2 className="h-4 w-4 mx-auto mb-1 text-orange-500" />
              <div className="text-sm font-bold text-foreground">
                {country.capital || 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mb-1">Capital</div>
              <Badge variant="outline" className="text-xs bg-orange-50 dark:bg-orange-950/30">
                {country.founded || 'N/A'}
              </Badge>
            </div>
          </motion.div>

          {/* Activity Rings Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="border-t border-border/20 pt-4"
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-foreground">National Vitality</span>
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
            className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-4"
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
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-5">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: flagColors[i % flagColors.length] || '#3B82F6',
                left: `${20 + (i * 15)}%`,
                top: `${30 + (i * 10)}%`,
              }}
              animate={{
                y: [-10, -20, -10],
                opacity: [0.2, 0.8, 0.2],
                scale: [1, 1.5, 1],
              }}
              transition={{
                duration: 4 + (i * 0.5),
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