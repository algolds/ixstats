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
  CheckCircle,
  Menu,
  X,
  Smartphone,
  Monitor
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
// Component imports removed - content is now handled by children
import { MobileOptimized, useTouchGestures, useMobilePerformance } from './MobileOptimizations';

interface DataSyncState {
  isConnected: boolean;
  lastUpdate: number;
  updateCount: number;
  errors: string[];
  status: 'idle' | 'syncing' | 'error' | 'disconnected';
}

interface MobileLayoutState {
  isMobileView: boolean;
  isSidebarOpen: boolean;
  activeTab: string | null;
  expandedSections: Set<string>;
  touchInteractionEnabled: boolean;
}

// Custom hook for mobile detection and management
function useMobileLayout() {
  const [mobileState, setMobileState] = useState<MobileLayoutState>({
    isMobileView: false,
    isSidebarOpen: false,
    activeTab: null,
    expandedSections: new Set(),
    touchInteractionEnabled: false
  });

  useEffect(() => {
    const checkMobile = () => {
      const isMobile = window.innerWidth < 768;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      
      setMobileState(prev => ({
        ...prev,
        isMobileView: isMobile,
        touchInteractionEnabled: isTouchDevice,
        // Auto-close sidebar on resize to desktop
        isSidebarOpen: isMobile ? prev.isSidebarOpen : false
      }));
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    setMobileState(prev => ({
      ...prev,
      isSidebarOpen: !prev.isSidebarOpen
    }));
  };

  const setActiveTab = (tab: string | null) => {
    setMobileState(prev => ({
      ...prev,
      activeTab: tab,
      isSidebarOpen: false // Close sidebar when selecting tab on mobile
    }));
  };

  const toggleSection = (sectionId: string) => {
    setMobileState(prev => {
      const newExpanded = new Set(prev.expandedSections);
      if (newExpanded.has(sectionId)) {
        newExpanded.delete(sectionId);
      } else {
        newExpanded.add(sectionId);
      }
      return {
        ...prev,
        expandedSections: newExpanded
      };
    });
  };

  return {
    mobileState,
    toggleSidebar,
    setActiveTab,
    toggleSection
  };
}

// Mobile Section Navigator Component
interface MobileSectionNavigatorProps {
  sections: ContentSection[];
  onSectionSelect: (sectionId: string) => void;
  expandedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
}

function MobileSectionNavigator({ 
  sections, 
  onSectionSelect, 
  expandedSections, 
  onToggleSection 
}: MobileSectionNavigatorProps) {
  return (
    <div className="p-4 space-y-2">
      <div className="text-sm font-medium text-foreground/60 mb-4">
        Navigation
      </div>
      
      {sections.map((section) => {
        const Icon: React.ComponentType<any> = (SectionIcons[section.id as keyof typeof SectionIcons] as React.ComponentType<any> | undefined) || Activity;
        const isExpanded = expandedSections.has(section.id);
        
        return (
          <div key={section.id || `section-fallback-${sections.indexOf(section)}`} className="space-y-1">
            <Button
              onClick={() => onSectionSelect(section.id)}
              variant="ghost"
              className="w-full justify-start p-3 h-auto"
            >
              <Icon className="h-4 w-4 mr-3 flex-shrink-0" />
              <div className="flex-1 text-left">
                <div className="text-sm font-medium">{section.title}</div>
                <div className="text-xs text-foreground/60">{section.purpose}</div>
              </div>
              {section.priority === 'critical' && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  Critical
                </Badge>
              )}
            </Button>
          </div>
        );
      })}
      
      <div className="pt-4 border-t border-border mt-6">
        <div className="text-xs text-foreground/50 px-3">
          Touch-optimized interface
        </div>
      </div>
    </div>
  );
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
  icon,
  badge,
  children,
  defaultExpanded = false,
  colorTheme = 'mycountry',
  className = '',
  priority = 'medium',
  purpose,
  disableHeaderClick = false
}: CollapsibleSectionProps) {
  const Icon: React.ComponentType<any> = icon as React.ComponentType<any>;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isMobile, setIsMobile] = useState(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
      {/* Section Header - Mobile Enhanced */}
      <motion.div
        className={`glass-hierarchy-child ${isMobile ? 'p-3' : 'p-4'} ${!disableHeaderClick ? 'cursor-pointer' : ''} ${isMobile ? 'touch-manipulation' : ''}`}
        onClick={!disableHeaderClick ? toggleExpanded : undefined}
        whileHover={!disableHeaderClick ? { backgroundColor: "rgba(255, 255, 255, 0.05)" } : undefined}
        whileTap={isMobile && !disableHeaderClick ? { scale: 0.98 } : undefined}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg glass-hierarchy-interactive">
              <Icon className="h-5 w-5" />
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
                  <span className="text-xs text-muted-foreground">
                    {purpose}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Section Content */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="glass-hierarchy-child p-4 pt-0">
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
  const { mobileState, toggleSidebar, setActiveTab, toggleSection } = useMobileLayout();
  const { isMobileView, isSidebarOpen, touchInteractionEnabled } = mobileState;

  return (
    <TabThemeProvider defaultTheme={isExecutiveMode ? 'executive' : 'mycountry'}>
      <MobileOptimized enableTouchGestures={isMobileView}>
        <div 
          className={`relative min-h-screen bg-background ${isExecutiveMode ? 'executive-immersive' : ''} ${className}`}
          style={applyTabTheme(isExecutiveMode ? 'executive' : 'mycountry')}
        >
      
          {/* Mobile Header Bar */}
          {isMobileView && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border"
            >
              <div className="flex items-center justify-between px-4 h-14">
                <Button
                  onClick={toggleSidebar}
                  variant="ghost"
                  size="sm"
                  className="p-2"
                >
                  {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </Button>
                
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-foreground/80">
                    {country?.name || 'My Country'}
                  </div>
                  {touchInteractionEnabled && (
                    <Smartphone className="h-4 w-4 text-foreground/60" />
                  )}
                </div>
                
                {isOwner && (
                  <Button
                    onClick={() => onModeToggle(isExecutiveMode ? 'public' : 'executive')}
                    variant="ghost"
                    size="sm"
                    className="p-2"
                  >
                    {isExecutiveMode ? (
                      <Globe className="h-4 w-4" />
                    ) : (
                      <Crown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Mobile Sidebar Overlay */}
          <AnimatePresence>
            {isMobileView && isSidebarOpen && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-black/50"
                  onClick={toggleSidebar}
                />
                <motion.div
                  initial={{ x: -300 }}
                  animate={{ x: 0 }}
                  exit={{ x: -300 }}
                  transition={{ type: "spring", damping: 25, stiffness: 200 }}
                  className="fixed left-0 top-14 bottom-0 z-50 w-80 bg-background border-r border-border overflow-y-auto"
                >
                  <MobileSectionNavigator
                    sections={CONTENT_HIERARCHY}
                    onSectionSelect={setActiveTab}
                    expandedSections={mobileState.expandedSections}
                    onToggleSection={toggleSection}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Mode Toggle Button */}
          {isOwner && !isMobileView && (
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
            {!isExecutiveMode && !isMobileView && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4, delay: 0.2 }}
                className="fixed top-4 right-4 z-40"
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

          {/* Data Sync Status Indicator */}
          {syncState && syncState.status !== 'idle' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={`fixed top-4 ${isOwner ? 'left-1/2 transform -translate-x-1/2' : 'left-4'} z-40`}
            >
              <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs glass-hierarchy-child ${
                syncState.status === 'syncing' ? 'text-blue-400' :
                syncState.status === 'error' ? 'text-red-400' :
                syncState.status === 'disconnected' ? 'text-amber-400' : ''
              }`}>
                {syncState.status === 'syncing' && <RefreshCw className="h-3 w-3 animate-spin" />}
                {syncState.status === 'error' && <AlertCircle className="h-3 w-3" />}
                {syncState.status === 'disconnected' && <WifiOff className="h-3 w-3" />}
                <span>
                  {syncState.status === 'syncing' && 'Syncing...'}
                  {syncState.status === 'error' && 'Sync Error'}
                  {syncState.status === 'disconnected' && 'Disconnected'}
                </span>
              </div>
            </motion.div>
          )}

          <div className={`w-full px-6 py-8 ${isMobileView ? 'pt-20' : 'pt-24'}`}>
            <div className="w-full mx-auto space-y-6">
              
              {/* Full Width Content */}
              <div className="w-full">
                {/* All content is now handled by children (PublicMyCountryPage or ExecutiveDashboard) */}
                {children}
              </div>

          {/* Time & Status Panel - Bottom right for executive mode */}
          {isExecutiveMode && (
            <div className="fixed bottom-4 right-4 z-30">
              <CollapsibleSection
                id="time-status"
                title="Time & Status"
                icon={Activity}
                badge="System Status"
                colorTheme="executive"
                priority="low"
                purpose="Current time and system status information"
                defaultExpanded={false}
                className="min-w-[280px]"
              >
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span>Last Updated</span>
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
      </MobileOptimized>
    </TabThemeProvider>
  );
}

export default UnifiedLayout;