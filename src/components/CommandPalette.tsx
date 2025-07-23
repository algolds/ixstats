"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { 
  DynamicIsland,
  DynamicContainer,
  DynamicTitle,
  DynamicDescription,
  DynamicDiv,
  useDynamicIslandSize,
  SIZE_PRESETS,
  DynamicIslandProvider
} from "./ui/dynamic-island";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { ScrollArea } from "~/components/ui/scroll-area";
import { useToast } from "~/components/ui/toast";
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
  Zap,
  AlertTriangle,
  CheckCircle,
  Info,
  Calendar,
  BellRing,
  Users,
  AlertCircle,
  Crown,
  BarChart3,
  Activity,
  User
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider
} from "~/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { useUser } from "~/context/auth-context";

interface CommandPaletteProps {
  className?: string;
  isSticky?: boolean;
}

interface SearchResult {
  id: string;
  type: "country" | "command" | "page";
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

type ViewMode = "compact" | "search" | "notifications" | "settings" | "cycling";

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
  const [mounted, setMounted] = useState(false);
  // const [cyclingIndex, setCyclingIndex] = useState(0);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { toast } = useToast();
  
  // Current time state
  const [currentTime, setCurrentTime] = useState<{
    greeting: string;
    dateDisplay: string;
    timeDisplay: string;
    multiplier: number;
  }>({
    greeting: "Good morning",
    dateDisplay: "",
    timeDisplay: "",
    multiplier: 4.0,
  });

  // Bot status
  const [botStatus, setBotStatus] = useState<{
    available: boolean;
    message: string;
  }>({
    available: true,
    message: "Connected",
  });

  const { user, isLoaded } = useUser();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // API queries
  const {
    data: countriesData,
    refetch: refetchCountries,
  } = api.countries.getAll.useQuery();

  // Notifications
  const {
    data: notificationsData,
    refetch: refetchNotifications,
  } = api.notifications.getUserNotifications.useQuery({
    limit: 10,
    unreadOnly: false,
    userId: user?.id,
  }, { enabled: !!user?.id });

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
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes}:${seconds} ${ampm} ILT`;
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };
  const setupStatus = getSetupStatus();


  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const results: SearchResult[] = [];
    const query = searchQuery.toLowerCase();

    // Add countries
    if (countriesData?.countries) {
      countriesData.countries
        .filter(country => country.name.toLowerCase().includes(query))
        .slice(0, 5)
        .forEach(country => {
          results.push({
            id: country.id,
            type: "country",
            title: country.name,
            subtitle: `View ${country.name} details`,
            icon: Globe,
            action: () => {
              window.location.href = `/countries/${country.id}`;
            }
          });
        });
    }

    // Add commands
    const commands = [
      { name: "Dashboard", path: "/dashboard", icon: Target },
      { name: "Countries", path: "/countries", icon: Globe },
      { name: "Builder", path: "/builder", icon: Plus },
      { name: "Profile", path: "/profile", icon: Users },
      { name: "Settings", path: "/settings", icon: Settings },
    ];

    commands
      .filter(cmd => cmd.name.toLowerCase().includes(query))
      .forEach(cmd => {
        results.push({
          id: cmd.path,
          type: "command",
          title: cmd.name,
          subtitle: `Navigate to ${cmd.name}`,
          icon: cmd.icon,
          action: () => {
            window.location.href = cmd.path;
          }
        });
      });

    return results.slice(0, 8);
  }, [searchQuery, countriesData]);

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

  // Time updates
  useEffect(() => {
    const updateTime = () => {
      const currentIxTime = IxTime.getCurrentIxTime();
      const greeting = getGreeting(currentIxTime);
      const dateDisplay = getDateDisplay(currentIxTime);
      const timeDisplay = getTimeDisplay(currentIxTime);
      const multiplier = IxTime.getTimeMultiplier();

      setCurrentTime({
        greeting,
        dateDisplay,
        timeDisplay,
        multiplier,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Bot status check
  useEffect(() => {
    const checkBotStatus = async () => {
      try {
        const status = await IxTime.checkBotHealth();
        setBotStatus(status);
      } catch (error) {
        setBotStatus({
          available: false,
          message: "Connection failed",
        });
      }
    };

    checkBotStatus();
    const interval = setInterval(checkBotStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    try {
      await IxTime.syncWithBot();
      const healthStatus = await IxTime.checkBotHealth();
      setBotStatus(healthStatus);
      void refetchCountries();
      void refetchNotifications();
    } catch (error) {
      console.error('Refresh failed:', error);
      setBotStatus({
        available: false,
        message: "Sync failed",
      });
    }
  }, [refetchCountries, refetchNotifications]);

  // Mode switching with dropdown behavior
  const switchMode = useCallback((newMode: ViewMode) => {
    setMode(newMode);
    setIsUserInteracting(true);
    
    // Reset user interaction after 30 seconds
    setTimeout(() => setIsUserInteracting(false), 30000);
    
    if (newMode === "compact") {
      setSize(SIZE_PRESETS.COMPACT_LONG);
      setIsExpanded?.(false);
    } else {
      setSize(SIZE_PRESETS.COMPACT_LONG); // Keep compact for navbar
      setIsExpanded?.(true);
      setExpandedMode?.(newMode);
    }
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

  // Keyboard shortcuts
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
      if (e.key === 'Escape') {
        switchMode("compact");
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [mode, switchMode]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-collapse when sticky and not interacting
  useEffect(() => {
    if (isSticky && !isUserInteracting) {
      const timer = setTimeout(() => setIsCollapsed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isSticky, isUserInteracting]);

  const unreadNotifications = notificationsData?.unreadCount || 0;

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
          } w-full`}
        >
        <div className={`flex items-center transition-all duration-500 ${
          isSticky && isCollapsed ? 'gap-1' : 'gap-4'
        }`}>
          {/* Time - only show when not collapsed or not sticky */}
          {(!isSticky || !isCollapsed) && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger>
                  <div className="hover:bg-white/10 p-1 rounded transition-colors cursor-pointer">
                    <Clock className="h-4 w-4 text-blue-400" />
                  </div>
                </PopoverTrigger>
                <PopoverContent 
                  side="bottom" 
                  align="start"
                  className="w-80 p-4 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
                  style={{ zIndex: 9999 }}
                >
                  <div className="space-y-3">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-white mb-2">
                        It is {currentTime.dateDisplay}
                      </div>
                      <div className="text-xl font-bold text-blue-400">
                        The time is {currentTime.timeDisplay.replace(' ILT', '')}
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
              
              {/* Greeting - only show when not sticky */}
              {!isSticky && (
                <Popover>
                  <PopoverTrigger>
                    <div className="text-sm font-medium text-white cursor-pointer hover:bg-white/10 px-2 py-1 rounded transition-colors">
                      {currentTime.greeting}{user?.firstName ? `, ${user.firstName}` : ''}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent 
                    side="bottom" 
                    align="start"
                    className="w-96 p-4 bg-slate-800/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl"
                    style={{ zIndex: 9999 }}
                  >
                    {setupStatus === 'complete' && userProfile?.country ? (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-white/10">
                          <Crown className="h-6 w-6 text-amber-400" />
                          <div>
                            <div className="font-semibold text-white">Executive Dashboard</div>
                            <div className="text-sm text-white/60">{userProfile.country.name}</div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <BarChart3 className="h-6 w-6 text-blue-400 mx-auto mb-2" />
                            <div className="text-xs text-white/60 mb-1">Economic</div>
                            <div className="w-8 h-8 mx-auto bg-green-500/20 rounded-full flex items-center justify-center relative">
                              <div className="w-6 h-6 border-2 border-green-500/30 rounded-full absolute"></div>
                              <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <Users className="h-6 w-6 text-yellow-400 mx-auto mb-2" />
                            <div className="text-xs text-white/60 mb-1">Social</div>
                            <div className="w-8 h-8 mx-auto bg-yellow-500/20 rounded-full flex items-center justify-center relative">
                              <div className="w-6 h-6 border-2 border-yellow-500/30 rounded-full absolute"></div>
                              <div className="w-5 h-5 bg-yellow-500 rounded-full"></div>
                            </div>
                          </div>
                          
                          <div className="text-center p-3 bg-white/5 rounded-lg">
                            <Activity className="h-6 w-6 text-purple-400 mx-auto mb-2" />
                            <div className="text-xs text-white/60 mb-1">Security</div>
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
                            className="flex-1 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                          >
                            <Crown className="h-4 w-4 mr-2" />
                            My Country
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = "/eci"}
                            className="flex-1 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                          >
                            <Target className="h-4 w-4 mr-2" />
                            ECI
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="p-4 bg-white/5 rounded-xl">
                          <User className="h-12 w-12 mx-auto mb-3 text-blue-400" />
                          <div className="text-white/70 mb-2">Welcome!</div>
                          <div className="text-white/50 text-sm mb-4">Complete setup to access your executive dashboard</div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.location.href = "/setup"}
                            className="text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
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
          
          {/* Action buttons - icons only when sticky and collapsed */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("search")}
              className={`text-white/80 hover:text-white hover:bg-white/10 flex items-center rounded-lg transition-all ${
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Search className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs">Search</span>}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("notifications")}
              className={`text-white/80 hover:text-white hover:bg-white/10 relative flex items-center rounded-lg transition-all ${
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Bell className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs">Alerts</span>}
              {unreadNotifications > 0 && (
                <Badge className={`absolute bg-red-500 text-white flex items-center justify-center rounded-full text-[10px] ${
                  isSticky && isCollapsed ? '-top-1 -right-1 h-3 w-3 p-0' : '-top-1 -right-1 h-3 w-3 p-0'
                }`}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => switchMode("settings")}
              className={`text-white/80 hover:text-white hover:bg-white/10 flex items-center rounded-lg transition-all ${
                isSticky && isCollapsed ? 'h-6 w-6 p-0' : 'h-7 px-2 gap-1'
              }`}
            >
              <Settings className="h-3 w-3" />
              {(!isSticky || !isCollapsed) && <span className="text-xs">Settings</span>}
            </Button>
          </div>
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
              <div className="text-xl font-bold text-white flex items-center gap-3">
                <Command className="h-6 w-6 text-purple-400" />
                Command Palette
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDropdown}
                className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/60" />
              <Input
                placeholder="Search countries, commands, and features..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-4 py-3 bg-white/10 border-white/20 text-white placeholder:text-white/60 rounded-xl text-base focus:bg-white/15 focus:border-white/30 transition-all"
                autoFocus
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
                <kbd className="hidden md:inline-flex px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-white/60">
                  ⌘K
                </kbd>
              </div>
            </div>

            <ScrollArea className="max-h-64">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <Button
                      key={result.id}
                      variant="ghost"
                      onClick={result.action}
                      className="w-full justify-start gap-4 text-white/80 hover:text-white hover:bg-white/15 p-4 rounded-xl transition-all group"
                    >
                      <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                        {result.icon && <result.icon className="h-5 w-5" />}
                      </div>
                      <div className="text-left flex-1 min-w-0">
                        <div className="font-medium text-base text-white break-words">
                          {result.title}
                        </div>
                        {result.subtitle && (
                          <div className="text-sm text-white/60 mt-1 break-words">
                            {result.subtitle}
                          </div>
                        )}
                        <div className="text-xs text-white/40 mt-1 capitalize">
                          {result.type}
                        </div>
                      </div>
                      <div className="text-white/30 group-hover:text-white/60 transition-colors">
                        <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
                      </div>
                    </Button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-8">
                  <div className="p-4 bg-white/5 rounded-2xl max-w-md mx-auto">
                    <Search className="h-12 w-12 mx-auto mb-4 text-white/30" />
                    <div className="text-white/60 text-lg mb-2">No results found</div>
                    <div className="text-white/40 text-sm break-words">
                      No matches for <span className="font-mono bg-white/10 px-2 py-1 rounded">"{searchQuery}"</span>
                    </div>
                    <div className="text-white/30 text-xs mt-3">
                      Try searching for countries, commands, or features
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="p-6 bg-gradient-to-b from-white/5 to-white/10 rounded-2xl max-w-md mx-auto">
                    <Command className="h-16 w-16 mx-auto mb-4 text-white/30" />
                    <div className="text-white/70 text-lg mb-3">
                      Search Everything
                    </div>
                    <div className="text-white/50 text-sm space-y-2">
                      <div>• Find countries and their data</div>
                      <div>• Navigate to any page</div>
                      <div>• Access commands quickly</div>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-4 text-white/30 text-xs">
                      <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">⌘</kbd>
                      <span>+</span>
                      <kbd className="px-2 py-1 bg-white/10 rounded border border-white/20">K</kbd>
                      <span>to open anywhere</span>
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
              <div className="text-xl font-bold text-white flex items-center gap-3">
                <BellRing className="h-6 w-6 text-blue-400" />
                Notification Center
                {unreadNotifications > 0 && (
                  <Badge className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                    {unreadNotifications}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => user?.id && markAllAsReadMutation.mutate({ userId: user.id })}
                    disabled={markAllAsReadMutation.isPending}
                    className="text-white/80 hover:text-white hover:bg-white/10 px-3 py-2"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Mark all read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={closeDropdown}
                  className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-72">
              {notificationsData?.notifications && notificationsData.notifications.length > 0 ? (
                <div className="space-y-3">
                  {notificationsData.notifications.map((notification) => {
                    const IconComponent = 
                      notification.type === "info" ? Info :
                      notification.type === "warning" ? AlertTriangle :
                      notification.type === "success" ? CheckCircle : 
                      notification.type === "error" ? AlertCircle :
                      Bell;

                    return (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-xl border cursor-pointer transition-all hover:bg-white/15 ${
                          notification.read 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-white/10 border-white/20 shadow-lg'
                        }`}
                        onClick={() => {
                          if (!notification.read && user?.id) {
                            markAsReadMutation.mutate({ 
                              notificationId: notification.id,
                              userId: user.id
                            });
                          }
                          if (notification.href) {
                            window.location.href = notification.href;
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`p-2 rounded-lg flex-shrink-0 ${
                            notification.type === "info" ? "bg-blue-500/20" :
                            notification.type === "warning" ? "bg-yellow-500/20" :
                            notification.type === "success" ? "bg-green-500/20" :
                            notification.type === "error" ? "bg-red-500/20" :
                            "bg-white/10"
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              notification.type === "info" ? "text-blue-300" :
                              notification.type === "warning" ? "text-yellow-300" :
                              notification.type === "success" ? "text-green-300" :
                              notification.type === "error" ? "text-red-300" :
                              "text-white/70"
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-base font-medium text-white break-words">
                                {notification.title}
                              </div>
                              {!notification.read && (
                                <div className="w-3 h-3 bg-blue-400 rounded-full flex-shrink-0 mt-1" />
                              )}
                            </div>
                            {notification.description && (
                              <div className="text-sm text-white/70 mt-2 break-words leading-relaxed">
                                {notification.description}
                              </div>
                            )}
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-xs text-white/50">
                                {new Date(notification.createdAt).toLocaleString()}
                              </div>
                              {notification.href && (
                                <div className="text-xs text-blue-300 flex items-center gap-1">
                                  <span>View details</span>
                                  <ChevronDown className="h-3 w-3 rotate-[-90deg]" />
                                </div>
                              )}
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
                    <div className="text-white/70 text-lg mb-2">All caught up!</div>
                    <div className="text-white/50 text-sm">
                      No notifications at this time. We'll notify you of important updates, 
                      economic changes, and system alerts.
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-white/30 text-xs">
                      <CheckCircle className="h-4 w-4" />
                      <span>Stay tuned for updates</span>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        );

      case "settings":
        return (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="text-xl font-bold text-white flex items-center gap-3">
                <Settings className="h-6 w-6 text-cyan-400" />
                System Settings
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={closeDropdown}
                className="text-white/80 hover:text-white hover:bg-white/10 px-2 py-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
              <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/15 transition-all">
                <div className="p-2 bg-yellow-500/20 rounded-lg flex-shrink-0">
                  <Zap className="h-6 w-6 text-yellow-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/90 break-words">Discord Bot Status</div>
                  <div className="text-lg font-bold text-white break-words">
                    {botStatus.available ? "Connected" : "Disconnected"}
                  </div>
                  <div className="text-xs text-yellow-300 break-words">{botStatus.message}</div>
                </div>
                <Badge className={`${botStatus.available ? "bg-green-500" : "bg-red-500"} text-white px-3 py-1 rounded-full`}>
                  {botStatus.available ? "Online" : "Offline"}
                </Badge>
              </div>

              <div className="flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/15 transition-all">
                <div className="p-2 bg-blue-500/20 rounded-lg flex-shrink-0">
                  <Clock className="h-6 w-6 text-blue-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/90 break-words">Time Acceleration</div>
                  <div className="text-lg font-bold text-white">
                    {currentTime.multiplier}x Speed
                  </div>
                  <div className="text-xs text-blue-300">Real-time multiplier</div>
                </div>
              </div>

              <div className="lg:col-span-2 flex items-center gap-4 p-4 bg-white/10 rounded-xl hover:bg-white/15 transition-all">
                <div className="p-2 bg-purple-500/20 rounded-lg flex-shrink-0">
                  <Calendar className="h-6 w-6 text-purple-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white/90">Current IxTime Date</div>
                  <div className="text-lg font-bold text-white break-words">
                    {currentTime.dateDisplay}
                  </div>
                  <div className="text-xs text-purple-300 break-words">Game world timeline synchronized with Discord bot</div>
                </div>
              </div>

              {/* Quick Action Buttons */}
              <div className="lg:col-span-2 grid grid-cols-2 gap-3 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Sync Data</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = "/admin"}
                  className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
                >
                  <Settings className="h-4 w-4" />
                  <span>Full Settings</span>
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
        <div className="hidden lg:block absolute top-full left-1/2 transform -translate-x-1/2 mt-2 z-50">
          <div className="bg-gradient-to-r from-slate-800/95 via-slate-700/95 to-slate-800/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden min-w-[500px] max-w-[800px]">
            {renderExpandedContent()}
          </div>
        </div>
      )}
    </>
  );
}

export function CommandPalette({ className, isSticky }: CommandPaletteProps) {
  return (
    <div className={`w-full max-w-none flex items-center justify-center ${className || ''}`}>
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