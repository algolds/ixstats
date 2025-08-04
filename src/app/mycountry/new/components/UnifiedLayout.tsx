"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Crown, 
  TrendingUp, 
  Users, 
  Globe,
  Building2,
  Activity,
  ChevronDown,
  ChevronUp,
  Command,
  Settings,
  ExternalLink,
  BarChart3,
  Target,
  Brain,
  Briefcase,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { SectionIcons, IconThemes, StandardIcon } from './IconSystem';
import { 
  CONTENT_HIERARCHY, 
  CONTENT_PRIORITIES, 
  shouldDisplaySection, 
  getDisplayOrder,
  type ContentSection 
} from './ContentHierarchy';
import { TabThemeProvider, getTabTheme, applyTabTheme } from './TabColorSystem';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { HolographicNationCard } from './HolographicNationCard';
import { ActivityRings } from './ActivityRings';
import { AchievementsRankings } from './AchievementsRankings';
import { FocusCards } from './FocusCards';
import { ExecutiveSummary } from './ExecutiveSummary';

interface DataSyncState {
  isConnected: boolean;
  lastUpdate: number;
  updateCount: number;
  errors: string[];
  status: 'idle' | 'syncing' | 'error' | 'disconnected';
}

interface UnifiedLayoutProps {
  country: any;
  viewMode: 'public' | 'executive';
  isOwner: boolean;
  onModeToggle: (mode: 'public' | 'executive') => void;
  currentIxTime: number;
  timeAcceleration: number;
  achievements: any[];
  milestones: any[];
  rankings: any[];
  intelligenceFeed: any[];
  flagUrl?: string | null;
  children: React.ReactNode;
  className?: string;
  syncState?: DataSyncState;
  onForceRefresh?: () => void;
  onForceUpdateStats?: () => void;
}

interface CollapsibleSectionProps {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  colorTheme?: 'mycountry' | 'executive' | 'intelligence' | 'analytics';
  className?: string;
  priority?: ContentSection['priority'];
  purpose?: string;
  disableHeaderClick?: boolean; // Add flag to disable header click when content has interactive elements
}

function CollapsibleSection({
  id,
  title,
  icon: Icon,
  badge,
  children,
  defaultExpanded = false,
  colorTheme = 'mycountry',
  className = '',
  priority = 'medium',
  purpose,
  disableHeaderClick = false
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Load expanded state from localStorage, respecting content hierarchy defaults
  useEffect(() => {
    const saved = localStorage.getItem(`mycountry-section-${id}`);
    if (saved !== null) {
      setIsExpanded(JSON.parse(saved));
    } else {
      // Use content hierarchy priority to determine default state
      const priorityConfig = CONTENT_PRIORITIES[priority];
      setIsExpanded(priorityConfig.defaultExpanded || defaultExpanded);
    }
  }, [id, priority, defaultExpanded]);

  // Save expanded state
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem(`mycountry-section-${id}`, JSON.stringify(newState));
  };

  const themeClasses = {
    mycountry: 'glass-mycountry',
    executive: 'glass-eci',
    intelligence: 'glass-sdi',
    analytics: 'glass-global',
    governance: 'glass-eci',
    global: 'glass-global',
    economic: 'glass-global',
    social: 'glass-sdi',
    critical: 'glass-eci'
  };

  return (
    <motion.div
      layout
      className={`glass-hierarchy-parent ${themeClasses[colorTheme]} rounded-xl overflow-hidden ${className}`}
      whileHover={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Section Header */}
      <motion.div
        className={`glass-hierarchy-child p-4 ${!disableHeaderClick ? 'cursor-pointer' : ''}`}
        onClick={!disableHeaderClick ? toggleExpanded : undefined}
        whileHover={!disableHeaderClick ? { backgroundColor: "rgba(255, 255, 255, 0.05)" } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg glass-hierarchy-interactive">
              <StandardIcon 
                icon={Icon} 
                size="md" 
                theme={colorTheme} 
                variant="primary"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">{title}</h3>
                {priority === 'critical' && (
                  <Badge variant="destructive" className="text-xs px-1 py-0">
                    Critical
                  </Badge>
                )}
                {priority === 'high' && (
                  <Badge variant="default" className="text-xs px-1 py-0">
                    High
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {badge && (
                  <Badge variant="outline" className="text-xs">
                    {badge}
                  </Badge>
                )}
                {purpose && (
                  <span className="text-xs text-muted-foreground" title={purpose}>
                    {purpose.slice(0, 50)}...
                  </span>
                )}
              </div>
            </div>
          </div>
          {disableHeaderClick ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpanded}
              className="h-8 w-8 p-0"
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            </Button>
          ) : (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function UnifiedLayout({
  country,
  viewMode,
  isOwner,
  onModeToggle,
  currentIxTime,
  timeAcceleration,
  achievements,
  milestones,
  rankings,
  intelligenceFeed,
  flagUrl,
  children,
  className = '',
  syncState,
  onForceRefresh,
  onForceUpdateStats
}: UnifiedLayoutProps) {
  const isExecutiveMode = viewMode === 'executive';

  return (
    <TabThemeProvider defaultTheme={isExecutiveMode ? 'executive' : 'mycountry'}>
      <div 
        className={`relative min-h-screen bg-background ${isExecutiveMode ? 'executive-immersive' : ''} ${className}`}
        style={applyTabTheme(isExecutiveMode ? 'executive' : 'mycountry')}
      >
      {/* Global Command Palette now handles executive notifications through the main navigation */}

      {/* Mode Toggle Button */}
      {isOwner && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="fixed top-4 left-4 z-40"
        >
          <Button
            onClick={() => onModeToggle(isExecutiveMode ? 'public' : 'executive')}
            variant="outline"
            size="sm"
            className="glass-hierarchy-interactive"
          >
            {isExecutiveMode ? (
              <>
                <Globe className="h-4 w-4 mr-2" />
                Public View
              </>
            ) : (
              <>
                <Crown className="h-4 w-4 mr-2" />
                Executive
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* IxTime Display - Hidden/Toggleable */}
      <AnimatePresence>
        {!isExecutiveMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="fixed top-16 right-4 z-30"
          >
            <div className="glass-hierarchy-child px-3 py-2 rounded-lg">
              <div className="text-xs text-muted-foreground">
                IxTime: {new Date(currentIxTime * 1000).toLocaleDateString()} 
                <span className="ml-1 text-amber-500">×{timeAcceleration}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data Sync Status Indicator - Hidden/Toggleable */}
      <AnimatePresence>
        {syncState && !isExecutiveMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="fixed top-28 right-4 z-30"
          >
            <div 
              className={`glass-hierarchy-child px-3 py-2 rounded-lg cursor-pointer hover:scale-105 transition-transform ${
                syncState.status === 'error' ? 'ring-1 ring-red-500/30' : 
                syncState.status === 'syncing' ? 'ring-1 ring-blue-500/30' : 
                'ring-1 ring-green-500/30'
              }`}
              onClick={() => {
                if (syncState.status === 'error' && onForceRefresh) {
                  onForceRefresh();
                }
              }}
              title={`Last update: ${syncState.lastUpdate ? new Date(syncState.lastUpdate).toLocaleTimeString() : 'Never'}`}
            >
              <div className="flex items-center gap-2 text-xs">
                {syncState.status === 'syncing' ? (
                  <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                ) : syncState.status === 'error' ? (
                  <AlertCircle className="h-3 w-3 text-red-500" />
                ) : syncState.isConnected ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-gray-500" />
                )}
                <span className={`${
                  syncState.status === 'error' ? 'text-red-400' :
                  syncState.status === 'syncing' ? 'text-blue-400' :
                  syncState.isConnected ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {syncState.status === 'syncing' ? 'Syncing...' :
                   syncState.status === 'error' ? 'Sync Error' :
                   syncState.isConnected ? 'Real-time' : 'Offline'}
                </span>
                {syncState.updateCount > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({syncState.updateCount})
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`${isExecutiveMode ? 'w-full' : 'container mx-auto'} px-4 py-8 pt-24`}>
        <div className={`${isExecutiveMode ? 'w-full' : 'max-w-[1400px]'} mx-auto space-y-6`}>
          
          {/* Main Content Grid */}
          <div className={`grid grid-cols-1 ${isExecutiveMode ? 'lg:grid-cols-16' : 'lg:grid-cols-12'} gap-6`}>
            
            {/* Primary Content Column */}
            <div className={`${isExecutiveMode ? 'lg:col-span-16' : 'lg:col-span-9'} space-y-6`}>
              
              {/* National Portfolio Section - Replaces duplicate country card */}
              <CollapsibleSection
                id="national-portfolio"
                title="National Portfolio"
                icon={SectionIcons['national-profile']}
                badge="Core Identity"
                colorTheme="mycountry"
                priority="critical"
                purpose="Core country identification, demographics, and national presence"
                defaultExpanded={false}
                disableHeaderClick={true} // Disable header click because HolographicNationCard has interactive elements
              >
                <HolographicNationCard
                  country={country}
                  flagUrl={flagUrl}
                  isOwner={isOwner}
                  showInteractionControls={true}
                />
              </CollapsibleSection>

              {/* Executive Command Interface - Full width for executive mode */}
              {isExecutiveMode ? (
                <motion.div 
                  className="space-y-6 executive-enter"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="command-interface p-6">
                    {children}
                  </div>
                </motion.div>
              ) : (
                <>
                  {/* Excellence & Recognition */}
                  <CollapsibleSection
                    id="excellence-recognition"
                    title="Excellence & Recognition"
                    icon={SectionIcons['achievements-rankings']}
                    badge="Achievements"
                    colorTheme="analytics"
                    priority="high"
                    purpose="National achievements, international rankings, and recognition earned through development"
                    defaultExpanded={true}
                  >
                    <AchievementsRankings 
                      achievements={achievements}
                      rankings={rankings}
                    />
                  </CollapsibleSection>

                  {/* National Timeline */}
                  <CollapsibleSection
                    id="national-timeline"
                    title="National Development Timeline"
                    icon={SectionIcons['national-timeline']}
                    badge="Historical Progress"
                    colorTheme="intelligence"
                    priority="medium"
                    purpose="Historical progression, major milestones, and national development narrative"
                    defaultExpanded={false}
                  >
                    <div className="space-y-4">
                      {milestones.slice(0, 8).map((milestone, index) => (
                        <motion.div
                          key={milestone?.id && milestone.id.trim() ? `milestone-${milestone.id}` : `milestone-fallback-${index}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-start gap-4 p-4 rounded-lg glass-hierarchy-child"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mt-1 flex-shrink-0">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm mb-1">{milestone.title}</h4>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{milestone.description}</p>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-muted-foreground">
                                {new Date(milestone.achievedAt).toLocaleDateString()}
                              </span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-green-600 font-medium">{milestone.impact}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CollapsibleSection>

                  {/* Recent Activity */}
                  <CollapsibleSection
                    id="recent-activity"
                    title="Recent Activity"
                    icon={SectionIcons['recent-activity']}
                    badge="Live Updates"
                    colorTheme="global"
                    priority="medium"
                    purpose="Latest national developments, policy changes, and significant events"
                    defaultExpanded={false}
                  >
                    <div className="space-y-3">
                      {intelligenceFeed.slice(0, 6).map((item, index) => (
                        <motion.div
                          key={item?.id && item.id.trim() ? `activity-${item.id}` : `activity-fallback-${index}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-start gap-3 p-3 rounded-lg glass-hierarchy-child hover:bg-accent/5 transition-colors"
                        >
                          <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                            item.severity === 'critical' ? 'bg-red-500' :
                            item.severity === 'high' ? 'bg-orange-500' :
                            item.severity === 'medium' ? 'bg-yellow-500' :
                            'bg-blue-500'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <h5 className="font-medium text-sm mb-1 line-clamp-1">{item.title}</h5>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{item.description}</p>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">
                                {new Date(item.timestamp).toLocaleDateString()}
                              </span>
                              <Badge variant="outline" className="text-xs px-2 py-0">
                                {item.category}
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CollapsibleSection>
                </>
              )}
            </div>

            {/* Secondary Sidebar - Only show in non-executive mode and make narrower */}
            {!isExecutiveMode && (
              <div className="lg:col-span-3 space-y-6">

                {/* Vital National Statistics - Compact sidebar version */}
                <CollapsibleSection
                  id="vital-stats-sidebar"
                  title="Vital Statistics"
                  icon={SectionIcons['key-metrics']}
                  badge="Live Data"
                  colorTheme="analytics"
                  priority="critical"
                  purpose="Core performance metrics snapshot"
                  defaultExpanded={true}
                >
                  <div className="space-y-3">
                    <div className="text-center p-2 rounded-lg glass-hierarchy-child">
                      <StandardIcon icon={TrendingUp} size="sm" theme="analytics" className="mx-auto mb-1" />
                      <div className="text-sm font-bold">
                        ${(country.currentGdpPerCapita / 1000).toFixed(0)}k
                      </div>
                      <div className="text-xs text-muted-foreground">GDP/Capita</div>
                    </div>
                    <div className="text-center p-2 rounded-lg glass-hierarchy-child">
                      <StandardIcon icon={Users} size="sm" theme="global" className="mx-auto mb-1" />
                      <div className="text-sm font-bold">
                        {(country.currentPopulation / 1000000).toFixed(1)}M
                      </div>
                      <div className="text-xs text-muted-foreground">Population</div>
                    </div>
                    
                    {/* Compact Growth Indicators */}
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center">
                        <span>Economic</span>
                        <span className="text-green-600">
                          {country.adjustedGdpGrowth > 0 ? '+' : ''}{(country.adjustedGdpGrowth * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Population</span>
                        <span className="text-blue-600">
                          {country.populationGrowthRate > 0 ? '+' : ''}{(country.populationGrowthRate * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Tier</span>
                        <span className="text-purple-600 font-medium">{country.economicTier}</span>
                      </div>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* System Integration - Deeper in sidebar */}
                <CollapsibleSection
                  id="system-integration-sidebar"
                  title="System Status"
                  icon={SectionIcons['system-status']}
                  badge="IxStats"
                  colorTheme="intelligence"
                  priority="low"
                  purpose="System status and technical information"
                  defaultExpanded={false}
                >
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span>Updated</span>
                      <span className="text-muted-foreground">
                        {new Date(country.lastCalculated * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Baseline</span>
                      <span className="text-muted-foreground">
                        {new Date(country.baselineDate * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>IxTime</span>
                      <span className="text-amber-500">×{timeAcceleration}</span>
                    </div>
                  </div>
                </CollapsibleSection>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </TabThemeProvider>
  );
}

export default UnifiedLayout;