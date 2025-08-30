import React, { useState, useEffect, useRef } from 'react';
import { 
  DynamicContainer,
} from "../ui/dynamic-island";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { 
  Clock, 
  Calendar, 
  Search,
  Bell,
  Settings,
  Crown,
  Target,
  User,
  BarChart3,
  Users,
  Activity
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";
import { SimpleFlag } from "../SimpleFlag";
import { formatCurrency } from "~/lib/chart-utils";
import { useUser } from "@clerk/nextjs";
import { useIxTime } from "~/contexts/IxTimeContext";
import { api } from "~/trpc/react";
import { useNotificationStore } from "~/stores/notificationStore";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";
import { useGlobalNotificationBridge } from "~/services/GlobalNotificationBridge";
import { usePermissions } from "~/hooks/usePermissions";
import type { CompactViewProps } from './types';

// Helper functions
const getGreeting = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hour = date.getUTCHours();
  
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
};

const getTimeDisplay = (ixTime: number): string => {
  const date = new Date(ixTime);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
};

export function CompactView({
  isSticky,
  isCollapsed,
  setIsCollapsed,
  setIsUserInteracting,
  timeDisplayMode,
  setTimeDisplayMode,
  onSwitchMode,
}: CompactViewProps) {
  const { user, isLoaded } = useUser();
  
  // Get user role information
  const { user: roleUser, permissions } = usePermissions();
  
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  const { ixTimeTimestamp } = useIxTime();
  const [mounted, setMounted] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const previousNotificationCountRef = useRef(0);
  
  // Current time state
  const [currentTime, setCurrentTime] = useState({
    greeting: "Good morning",
    timeDisplay: "",
  });


  // Enhanced notification system integration
  const enhancedStats = useNotificationStore(state => state.stats);
  const notifications = useNotificationStore(state => state.notifications);
  const { getStats } = useGlobalNotificationBridge();
  
  // Get executive notifications context
  const { 
    unreadCount: executiveUnreadCount, 
    isExecutiveMode,
  } = useExecutiveNotifications();
  
  // Get bridge statistics
  const bridgeStats = getStats();

  // Standard notifications count
  const {
    data: notificationsData,
  } = api.notifications.getUserNotifications.useQuery({
    limit: 5,
    unreadOnly: false,
    userId: user?.id,
  }, { 
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const liveNotificationCount = notifications.filter(n => n.status !== 'read' && n.status !== 'dismissed').length;
  const totalUnreadCount = unreadNotifications + (isExecutiveMode ? executiveUnreadCount : 0) + enhancedUnreadCount + liveNotificationCount;

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };
  const setupStatus = getSetupStatus();


  // Time updates
  useEffect(() => {
    const greeting = getGreeting(ixTimeTimestamp);
    const timeDisplay = getTimeDisplay(ixTimeTimestamp);

    setCurrentTime(prev => {
      if (prev.timeDisplay !== timeDisplay) {
        return { greeting, timeDisplay };
      }
      return prev;
    });
  }, [ixTimeTimestamp]);

  useEffect(() => {
    setMounted(true);
    console.log('[CompactView] Mounted with isSticky:', isSticky, 'isCollapsed:', isCollapsed);
    // Initialize previous count
    previousNotificationCountRef.current = totalUnreadCount;
  }, []);

  // Flash animation when new notifications arrive
  useEffect(() => {
    if (mounted && totalUnreadCount > previousNotificationCountRef.current) {
      console.log('[CompactView] New notification detected! Flashing dynamic island');
      setIsFlashing(true);
      
      // Stop flashing after animation completes
      const timeout = setTimeout(() => {
        setIsFlashing(false);
      }, 1000); // 1 second flash duration
      
      // Update the previous count
      previousNotificationCountRef.current = totalUnreadCount;
      
      return () => clearTimeout(timeout);
    } else if (mounted) {
      // Update count without flashing if count decreased (notifications dismissed)
      previousNotificationCountRef.current = totalUnreadCount;
    }
  }, [totalUnreadCount, mounted]);
  
  // Debug sticky state changes
  useEffect(() => {
    console.log('[CompactView] State change - isSticky:', isSticky, 'isCollapsed:', isCollapsed);
  }, [isSticky, isCollapsed]);

  // No scroll-based scaling - just transition between two states
  const sizeScale = 1;
  
  if (!mounted) return null;

  return (
    <TooltipProvider>
      <div
        onMouseEnter={() => {
          if (isSticky) {
            setIsCollapsed(false);
            setIsUserInteracting(true);
          }
        }}
        onMouseLeave={() => {
          if (isSticky) {
            setIsUserInteracting(false);
          }
        }}
      >
      <div 
        className="w-full h-full"
        style={{
          transform: `scale(${sizeScale})`,
          transformOrigin: 'center'
        }}
      >
        <DynamicContainer 
          className={`flex items-center justify-between transition-all duration-300 w-full min-h-fit h-auto ${
            isSticky ? 'px-3 py-2' : 'px-6 py-6'
          } ${isSticky ? 'w-auto' : 'w-full'} ${
            isFlashing ? 'animate-flash-notification' : ''
          }`}
        >
        {/* IX Logo - Home Button */}
        <div className="flex items-center justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.location.href = '/'}
                className={`relative group flex items-center justify-center rounded-xl transition-all duration-300 hover:scale-110 active:scale-95 ${ 
                  isSticky ? 'w-8 h-8' : 'w-10 h-10'
                }`}
              >
            {/* Gradient glow animation - only on hover */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/20 via-purple-500/30 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-400/10 via-indigo-500/20 to-purple-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
            
            <img 
              src="/images/ix-logo.svg" 
              alt="IxLogo"
              className={`relative z-10 ${isSticky ? 'w-6 h-6' : 'w-8 h-8'} transition-all duration-300 group-hover:scale-110 filter dark:brightness-0 dark:invert brightness-100 opacity-80 group-hover:opacity-100 group-hover:drop-shadow-lg`}
            />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Home
            </TooltipContent>
          </Tooltip>
        </div>
        
        {/* Time Display and Greeting - combined section */}
        <div className="flex-1 flex items-center justify-center" style={{ marginLeft: '10px' }}>
          {!isSticky && (
            <div className="flex flex-col items-center justify-center space-y-1">
            {/* Time Display - cycles through modes */}
            <button
              onClick={() => {
                const currentMode = timeDisplayMode;
                setTimeDisplayMode(currentMode === 'time' ? 'date' : currentMode === 'date' ? 'both' : 'time');
              }}
              className={`flex items-center justify-center ${isSticky ? 'gap-1' : 'gap-1.5'} hover:bg-white/10 ${isSticky ? 'px-2 py-1' : 'px-3 py-2'} rounded-md transition-colors cursor-pointer`}
            >
              {timeDisplayMode === 'time' && (
                <>
                  <Clock className="h-3 w-3 text-blue-400 opacity-70" />
                  <span className="text-xs font-medium text-foreground/80 leading-none">
                    {currentTime.timeDisplay}
                  </span>
                </>
              )}
              {timeDisplayMode === 'date' && (
                <>
                  <Calendar className="h-3 w-3 text-blue-400 opacity-70" />
                  <span className="text-xs font-medium text-foreground/80 leading-none">
                    {new Date(ixTimeTimestamp).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </span>
                </>
              )}
              {timeDisplayMode === 'both' && (
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-blue-400 opacity-70" />
                    <span className="text-xs font-semibold text-foreground/90 leading-none">
                      {currentTime.timeDisplay}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5 text-blue-400 opacity-60" />
                    <span className="text-[10px] text-foreground/70 leading-none">
                      {new Date(ixTimeTimestamp).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>
                </div>
              )}
            </button>
            
            {/* Greeting - only show when NOT sticky */}
            {!isSticky && (
              <Popover>
                <PopoverTrigger>
                  <div className={`relative group ${isSticky ? 'text-xs' : 'text-sm'} font-medium text-foreground cursor-pointer hover:bg-accent/10 rounded transition-colors flex items-center justify-center min-w-0 ${isSticky ? 'py-0.5 px-2' : 'py-1 px-3'}`}>
                    {/* Country flag background blur effect */}
                    {setupStatus === 'complete' && userProfile?.country && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-300 rounded overflow-hidden">
                        <SimpleFlag 
                          countryName={userProfile.country.name}
                          className="absolute inset-0 w-full h-full object-cover rounded opacity-30 blur-md scale-110"
                          showPlaceholder={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-background/60 via-transparent to-background/60 rounded" />
                      </div>
                    )}
                    <span className="relative z-10 text-center">
                      {currentTime.greeting}{user?.firstName ? `, ${user.firstName}` : ''}
                    </span>
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  side="bottom" 
                  align="center"
                  className="w-96 p-4 bg-card/95 backdrop-blur-xl border-border rounded-xl shadow-2xl z-[10002] mt-2"
                  sideOffset={8}
                >
                  {setupStatus === 'complete' && userProfile?.country ? (
                    <div className="space-y-6">
                      {/* Header with flag and country info */}
                      <div className="relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br from-amber-500/20 via-orange-500/10 to-yellow-500/15 dark:from-amber-500/10 dark:via-orange-500/5 dark:to-yellow-500/10 border border-amber-300/40 dark:border-amber-200/20">
                        <div className="absolute inset-0 opacity-40 dark:opacity-30">
                          <SimpleFlag 
                            countryName={userProfile.country.name}
                            className="w-full h-full object-cover blur-sm scale-110"
                            showPlaceholder={false}
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50 dark:from-black/40 dark:via-transparent dark:to-black/40" />
                        </div>
                        <div className="relative z-10 flex items-center gap-3">
                          <div className="p-2 bg-amber-500/30 dark:bg-amber-500/20 rounded-xl backdrop-blur-sm border border-amber-400/50 dark:border-amber-300/30">
                            <Crown className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div>
                            <div className="font-bold text-white drop-shadow-lg"> MyCountry Premium</div>
                            <div className="text-amber-200 dark:text-amber-100 text-sm font-medium">{userProfile.country.name}</div>
                          </div>
                          <div className="ml-auto">
                            <div className="text-xs text-amber-300 dark:text-amber-200 opacity-90 dark:opacity-80">GDP/Capita</div>
                            <div className="font-bold text-amber-200 dark:text-amber-100">{formatCurrency(userProfile.country.currentGdpPerCapita || 0)}</div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Live metrics with Apple-style indicators */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="group cursor-pointer text-center p-4 bg-gradient-to-br from-green-500/20 to-emerald-500/10 dark:from-green-500/10 dark:to-emerald-500/5 rounded-2xl border border-green-300/40 dark:border-green-200/20 hover:border-green-400/60 dark:hover:border-green-300/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                          <BarChart3 className="h-7 w-7 text-green-600 dark:text-green-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
                          <div className="text-xs text-green-700 dark:text-green-300 mb-2 font-medium">Economic Health</div>
                          <div className="relative w-10 h-10 mx-auto">
                            <div className="absolute inset-0">
                              <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-green-200/40 dark:text-green-900/20" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-green-600 dark:text-green-400" strokeWidth="3" strokeDasharray="85, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-green-700 dark:text-green-400">85%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="group cursor-pointer text-center p-4 bg-gradient-to-br from-blue-500/20 to-cyan-500/10 dark:from-blue-500/10 dark:to-cyan-500/5 rounded-2xl border border-blue-300/40 dark:border-blue-200/20 hover:border-blue-400/60 dark:hover:border-blue-300/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                          <Users className="h-7 w-7 text-blue-600 dark:text-blue-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
                          <div className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">Social Stability</div>
                          <div className="relative w-10 h-10 mx-auto">
                            <div className="absolute inset-0">
                              <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-blue-200/40 dark:text-blue-900/20" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-blue-600 dark:text-blue-400" strokeWidth="3" strokeDasharray="72, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-blue-700 dark:text-blue-400">72%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="group cursor-pointer text-center p-4 bg-gradient-to-br from-purple-500/20 to-indigo-500/10 dark:from-purple-500/10 dark:to-indigo-500/5 rounded-2xl border border-purple-300/40 dark:border-purple-200/20 hover:border-purple-400/60 dark:hover:border-purple-300/40 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                          <Activity className="h-7 w-7 text-purple-600 dark:text-purple-400 mx-auto mb-3 group-hover:scale-110 transition-transform duration-300" />
                          <div className="text-xs text-purple-700 dark:text-purple-300 mb-2 font-medium">Defense Status</div>
                          <div className="relative w-10 h-10 mx-auto">
                            <div className="absolute inset-0">
                              <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
                                <path className="text-purple-200/40 dark:text-purple-900/20" strokeWidth="3" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path className="text-purple-600 dark:text-purple-400" strokeWidth="3" strokeDasharray="91, 100" strokeLinecap="round" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-purple-700 dark:text-purple-400">91%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          size="sm"
                          onClick={() => userProfile?.country && (window.location.href = `/countries/${userProfile.country.id}`)}
                          className="group relative overflow-hidden bg-gradient-to-r from-amber-500/30 to-orange-500/25 dark:from-amber-500/20 dark:to-orange-500/20 hover:from-amber-500/40 hover:to-orange-500/35 dark:hover:from-amber-500/30 dark:hover:to-orange-500/30 border border-amber-400/50 dark:border-amber-300/30 hover:border-amber-500/70 dark:hover:border-amber-300/50 text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm"
                        >
                          <Crown className="h-4 w-4 mr-2 relative z-10" />
                          <span className="relative z-10 font-medium">Country Profile</span>
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => window.location.href = "/eci"}
                          className="group relative overflow-hidden bg-gradient-to-r from-blue-500/30 to-cyan-500/25 dark:from-blue-500/20 dark:to-cyan-500/20 hover:from-blue-500/40 hover:to-cyan-500/35 dark:hover:from-blue-500/30 dark:hover:to-cyan-500/30 border border-blue-400/50 dark:border-blue-300/30 hover:border-blue-500/70 dark:hover:border-blue-300/50 text-blue-800 dark:text-blue-200 hover:text-blue-900 dark:hover:text-blue-100 transition-all duration-300 hover:scale-105 hover:shadow-lg backdrop-blur-sm"
                        >
                          <Target className="h-4 w-4 mr-2 relative z-10" />
                          <span className="relative z-10 font-medium">Country Center</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <div className="p-4 bg-muted/30 rounded-xl">
                        <User className="h-12 w-12 mx-auto mb-3 text-blue-400" />
                        <div className="text-muted-foreground mb-2">Welcome!</div>
                        <div className="text-muted-foreground text-sm mb-4">Complete setup to access your executive dashboard</div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.location.href = "/setup"}
                          className="text-muted-foreground hover:text-foreground border-border hover:border-accent hover:bg-accent/10"
                        >
                          Complete Setup
                        </Button>
                      </div>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
            </div>
          )}
        </div>
        
        {/* Action buttons - icons only with hover tooltips */}
        <div className={`flex items-center justify-center ${isSticky ? 'gap-1' : 'gap-2'}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSwitchMode("search")}
                className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center justify-center rounded-lg transition-all ${ 
                  isSticky ? 'h-7 w-7 p-0' : 'h-8 w-8 p-0'
                }`}
              >
                <Search className={`transition-transform hover:scale-110 ${isSticky ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Search
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSwitchMode("notifications")}
                className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center justify-center rounded-lg transition-all ${ 
                  isSticky && isCollapsed ? 'h-8 w-8 p-0' : 'h-8 w-8 p-0'
                }`}
              >
                <Bell className={`transition-transform hover:scale-110 ${isSticky ? 'h-3 w-3' : 'h-4 w-4'}`} />
                {totalUnreadCount > 0 && (
                  <Badge className={`absolute animate-pulse bg-gradient-to-r from-red-500 to-pink-500 text-white flex items-center justify-center rounded-full text-[10px] border-0 shadow-lg ${ 
                    isSticky ? '-top-0.5 -right-0.5 h-2.5 w-2.5 p-0' : '-top-1 -right-1 h-3 w-3 p-0'
                  }`}>
                    {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Alerts
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSwitchMode("settings")}
                className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center justify-center rounded-lg transition-all ${ 
                  isSticky ? 'h-7 w-7 p-0' : 'h-8 w-8 p-0'
                }`}
              >
                <Settings className={`transition-transform hover:scale-110 ${isSticky ? 'h-3 w-3' : 'h-4 w-4'}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              Settings
            </TooltipContent>
          </Tooltip>
        </div>
      </DynamicContainer>
      </div>
      </div>
    </TooltipProvider>
  );
}