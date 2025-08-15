"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { useIxTime } from "~/contexts/IxTimeContext";
import { 
  DynamicIsland,
  DynamicContainer,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider
} from "./ui/dynamic-island";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useToast } from "~/components/ui/toast";
import { useNotificationStore } from "~/stores/notificationStore";
import { createUrl } from "~/lib/url-utils";
import { 
  Clock, 
  Globe, 
  Target,
  RefreshCw,
  Search,
  Bell,
  Command,
  ChevronDown,
  X,
  Settings,
  Plus,
  AlertTriangle,
  Monitor,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  Languages,
  Layout,
  Eye,
  CheckCircle,
  Info,
  BellRing,
  Users,
  AlertCircle,
  Crown,
  BarChart3,
  Activity,
  User,
  TrendingUp,
  Building2,
  Calendar
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "~/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { useUser } from "~/context/auth-context";
import { useTheme } from "~/context/theme-context";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { useExecutiveNotifications } from "~/contexts/ExecutiveNotificationContext";

interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
}

interface SearchResult {
  id: string;
  type: "country" | "command" | "feature";
  title: string;
  subtitle?: string;
  description?: string;
  metadata?: Record<string, any>;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

type ViewMode = "compact" | "search" | "notifications" | "settings" | "cycling";
type SearchFilter = "all" | "countries" | "commands" | "features";

function CommandPaletteContent({
  isExpanded = false,
  setIsExpanded,
  expandedMode,
  setExpandedMode,
  isSticky = false
}: {
  isExpanded?: boolean;
  setIsExpanded?: (expanded: boolean) => void;
  expandedMode?: ViewMode;
  setExpandedMode?: (mode: ViewMode) => void;
  isSticky?: boolean;
} = {}) {
  const { setSize } = useDynamicIslandSize();
  const [mode, setMode] = useState<ViewMode>("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("all");
  const [mounted, setMounted] = useState(false);
  // const [cyclingIndex, setCyclingIndex] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'time' | 'date' | 'clock'>('time');
  const { toast } = useToast();
  
  // Enhanced notification system integration
  const enhancedNotifications = useNotificationStore(state => state.notifications);
  const enhancedStats = useNotificationStore(state => state.stats);
  const markEnhancedAsRead = useNotificationStore(state => state.markAsRead);
  const markAllEnhancedAsRead = useNotificationStore(state => state.markAllAsRead);
  const recordEngagement = useNotificationStore(state => state.recordEngagement);
  const initialize = useNotificationStore(state => state.initialize);

  
  // Current time state
  const [currentTime, setCurrentTime] = useState({
    greeting: "Good morning",
    dateDisplay: "",
    timeDisplay: "",
    multiplier: 2.0,
  });


  const { user, isLoaded } = useUser();
  const { theme, effectiveTheme, setTheme, compactMode, toggleCompactMode } = useTheme();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );
  
  // User preferences state (excluding compactMode as it's now in theme context)
  const [userPreferences, setUserPreferences] = useState({
    soundEnabled: true,
    language: 'en',
    animations: true
  });

  // API queries - heavily optimized for performance
  const {
    data: countriesData,
    refetch: refetchCountries,
  } = api.countries.getAll.useQuery(undefined, {
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchInterval: false,
  });

  // Notifications - only fetch when absolutely necessary
  const shouldFetchNotifications = !!user?.id && (mode === 'notifications' || expandedMode === 'notifications');
  const {
    data: notificationsData,
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery({
    limit: 5, // Reduce from 10 to 5 for better performance
    unreadOnly: false,
    userId: user?.id,
  }, { 
    enabled: shouldFetchNotifications,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const markAsReadMutation = api.notifications.markAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
    },
  });

  const markAllAsReadMutation = api.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      void refetchNotifications();
      toast({
        type: "success",
        title: "All notifications marked as read",
      });
    },
  });

  // Helper functions
  const getGreeting = (ixTime: number): string => {
    const date = new Date(ixTime);
    const hour = date.getUTCHours();
    
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 21) return "Good evening";
    return "Good night";
  };

  const getDateDisplay = (ixTime: number): string => {
    const date = new Date(ixTime);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const weekdays = [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];

    const day = date.getUTCDate();
    const month = months[date.getUTCMonth()];
    const year = date.getUTCFullYear();
    const weekday = weekdays[date.getUTCDay()];

    return `${weekday}, ${month} ${day}, ${year}`;
  };

  const getTimeDisplay = (ixTime: number): string => {
    const date = new Date(ixTime);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${ampm}`;
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };
  const setupStatus = getSetupStatus();


  // Memoize commands to prevent recreation
  const commands = useMemo(() => [
    { name: "Dashboard", path: "/dashboard", icon: Target, description: "Main analytics dashboard" },
    { name: "Countries", path: "/countries", icon: Globe, description: "Browse all countries" },
    { name: "MyCountry®", path: "/mycountry/new", icon: Crown, description: "Your national dashboard and executive command center" },
    { name: "ECI", path: "/eci", icon: Target, description: "Executive Command Interface" },
    { name: "Builder", path: "/builder", icon: Plus, description: "Country builder tool" },
    { name: "Profile", path: "/profile", icon: Users, description: "User profile settings" },
    { name: "Admin", path: "/admin", icon: Settings, description: "Admin panel" },
  ], []);

  const features = useMemo(() => [
    { name: "Economic Analysis", path: "/dashboard", icon: BarChart3, description: "View detailed economic metrics and projections" },
    { name: "Strategic Planning", path: "/eci", icon: Target, description: "Access strategic planning tools" },
    { name: "Intelligence Reports", path: "/sdi", icon: Eye, description: "Strategic Defense Initiative reports" },
    { name: "Population Analytics", path: "/dashboard", icon: Activity, description: "Demographic and population insights" },
    { name: "Global Rankings", path: "/countries", icon: Crown, description: "Compare countries by various metrics" },
    { name: "Time Controls", path: "/admin", icon: Clock, description: "IxTime system management" },
  ], []);

  // Debounce search query for better performance
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Enhanced search functionality with filtering
  const searchResults = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return [];

    const query = debouncedSearchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Add countries - only if data is available and filter allows
    if ((searchFilter === "all" || searchFilter === "countries") && countriesData?.countries) {
      const countryResults = countriesData.countries
        .filter(country => country.name.toLowerCase().includes(query))
        .slice(0, searchFilter === "countries" ? 10 : 4)
        .map(country => ({
          id: country.id,
          type: "country" as const,
          title: country.name,
          subtitle: `${country.economicTier || 'Unknown'} • ${formatPopulation(country.currentPopulation || 0)}`,
          description: `GDP: ${formatCurrency(country.currentGdpPerCapita || 0)} per capita`,
          metadata: {
            economicTier: country.economicTier,
            population: country.currentPopulation,
            gdpPerCapita: country.currentGdpPerCapita,
            countryName: country.name
          },
          icon: Globe, // Will be replaced with flag in the UI
          action: () => {
            window.location.href = createUrl(`/countries/${country.id}`);
          }
        }));
      results.push(...countryResults);
    }

    // Add commands - only if filter allows
    if ((searchFilter === "all" || searchFilter === "commands") && commands.length > 0) {
      const commandResults = commands
        .filter(cmd => cmd.name.toLowerCase().includes(query) || cmd.description?.toLowerCase().includes(query))
        .slice(0, searchFilter === "commands" ? 10 : 3)
        .map(cmd => ({
          id: cmd.path,
          type: "command" as const,
          title: cmd.name,
          subtitle: cmd.description || `Navigate to ${cmd.name}`,
          description: `Page: ${cmd.path}`,
          icon: cmd.icon,
          action: () => {
            window.location.href = createUrl(cmd.path);
          }
        }));
      results.push(...commandResults);
    }

    // Add features - only if filter allows
    if ((searchFilter === "all" || searchFilter === "features") && features.length > 0) {
      const featureResults = features
        .filter(feature => feature.name.toLowerCase().includes(query) || feature.description?.toLowerCase().includes(query))
        .slice(0, searchFilter === "features" ? 10 : 3)
        .map(feature => ({
          id: feature.path + feature.name,
          type: "feature" as const,
          title: feature.name,
          subtitle: feature.description || `Access ${feature.name}`,
          description: `Available in: ${feature.path}`,
          icon: feature.icon,
          action: () => {
            window.location.href = createUrl(feature.path);
          }
        }));
      results.push(...featureResults);
    }

    return results.slice(0, searchFilter === "all" ? 8 : 12);
  }, [debouncedSearchQuery, searchFilter, countriesData, commands, features]);

  // Cycling between views (for future use)
  // const cyclingViews = ["notifications"];
  
  useEffect(() => {
    if (mode === "cycling" && !isUserInteracting) {
      const interval = setInterval(() => {
        // setCyclingIndex((prev) => (prev + 1) % cyclingViews.length);
      }, 4000); // Switch every 4 seconds

      return () => clearInterval(interval);
    }
  }, [mode, isUserInteracting]);

  // Use centralized time context instead of direct IxTime calls
  const { ixTimeTimestamp, multiplier: contextMultiplier } = useIxTime();
  
  // Time updates - using centralized context
  useEffect(() => {
    const greeting = getGreeting(ixTimeTimestamp);
    const dateDisplay = getDateDisplay(ixTimeTimestamp);
    const timeDisplay = getTimeDisplay(ixTimeTimestamp);

    setCurrentTime(prev => {
      // Only update if values actually changed
      if (prev.timeDisplay !== timeDisplay || prev.dateDisplay !== dateDisplay) {
        return { greeting, dateDisplay, timeDisplay, multiplier: contextMultiplier };
      }
      return prev;
    });
  }, [ixTimeTimestamp, contextMultiplier]);


  // Handle refresh - debounced to prevent spam
  const handleRefresh = useCallback(async () => {
    try {
      const promises: Promise<any>[] = [refetchCountries()];
      if (user?.id) {
        promises.push(refetchNotifications());
      }
      await Promise.allSettled(promises);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [refetchCountries, refetchNotifications, user?.id]);

  // Mode switching with dropdown behavior - debounced
  const switchMode = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    setIsUserInteracting(true);
    
    // Delivery context updates handled by notification system
    
    // Notification visibility handled by local state
    
    // Reset user interaction after 30 seconds
    const timeout = setTimeout(() => setIsUserInteracting(false), 30000);
    
    if (newMode === "compact") {
      setSize(SIZE_PRESETS.COMPACT_LONG);
      setIsExpanded?.(false);
    } else {
      setSize(SIZE_PRESETS.COMPACT_LONG); // Keep compact for navbar
      setIsExpanded?.(true);
      setExpandedMode?.(newMode);
    }
    
    return () => clearTimeout(timeout);
  }, [setSize, setIsExpanded, setExpandedMode]);

  // Start cycling mode after 10 seconds of inactivity
  useEffect(() => {
    if (mode === "compact" && !isUserInteracting) {
      const timeout = setTimeout(() => {
        switchMode("cycling");
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [mode, isUserInteracting, switchMode]);

  // Keyboard shortcuts - optimized with passive listeners
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            switchMode(mode === "search" ? "compact" : "search");
            break;
          case 'n':
            e.preventDefault();
            switchMode(mode === "notifications" ? "compact" : "notifications");
            break;
          case ',':
            e.preventDefault();
            switchMode(mode === "settings" ? "compact" : "settings");
            break;
        }
      }
      
      // Tab cycling for filters when in search mode
      if (e.key === 'Tab' && mode === 'search') {
        e.preventDefault();
        const filters: SearchFilter[] = ['all', 'countries', 'commands', 'features'];
        const currentIndex = filters.indexOf(searchFilter);
        const nextIndex = (currentIndex + 1) % filters.length;
        const nextFilter = filters[nextIndex];
        if (nextFilter) {
          setSearchFilter(nextFilter);
        }
      }
      
      if (e.key === 'Escape') {
        if (mode === 'search' && searchQuery) {
          setSearchQuery('');
          setSearchFilter('all');
        } else {
          switchMode("compact");
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, switchMode, searchFilter, searchQuery]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize notification store
  useEffect(() => {
    initialize().catch(console.error);
  }, [initialize]);

  // Auto-collapse when sticky and not interacting
  useEffect(() => {
    if (isSticky && !isUserInteracting) {
      const timer = setTimeout(() => setIsCollapsed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSticky, isUserInteracting]);

  // Get executive notifications context
  const { 
    notifications: executiveNotifications, 
    unreadCount: executiveUnreadCount, 
    isExecutiveMode,
    markAsRead: markExecutiveAsRead,
    markAllAsRead: markAllExecutiveAsRead
  } = useExecutiveNotifications();

  // Debug logging
  React.useEffect(() => {
    console.log('[CommandPalette] Executive mode:', isExecutiveMode);
    console.log('[CommandPalette] Executive notifications:', executiveNotifications);
    console.log('[CommandPalette] Executive unread count:', executiveUnreadCount);
  }, [isExecutiveMode, executiveNotifications, executiveUnreadCount]);

  const unreadNotifications = notificationsData?.unreadCount || 0;
  const enhancedUnreadCount = enhancedStats.unread || 0;
  const totalUnreadCount = unreadNotifications + (isExecutiveMode ? executiveUnreadCount : 0) + enhancedUnreadCount;

  // Get current cycling view (for potential future use)
  // const getCurrentCyclingMode = () => {
  //   if (mode !== "cycling") return mode;
  //   return cyclingViews[cyclingIndex] as ViewMode;
  // };

  // Render compact content for the navbar island
  const renderCompactContent = () => {
    if (!mounted) return null;

    return (
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
        <DynamicContainer 
          className={`flex items-center justify-center transition-all duration-500 ${ 
            isSticky && isCollapsed ? 'px-3 py-2' : 'px-6 py-3'
          } w-full gap-8`}
        >
          {/* IX Logo - Home Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => window.location.href = '/'}
                className={`relative group flex items-center justify-center rounded-md transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-white/10 ${ 
                  isSticky && isCollapsed ? 'w-10 h-10' : 'w-12 h-12'
                }`}
              >
                <img 
                  src="/ix-logo.svg" 
                  alt="IX Logo"
                  className={`${isSticky && isCollapsed ? 'w-6 h-6' : 'w-8 h-8'} transition-all duration-200 group-hover:scale-110 filter brightness-0 invert opacity-70 group-hover:opacity-100`}
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Home</p>
            </TooltipContent>
          </Tooltip>
          
          {/* Time Display - cycles through modes */}
          {(!isSticky || !isCollapsed) && (
            <button
              onClick={() => {
                setTimeDisplayMode(prev => 
                  prev === 'time' ? 'date' : 
                  prev === 'date' ? 'clock' : 'time'
                );
              }}
              className="flex items-center gap-1.5 hover:bg-white/10 px-2 py-1 rounded-md transition-colors cursor-pointer"
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
              {timeDisplayMode === 'clock' && (
                <div className="flex items-center gap-1.5">
                  <div className="relative w-4 h-4">
                    {/* Analog Clock */}
                    <div className="absolute inset-0 border border-blue-400/40 rounded-full">
                      {/* Hour markers */}
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="absolute w-0.5 h-1 bg-blue-400/30"
                          style={{
                            top: '1px',
                            left: '50%',
                            transformOrigin: '50% 7px',
                            transform: `translateX(-50%) rotate(${i * 30}deg)`,
                          }}
                        />
                      ))}
                      
                      {/* Hour hand */}
                      <div
                        className="absolute w-0.5 h-2 bg-blue-400 rounded-full"
                        style={{
                          top: '2px',
                          left: '50%',
                          transformOrigin: '50% 6px',
                          transform: `translateX(-50%) rotate(${(new Date(ixTimeTimestamp).getUTCHours() % 12) * 30 + (new Date(ixTimeTimestamp).getUTCMinutes() * 0.5)}deg)`,
                        }}
                      />
                      
                      {/* Minute hand */}
                      <div
                        className="absolute w-0.5 h-2.5 bg-blue-300 rounded-full"
                        style={{
                          top: '1.5px',
                          left: '50%',
                          transformOrigin: '50% 6.5px',
                          transform: `translateX(-50%) rotate(${new Date(ixTimeTimestamp).getUTCMinutes() * 6}deg)`,
                        }}
                      />
                      
                      {/* Center dot */}
                      <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-blue-400 rounded-full transform -translate-x-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <span className="text-xs font-medium text-foreground/80 leading-none">
                    {currentTime.timeDisplay}
                  </span>
                </div>
              )}
            </button>
          )}
          
          {/* Greeting - only show when not sticky */}
          {!isSticky && (
            <div className="flex items-center gap-2">
              <Popover>
                  <PopoverTrigger>
                    <div className="text-sm font-medium text-foreground cursor-pointer hover:bg-accent/10 px-2 py-1 rounded transition-colors text-center">
                      {currentTime.greeting}{user?.firstName ? `, ${user.firstName}` : ''}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="bottom" 
                  align="start"
                    className="w-96 p-4 bg-card/95 backdrop-blur-xl border-border rounded-xl shadow-2xl z-[10002]"
                  >
                    {setupStatus === 'complete' && userProfile?.country ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-border">
                          <Crown className="h-6 w-6 text-amber-400" />
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">Executive Dashboard</div>
                            <div className="text-sm text-gray-700 dark:text-gray-300">{userProfile.country.name}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <BarChart3 className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                            <div className="text-xs text-muted-foreground mb-1">Economic</div>
                            <div className="w-8 h-8 mx-auto bg-green-500/20 rounded-full flex items-center justify-center relative">
                              <div className="w-6 h-6 border-2 border-green-500/30 rounded-full absolute"></div>
                              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <Users className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                            <div className="text-xs text-muted-foreground mb-1">Social</div>
                            <div className="w-8 h-8 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center relative">
                              <div className="w-6 h-6 border-2 border-yellow-500/30 rounded-full absolute"></div>
                              <div className="w-5 h-5 bg-yellow-500 rounded-full"></div>
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-muted/30 rounded-lg">
                            <Activity className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                            <div className="text-xs text-muted-foreground mb-1">Security</div>
                            <div className="w-8 h-8 mx-auto bg-purple-500/20 rounded-full flex items-center justify-center relative">
                              <div className="w-6 h-6 border-2 border-purple-500/30 rounded-full absolute"></div>
                              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => userProfile?.country && (window.location.href = `/countries/${userProfile.country.id}`)}
                            className="flex-1 text-muted-foreground hover:text-foreground border hover:border-accent hover:bg-accent/10"
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            My Country
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = "/eci"}
                            className="flex-1 text-muted-foreground hover:text-foreground border hover:border-accent hover:bg-accent/10"
                          >
                            <Target className="h-4 w-4 mr-2" />
                            ECI
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
            </div>
          )}
          
          {/* Action buttons - icons only when sticky and collapsed */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("search")}
              className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center rounded-lg transition-all ${ 
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Search className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs leading-none">Search</span>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("notifications")}
              className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 relative flex items-center rounded-lg transition-all ${ 
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Bell className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs leading-none">Alerts</span>}
              {totalUnreadCount > 0 && (
                <Badge className={`absolute bg-destructive text-foreground flex items-center justify-center rounded-full text-[10px] ${ 
                  isSticky && isCollapsed ? '-top-1 -right-1 h-3 w-3 p-0' : '-top-1 -right-1 h-3 w-3 p-0'
                }`}>
                  {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("settings")}
              className={`text-muted-foreground hover:text-foreground hover:bg-accent/10 flex items-center rounded-lg transition-all ${ 
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Settings className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs leading-none">Settings</span>}
            </Button>
          </div>
        </DynamicContainer>
      </div>
    );
  };

  // Render expanded dropdown content
  const renderExpandedContent = () => {
    if (!mounted || !expandedMode) return null;

    const closeDropdown = () => switchMode("compact");

    switch (expandedMode) {
      case "search":
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-bold text-foreground flex items-center gap-3">
                <Command className="h-6 w-6 text-blue-400" />
                Command Palette
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDropdown}
                className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Search Filter Tabs */}
            <div className="flex items-center gap-2 mb-4">
              {(['all', 'countries', 'commands', 'features'] as SearchFilter[]).map((filter) => (
                <Button
                  key={filter}
                  size="sm"
                  variant={searchFilter === filter ? "default" : "ghost"}
                  onClick={() => setSearchFilter(filter)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${ 
                    searchFilter === filter 
                      ? 'bg-primary text-primary-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/10'
                  }`}
                >
                  {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
                  {filter === 'countries' && countriesData?.countries && (
                    <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px] h-4">
                      {countriesData.countries.length}
                    </Badge>
                  )}
                </Button>
              ))}
            
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={`Search ${searchFilter === 'all' ? 'everything' : searchFilter}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-16 py-3 bg-accent/10 border text-foreground placeholder:text-muted-foreground rounded-xl text-base focus:bg-accent/15 focus:border-blue-400 transition-all"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <kbd className="hidden md:inline-flex px-2 py-1 text-xs bg-muted rounded border-border text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>

            <ScrollArea className="max-h-96">
              {searchResults.length > 0 ? (
                <div className="space-y-3">
                  {searchResults.map((result) => (
                    <TooltipProvider key={result.id}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            onClick={result.action}
                            className="w-full justify-start gap-4 text-muted-foreground hover:text-foreground hover:bg-accent/10 p-4 rounded-xl transition-all group h-auto"
                          >
                            <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg group-hover:bg-accent/15 transition-colors shrink-0">
                              {result.type === 'country' && result.metadata?.countryName ? (
                                <SimpleFlag 
                                  countryName={result.metadata.countryName}
                                  className="w-6 h-4 rounded object-cover"
                                  showPlaceholder={true}
                                />
                              ) : (
                                result.icon && <result.icon className="h-5 w-5" />
                              )}
                            </div>
                            <div className="text-left flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <div className="font-medium text-base text-foreground break-words">
                                  {result.title}
                                </div>
                                <Badge 
                                  variant="secondary" 
                                  className={`px-2 py-0.5 text-[10px] h-5 ${ 
                                    result.type === 'country' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                                    result.type === 'command' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                                    'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                  }`}
                                >
                                  {result.type}
                                </Badge>
                              </div>
                              {result.subtitle && (
                                <div className="text-sm text-muted-foreground mb-1 break-words">
                                  {result.subtitle}
                                </div>
                              )}
                              {result.description && (
                                <div className="text-xs text-muted-foreground/70 break-words">
                                  {result.description}
                                </div>
                              )}
                            </div>
                            <div className="text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0">
                              <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                            </div>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-xs">
                          <div className="space-y-2">
                            <div className="font-medium">{result.title}</div>
                            {result.type === 'country' && result.metadata && (
                              <div className="text-sm space-y-1">
                                <div>Economic Tier: <span className="font-medium">{result.metadata.economicTier || 'Unknown'}</span></div>
                                <div>Population: <span className="font-medium">{formatPopulation(result.metadata.population || 0)}</span></div>
                                <div>GDP per Capita: <span className="font-medium">{formatCurrency(result.metadata.gdpPerCapita || 0)}</span></div>
                              </div>
                            )}
                            {result.type === 'command' && (
                              <div className="text-sm">
                                Navigate to the {result.title} page to access related features and tools.
                              </div>
                            )}
                            {result.type === 'feature' && (
                              <div className="text-sm">
                                {result.subtitle} Click to access this feature.
                              </div>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ))}
                </div>
              ) : debouncedSearchQuery ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-muted/30 rounded-2xl max-w-md mx-auto">
                    <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <div className="text-muted-foreground text-lg mb-2">No results found</div>
                    <div className="text-muted-foreground/70 text-sm break-words">
                      No {searchFilter === 'all' ? 'matches' : searchFilter} found for{' '}
                      <span className="font-mono bg-muted px-2 py-1 rounded">"{debouncedSearchQuery}"</span>
                    </div>
                    <div className="text-muted-foreground/50 text-xs mt-3">
                      {searchFilter === 'all' ? (
                        'Try searching for countries, commands, or features'
                      ) : searchFilter === 'countries' ? (
                        `Try a different country name. We have ${countriesData?.countries?.length || 0} countries available.`
                      ) : searchFilter === 'commands' ? (
                        'Try "dashboard", "countries", "mycountry", or other page names'
                      ) : (
                        'Try "economic analysis", "strategic planning", or other feature names'
                      )}
                    </div>
                    {searchFilter !== 'all' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSearchFilter('all')}
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        Search all categories instead
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-6 bg-gradient-to-b from-muted/30 to-muted/50 rounded-2xl max-w-md mx-auto">
                    <Command className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                    <div className="text-foreground text-lg mb-3">
                      Search {searchFilter === 'all' ? 'Everything' : searchFilter.charAt(0).toUpperCase() + searchFilter.slice(1)}
                    </div>
                    <div className="text-muted-foreground/70 text-sm mb-4">
                      {searchFilter === 'all' ? (
                        'Find countries, navigate to pages, or discover features'
                      ) : searchFilter === 'countries' ? (
                        `Search through ${countriesData?.countries?.length || 0} countries by name`
                      ) : searchFilter === 'commands' ? (
                        'Navigate to different pages and sections'
                      ) : (
                        'Discover tools and features across the platform'
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground/50">
                      <div className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-muted rounded border-border">⌘</kbd>
                        <span>+</span>
                        <kbd className="px-2 py-1 bg-muted rounded border-border">K</kbd>
                        <span>to search</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1">
                        <kbd className="px-2 py-1 bg-muted rounded border-border">Tab</kbd>
                        <span>to cycle filters</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        );

      case "notifications":
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-bold text-foreground flex items-center gap-3">
                <BellRing className="h-6 w-6 text-blue-400" />
                {isExecutiveMode ? 'Intelligence Center' : 'Notification Center'}
                {totalUnreadCount > 0 && (
                  <Badge className="bg-destructive text-foreground text-sm px-2 py-1 rounded-full">
                    {totalUnreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {totalUnreadCount > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (user?.id && unreadNotifications > 0) {
                        markAllAsReadMutation.mutate({ userId: user.id });
                      }
                      if (isExecutiveMode && executiveUnreadCount > 0) {
                        markAllExecutiveAsRead();
                      }
                      if (enhancedUnreadCount > 0) {
                        markAllEnhancedAsRead();
                      }
                    }}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-3 py-2"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark all read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={closeDropdown}
                  className="text-muted-foreground hover:text-foreground hover:bg-accent/10 px-2 py-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-72">
              {/* Enhanced notification system */}
              {(() => {
                const standardNotifications = notificationsData?.notifications || [];
                const validExecutiveNotifications = (executiveNotifications || []).filter((n: any) => n && n.id);
                const validEnhancedNotifications = enhancedNotifications.filter((n: any) => n && n.id);
                
                // Combine all notification sources and deduplicate by ID
                const allNotifications = [
                  ...validEnhancedNotifications.map(n => ({ ...n, source: 'enhanced' })),
                  ...(isExecutiveMode ? validExecutiveNotifications.map(n => ({ ...n, source: 'executive' })) : []),
                  ...standardNotifications.map(n => ({ ...n, source: 'standard' }))
                ].reduce((acc, notification) => {
                  const existingIndex = acc.findIndex(n => n.id === notification.id);
                  if (existingIndex === -1) {
                    acc.push(notification);
                  }
                  return acc;
                }, [] as any[])
                .sort((a: any, b: any) => {
                  // Sort by timestamp, newest first
                  const aTime = a.timestamp || a.createdAt || 0;
                  const bTime = b.timestamp || b.createdAt || 0;
                  return bTime - aTime;
                });
                
                return allNotifications.length > 0 ? (
                <div className="space-y-3">
                  {allNotifications.map((notification: any, index: number) => {
                    // Determine notification type and appropriate handling
                    const isEnhancedNotification = notification.source === 'enhanced';
                    const isExecutiveNotification = notification.source === 'executive';
                    
                    const IconComponent = isEnhancedNotification
                      ? ((notification as any).category === 'economic' ? TrendingUp :
                         (notification as any).category === 'diplomatic' ? Globe :
                         (notification as any).category === 'social' ? Users :
                         (notification as any).category === 'security' ? AlertTriangle :
                         (notification as any).category === 'governance' ? Building2 :
                         (notification as any).category === 'achievement' ? CheckCircle :
                         (notification as any).category === 'crisis' ? AlertCircle :
                         (notification as any).category === 'opportunity' ? TrendingUp :
                         Bell)
                      : isExecutiveNotification
                        ? ((notification as any).category === 'economic' ? TrendingUp :
                           (notification as any).category === 'diplomatic' ? Globe :
                           (notification as any).category === 'social' ? Users :
                           (notification as any).category === 'security' ? AlertTriangle :
                           (notification as any).category === 'governance' ? Building2 :
                           Bell)
                        : ((notification as any).type === "info" ? Info :
                           (notification as any).type === "warning" ? AlertTriangle :
                           (notification as any).type === "success" ? CheckCircle : 
                           (notification as any).type === "error" ? AlertCircle :
                           Bell);

                    return (
                      <div
                        key={notification.id ? `${notification.source}-${notification.id}` : `${notification.source}-fallback-${index}`}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:bg-accent/50 ${ 
                          (notification.status === 'read' || notification.read)
                            ? 'bg-muted/30 border' 
                            : 'bg-muted/50 border shadow-lg'
                        }`}
                        onClick={() => {
                          const isRead = notification.status === 'read' || notification.read;
                          
                          if (!isRead) {
                            if (isEnhancedNotification) {
                              markEnhancedAsRead(notification.id);
                              recordEngagement(notification.id, 'read');
                            } else if (isExecutiveNotification) {
                              markExecutiveAsRead(notification.id);
                            } else if (user?.id) {
                              markAsReadMutation.mutate({
                                notificationId: notification.id,
                                userId: user.id
                              });
                            }
                          }
                          
                          if ('href' in notification && notification.href) {
                            window.location.href = notification.href;
                          }
                          
                          if (isEnhancedNotification) {
                            recordEngagement(notification.id, 'click');
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${ 
                            isEnhancedNotification
                              ? ((notification as any).priority === 'critical' ? 'bg-red-500/20' :
                                 (notification as any).priority === 'high' ? 'bg-orange-500/20' :
                                 (notification as any).priority === 'medium' ? 'bg-yellow-500/20' :
                                 'bg-blue-500/20')
                              : isExecutiveNotification
                                ? ((notification as any).severity === 'critical' ? 'bg-red-500/20' :
                                   (notification as any).severity === 'high' ? 'bg-orange-500/20' :
                                   (notification as any).severity === 'medium' ? 'bg-yellow-500/20' :
                                   'bg-blue-500/20')
                              : ((notification as any).type === "info" ? "bg-blue-500/20" :
                                 (notification as any).type === "warning" ? "bg-yellow-500/20" :
                                 (notification as any).type === "success" ? "bg-green-500/20" :
                                 (notification as any).type === "error" ? "bg-destructive/20" :
                                 "bg-muted/50")
                          }`}>
                            <IconComponent className={`h-5 w-5 ${ 
                              isEnhancedNotification
                                ? ((notification as any).priority === 'critical' ? 'text-red-600 dark:text-red-400' :
                                   (notification as any).priority === 'high' ? 'text-orange-600 dark:text-orange-400' :
                                   (notification as any).priority === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                                   'text-blue-600 dark:text-blue-400')
                                : isExecutiveNotification
                                  ? ((notification as any).severity === 'critical' ? 'text-red-600 dark:text-red-400' :
                                     (notification as any).severity === 'high' ? 'text-orange-600 dark:text-orange-400' :
                                     (notification as any).severity === 'medium' ? 'text-yellow-600 dark:text-yellow-400' :
                                     'text-blue-600 dark:text-blue-400')
                                  : ((notification as any).type === "info" ? "text-blue-600 dark:text-blue-400" :
                                     (notification as any).type === "warning" ? "text-yellow-600 dark:text-yellow-400" :
                                     (notification as any).type === "success" ? "text-green-600 dark:text-green-400" :
                                     (notification as any).type === "error" ? "text-red-600 dark:text-red-400" :
                                     "text-muted-foreground")
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-base font-medium text-foreground break-words">
                                {notification.title}
                              </div>
                              {!(notification.status === 'read' || notification.read) && (
                                <div className="w-3 h-3 bg-primary rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                            {(notification.description || notification.message) && (
                              <div className="text-sm text-muted-foreground mt-2 break-words leading-relaxed">
                                {notification.description || notification.message}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-xs text-muted-foreground/70">
                                {isEnhancedNotification
                                  ? `${new Date((notification as any).timestamp).toLocaleString()} • Smart Alert`
                                  : isExecutiveNotification 
                                    ? `${new Date((notification as any).timestamp).toLocaleString()} • ${(notification as any).source}`
                                    : new Date((notification as any).createdAt).toLocaleString()}
                              </div>
                              <div className="flex items-center gap-2">
                                {(isEnhancedNotification || isExecutiveNotification) && (
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs px-2 py-0 ${ 
                                      isEnhancedNotification
                                        ? ((notification as any).priority === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                           (notification as any).priority === 'high' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                                           (notification as any).priority === 'medium' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                           'bg-blue-500/10 text-blue-600 dark:text-blue-400')
                                        : ((notification as any).severity === 'critical' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
                                           (notification as any).severity === 'high' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                                           (notification as any).severity === 'medium' ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                                           'bg-blue-500/10 text-blue-600 dark:text-blue-400')
                                    }`}
                                  >
                                    {isEnhancedNotification ? (notification as any).priority : (notification as any).severity}
                                  </Badge>
                                )}
                                {notification.href && (
                                  <div className="text-xs text-primary flex items-center gap-1">
                                    <span>View details</span>
                                    <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-6 bg-gradient-to-b from-white/5 to-white/10 rounded-2xl max-w-sm mx-auto">
                    <Bell className="h-16 w-16 mx-auto mb-4 text-white/30" />
                    <div className="text-muted-foreground text-lg mb-2">
                      {isExecutiveMode ? 'Intelligence Center Clear' : 'All caught up!'}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {isExecutiveMode 
                        ? 'No intelligence reports available. The situation is stable.'
                        : 'No notifications at this time. We\'ll notify you of important updates, economic changes, and system alerts.'
                      }
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-white/30 text-xs">
                      <CheckCircle className="h-4 w-4" />
                      <span>{isExecutiveMode ? 'Situation stable' : 'Stay tuned for updates'}</span>
                    </div>
                  </div>
                </div>
              );
              })()}
            </ScrollArea>
          </div>
        );

      case "settings":
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-bold text-foreground flex items-center gap-3">
                <Settings className="h-6 w-6 text-blue-400" />
                User Settings
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDropdown}
                className="text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              {/* Theme Switcher */}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
                <div className="p-1.5 bg-primary/20 rounded flex-shrink-0">
                  {effectiveTheme === 'dark' ? (
                    <Moon className="h-4 w-4 text-primary" />
                  ) : (
                    <Sun className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Theme</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant={theme === 'light' ? 'default' : 'outline'}
                    onClick={() => setTheme('light')}
                    className="p-1.5 h-7 w-7"
                  >
                    <Sun className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    onClick={() => setTheme('dark')}
                    className="p-1.5 h-7 w-7"
                  >
                    <Moon className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant={theme === 'system' ? 'default' : 'outline'}
                    onClick={() => setTheme('system')}
                    className="p-1.5 h-7 w-7"
                  >
                    <Monitor className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Sound Settings */}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
                <div className="p-1.5 bg-green-500/20 rounded flex-shrink-0">
                  {userPreferences.soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Sound Effects</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {userPreferences.soundEnabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUserPreferences(prev => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
                  className="px-2 py-1 text-xs"
                >
                  {userPreferences.soundEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>

              {/* Language Settings */}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
                <div className="p-1.5 bg-blue-500/20 rounded flex-shrink-0">
                  <Languages className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Language</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    English
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="px-3 py-1 cursor-not-allowed opacity-50"
                  disabled
                >
                  Coming Soon
                </Button>
              </div>

              {/* Layout Preferences */}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
                <div className="p-1.5 bg-purple-500/20 rounded flex-shrink-0">
                  <Layout className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Compact Mode</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {compactMode ? 'Enabled - Denser UI layout' : 'Disabled - Standard spacing'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={toggleCompactMode}
                  className="px-2 py-1 text-xs"
                >
                  {compactMode ? 'Disable' : 'Enable'}
                </Button>
              </div>

              {/* Animation Settings */}
              <div className="flex items-center gap-3 p-3 bg-card rounded-lg hover:bg-accent/10 transition-all border-border">
                <div className="p-1.5 bg-orange-500/20 rounded flex-shrink-0">
                  <Eye className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Animations</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {userPreferences.animations ? 'Enabled' : 'Reduced'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUserPreferences(prev => ({ ...prev, animations: !prev.animations }))}
                  className="px-2 py-1 text-xs"
                >
                  {userPreferences.animations ? 'Reduce' : 'Enable'}
                </Button>
              </div>

              {/* Quick Action Buttons */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh Data</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = createUrl("/profile")}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4" />
                  <span>Profile Settings</span>
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <DynamicIsland id="command-palette">
        {renderCompactContent()}
      </DynamicIsland>
      {/* Dropdown content - only on desktop */}
      {isExpanded && (
        <div className="hidden lg:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-[10002]">
          <div 
            className="command-palette-dropdown border-border dark:border-white/10 rounded-xl shadow-2xl overflow-hidden min-w-[500px] max-w-[800px] relative"
            style={{
              background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)",
              backdropFilter: "blur(20px) saturate(180%)",
              WebkitBackdropFilter: "blur(20px) saturate(180%)",
            }}
          >
            {/* Refraction border effects */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-transparent via-white/30 to-transparent" />
              <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-white/20 to-transparent" />
            </div>
            
            <div className="relative z-10">
              {renderExpandedContent()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CommandPalette({ className, isSticky }: CommandPaletteProps) {
  return (
    <div className={`w-full max-w-none flex items-center justify-center z-[10000] ${className || ''}`}>
      <DynamicIslandProvider initialSize={SIZE_PRESETS.COMPACT_LONG}>
        <CommandPaletteWrapper isSticky={isSticky} />
      </DynamicIslandProvider>
    </div>
  );
}

function CommandPaletteWrapper({ isSticky }: { isSticky?: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedMode, setExpandedMode] = useState<ViewMode>("search");
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsExpanded(false);
      }
    };

    if (isExpanded) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExpanded]);
  
  return (
    <div ref={wrapperRef} className="relative w-full">
      <CommandPaletteContent 
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        expandedMode={expandedMode}
        setExpandedMode={setExpandedMode}
        isSticky={isSticky}
      />
    </div>
  );
}
