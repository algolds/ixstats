"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { useIxTime } from "~/contexts/IxTimeContext";
import { formatCurrency, formatPopulation, formatGrowthRateFromDecimal } from "~/lib/chart-utils";
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
import { createUrl } from "~/lib/url-utils";
import { 
  Clock, 
  Globe, 
  TrendingUp, 
  Users, 
  DollarSign, 
  Building2, 
  MapPin, 
  Activity, 
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
  CheckCircle,
  Info,
  Crown,
  AlertCircle,
  Home,
  User,
  LogOut,
  BarChart3,
  PieChart,
  LineChart,
  TrendingDown
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import CountryFlag from "~/app/_components/CountryFlag";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

interface GlobalStatsIslandProps {
  className?: string;
}

interface Notification {
  id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
}

interface SearchResult {
  id: string;
  type: "country" | "command" | "page";
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
}

function GlobalStatsIslandContent() {
  const { setSize } = useDynamicIslandSize();
  const [mode, setMode] = useState<"compact" | "stats" | "search" | "notifications" | "mycountry">("compact");
  const [searchQuery, setSearchQuery] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
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
    multiplier: 2.0,
  });


  const { user, isLoaded } = useUser();
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );
  const [showUserPopover, setShowUserPopover] = useState(false);

  // API queries
  const {
    data: globalStatsData,
    isLoading: globalStatsLoading,
  } = api.countries.getGlobalStats.useQuery();

  const {
    data: countriesData,
  } = api.countries.getAll.useQuery();

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
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds} ILT`;
  };

  const getSetupStatus = () => {
    if (!isLoaded || profileLoading) return 'loading';
    if (!user) return 'unauthenticated';
    if (!userProfile?.countryId) return 'needs-setup';
    return 'complete';
  };
  const setupStatus = getSetupStatus();

  // Process global stats data
  const globalStats = useMemo(() => {
    if (!globalStatsData || typeof globalStatsData !== 'object') return null;
    
    const data = globalStatsData as any;
    return {
      timestamp: data.ixTimeTimestamp || Date.now(),
      totalPopulation: data.totalPopulation || 0,
      totalGdp: data.totalGdp || 0,
      averageGdpPerCapita: data.averageGdpPerCapita || 0,
      countryCount: data.totalCountries || 0,
      economicTierDistribution: data.economicTierDistribution || {},
      populationTierDistribution: data.populationTierDistribution || {},
      averagePopulationDensity: data.averagePopulationDensity || 0,
      averageGdpDensity: data.averageGdpDensity || 0,
      globalGrowthRate: data.globalGrowthRate || 0,
      ixTimeTimestamp: data.ixTimeTimestamp || Date.now(),
    };
  }, [globalStatsData]);

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
            subtitle: `${formatCurrency(country.currentGdpPerCapita || 0)} per capita`,
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
      { name: "MyCountry®", path: "/mycountry", icon: Crown },
      { name: "ECI", path: "/eci", icon: Target },
      { name: "Builder", path: "/builder", icon: Plus },
      { name: "Profile", path: "/profile", icon: Users },
      { name: "Admin", path: "/admin", icon: Settings },
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

  // Mock notifications
  useEffect(() => {
    const mockNotifications: Notification[] = [
      {
        id: "1",
        type: "info",
        title: "Global Economic Update",
        message: "World GDP increased by 2.1% this quarter",
        timestamp: Date.now() - 300000, // 5 minutes ago
        read: false
      },
      {
        id: "2", 
        type: "success",
        title: "System Sync Complete",
        message: "All economic data synchronized successfully",
        timestamp: Date.now() - 900000, // 15 minutes ago
        read: false
      },
      {
        id: "3",
        type: "warning",
        title: "Market Volatility Alert", 
        message: "Unusual fluctuations detected in 3 markets",
        timestamp: Date.now() - 1800000, // 30 minutes ago
        read: true
      }
    ];
    setNotifications(mockNotifications);
  }, []);

  // Use centralized time context instead of direct IxTime calls
  const { ixTimeTimestamp, multiplier: contextMultiplier } = useIxTime();
  
  // Time updates
  useEffect(() => {
    const updateTime = () => {
      const greeting = getGreeting(ixTimeTimestamp);
      const dateDisplay = getDateDisplay(ixTimeTimestamp);
      const timeDisplay = getTimeDisplay(ixTimeTimestamp);

      setCurrentTime({
        greeting,
        dateDisplay,
        timeDisplay,
        multiplier: contextMultiplier,
      });
    };

    updateTime();
  }, [ixTimeTimestamp, contextMultiplier]);


  // Mode switching with size changes
  const switchMode = useCallback((newMode: typeof mode) => {
    setMode(newMode);

    switch (newMode) {
      case "compact":
        setSize(SIZE_PRESETS.COMPACT);
        break;
      case "stats":
        setSize(SIZE_PRESETS.LARGE);
        break;
      case "search":
        setSize(SIZE_PRESETS.MEDIUM);
        // Focus the search input after the component re-renders
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
            searchInputRef.current.select();
          }
        }, 100);
        break;
      case "notifications":
        setSize(SIZE_PRESETS.TALL);
        break;
      case "mycountry":
        setSize(SIZE_PRESETS.MEDIUM);
        break;
    }
  }, [setSize]);


  // Removed global keyboard shortcuts to prevent conflicts with universal command palette
  // The DynamicIsland command palette now handles all global keyboard shortcuts

  useEffect(() => {
    setMounted(true);
  }, []);

  const unreadNotifications = notifications.filter(n => !n.read).length;

  // Render different modes
  const renderContent = () => {
    if (!mounted) return null;

    switch (mode) {
      case "compact":
        return (
          <DynamicContainer className="flex items-center justify-between px-3 py-2 w-fit min-w-0 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {/* Time and greeting */}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 md:h-5 md:w-5 text-white/80 flex-shrink-0" />
                <div className="text-xs md:text-sm min-w-0 truncate">
                  <span className="font-medium truncate">{currentTime.timeDisplay}</span>
                  <span className="text-white/70 ml-1 truncate">{currentTime.greeting}</span>
                </div>
              </div>
              
              {/* Greeting with Executive Dashboard */}
              <Popover>
                <PopoverTrigger className="text-xs md:text-sm text-white/70 hover:text-white cursor-pointer hover:bg-white/5 px-2 py-1 rounded-md transition-colors truncate">
                  {currentTime.greeting}{user?.firstName ? `, ${user.firstName}` : ''}
                </PopoverTrigger>
                <PopoverContent side="bottom" className="w-96 p-4 z-[10002]">
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
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => switchMode("search")}
                className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <Search className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => switchMode("notifications")}
                className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10 relative flex items-center justify-center"
              >
                <Bell className="h-3 w-3 md:h-4 md:w-4" />
                {unreadNotifications > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs bg-red-500 text-white flex items-center justify-center">
                    {unreadNotifications}
                  </Badge>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => switchMode("stats")}
                className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center"
              >
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
              {setupStatus === 'complete' && userProfile?.country && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => switchMode("mycountry")}
                  className="h-6 w-6 p-0 text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center"
                >
                  <Crown className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              )}
              {/* User Info Popover */}
              <Popover open={showUserPopover} onOpenChange={setShowUserPopover}>
                <PopoverTrigger>
                  <button className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/10 transition-colors ml-2">
                    {/* Avatar: Use country flag if available, else initials */}
                    {setupStatus === 'complete' && userProfile?.country ? (
                      <CountryFlag countryCode={userProfile.country.name} countryName={userProfile.country.name} className="w-7 h-7 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 object-cover" />
                    ) : (
                      <div className="w-7 h-7 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
                      </div>
                    )}
                    <span className="hidden md:block text-xs font-medium text-white truncate max-w-[80px]">
                      {user?.firstName || (user as any)?.username || 'User'}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-4 z-[10002]">
                  <div>
                    {/* User Info */}
                    <div className="pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        {setupStatus === 'complete' && userProfile?.country ? (
                          <CountryFlag countryCode={userProfile.country.name} countryName={userProfile.country.name} className="w-10 h-10 rounded-full border border-white/20 object-cover" />
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                            {user?.firstName?.[0] || (user as any)?.username?.[0] || 'U'}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-white">
                            {user?.firstName} {user?.lastName}
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Menu Items */}
                    <div className="pt-3">
                      {setupStatus === 'complete' && userProfile?.country && (
                        <a
                          href={createUrl(`/countries/${userProfile.country.id}`)}
                          className="flex items-center gap-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors rounded"
                        >
                          <Crown className="h-4 w-4" />
                          My Country: {userProfile.country.name}
                        </a>
                      )}
                      {setupStatus === 'needs-setup' && (
                        <a
                          href={createUrl("/setup")}
                          className="flex items-center gap-3 py-2 text-sm text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors rounded"
                        >
                          <AlertCircle className="h-4 w-4" />
                          Complete Setup
                        </a>
                      )}
                      <a
                        href={createUrl("/dashboard")}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Home className="h-4 w-4" />
                        Dashboard
                      </a>
                      <a
                        href={createUrl("/profile")}
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <User className="h-4 w-4" />
                        Profile Settings
                      </a>
                    </div>
                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    {/* Sign Out */}
                    <div className="px-4 py-2">
                      <button
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.location.href = '/sign-out';
                          }
                        }}
                        className="w-full flex items-center gap-3 px-0 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </DynamicContainer>
        );

      case "stats":
        return (
          <DynamicContainer className="p-6 w-full">
            <div className="flex items-center justify-between mb-4">
              <DynamicTitle className="text-lg font-bold text-white">
                Global Statistics
              </DynamicTitle>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => window.location.reload()}
                  disabled={globalStatsLoading}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${globalStatsLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => switchMode("compact")}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {globalStats ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                  <Users className="h-5 w-5 text-blue-200" />
                  <div>
                    <div className="text-sm font-medium text-white">Population</div>
                    <div className="text-xs text-white/80">
                      {formatPopulation(globalStats.totalPopulation)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                  <DollarSign className="h-5 w-5 text-green-200" />
                  <div>
                    <div className="text-sm font-medium text-white">Global GDP</div>
                    <div className="text-xs text-white/80">
                      {formatCurrency(globalStats.totalGdp)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-200" />
                  <div>
                    <div className="text-sm font-medium text-white">Growth Rate</div>
                    <div className="text-xs text-white/80">
                      {formatGrowthRateFromDecimal(isNaN(globalStats.globalGrowthRate) ? 0 : globalStats.globalGrowthRate)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 bg-white/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-orange-200" />
                  <div>
                    <div className="text-sm font-medium text-white">Countries</div>
                    <div className="text-xs text-white/80">
                      {globalStats.countryCount} active
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="text-white/60">Loading global statistics...</div>
              </div>
            )}
          </DynamicContainer>
        );

      case "search":
        return (
          <DynamicContainer className="p-4 w-full">
            <div className="flex items-center justify-between mb-4">
              <DynamicTitle className="text-lg font-bold text-white">
                Search
              </DynamicTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => switchMode("compact")}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                ref={searchInputRef}
                placeholder="Search countries, commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-48">
              {searchResults.length > 0 ? (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <Button
                      key={result.id}
                      variant="ghost"
                      onClick={result.action}
                      className="w-full justify-start gap-3 text-white/80 hover:text-white hover:bg-white/10 p-3"
                    >
                      {result.icon && <result.icon className="h-4 w-4" />}
                      <div className="text-left">
                        <div className="font-medium">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-xs text-white/60">{result.subtitle}</div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
              ) : searchQuery ? (
                <div className="text-center py-6 text-white/60">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                <div className="text-center py-6">
                  <Command className="h-8 w-8 mx-auto mb-2 text-white/40" />
                  <div className="text-white/60 text-sm">
                    Type to search countries and commands
                  </div>
                  <div className="text-white/40 text-xs mt-1">
                    Tip: Use ⌘K to quickly open search
                  </div>
                </div>
              )}
            </ScrollArea>
          </DynamicContainer>
        );

      case "notifications":
        return (
          <DynamicContainer className="p-4 w-full">
            <div className="flex items-center justify-between mb-4">
              <DynamicTitle className="text-lg font-bold text-white">
                Notifications
              </DynamicTitle>
              <div className="flex items-center gap-2">
                {unreadNotifications > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/10 text-xs"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => switchMode("compact")}
                  className="text-white/80 hover:text-white hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-64">
              {notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notification) => {
                    const IconComponent = 
                      notification.type === "info" ? Info :
                      notification.type === "warning" ? AlertTriangle :
                      notification.type === "success" ? CheckCircle : 
                      AlertTriangle;

                    return (
                      <div
                        key={notification.id}
                        className={`p-3 rounded-lg border ${
                          notification.read 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-white/10 border-white/20'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <IconComponent className={`h-4 w-4 mt-0.5 ${
                            notification.type === "info" ? "text-blue-300" :
                            notification.type === "warning" ? "text-yellow-300" :
                            notification.type === "success" ? "text-green-300" :
                            "text-red-300"
                          }`} />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">
                              {notification.title}
                            </div>
                            <div className="text-xs text-white/70 mt-1">
                              {notification.message}
                            </div>
                            <div className="text-xs text-white/50 mt-2">
                              {new Date(notification.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-400 rounded-full mt-2" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Bell className="h-8 w-8 mx-auto mb-2 text-white/40" />
                  <div className="text-white/60 text-sm">No notifications</div>
                </div>
              )}
            </ScrollArea>
          </DynamicContainer>
        );

      case "mycountry":
        return (
          <DynamicContainer className="p-4 w-full">
            <div className="flex items-center justify-between mb-4">
              <DynamicTitle className="text-lg font-bold text-white">
                My Country
              </DynamicTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => switchMode("compact")}
                className="text-white/80 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

{setupStatus === 'complete' && userProfile?.country ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white/10 rounded-xl">
                  <CountryFlag countryCode={userProfile.country.name} countryName={userProfile.country.name} className="w-12 h-12 rounded-lg border border-white/20" />
                  <div>
                    <div className="font-semibold text-white">{userProfile.country.name}</div>
                    <div className="text-sm text-white/60">Your Nation</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => userProfile?.country && (window.location.href = `/countries/${userProfile.country.id}`)}
                    className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                  >
                    <Crown className="h-4 w-4" />
                    Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = "/eci"}
                    className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                  >
                    <Target className="h-4 w-4" />
                    ECI Suite
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = "/builder"}
                    className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                  >
                    <Plus className="h-4 w-4" />
                    Builder
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => window.location.href = "/profile"}
                    className="flex items-center gap-2 text-white/80 hover:text-white border-white/20 hover:border-white/40 hover:bg-white/10"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="p-4 bg-white/5 rounded-xl">
                  <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-400" />
                  <div className="text-white/70 mb-2">No Country Linked</div>
                  <div className="text-white/50 text-sm mb-4">Complete setup to link your account to a country</div>
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
          </DynamicContainer>
        );

      default:
        return null;
    }
  };

  return (
    <DynamicIsland id="global-stats-island">
      {renderContent()}
    </DynamicIsland>
  );
}

export function GlobalStatsIsland({ className }: GlobalStatsIslandProps) {
  return (
    <div className={`w-fit flex items-center justify-center z-[10000] ${className || ''}`}>
      <DynamicIslandProvider initialSize={SIZE_PRESETS.COMPACT}>
        <GlobalStatsIslandContent />
      </DynamicIslandProvider>
    </div>
  );
}