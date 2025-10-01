import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api } from '~/trpc/react';
import { GlassCard } from '../ui/enhanced-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AnimatedNumber } from '../ui/animated-number';
import { CardSpotlight } from '../ui/card-spotlight';
import { BackgroundGradient } from '../ui/background-gradient';
import { SparklesCore } from '../ui/sparkles';
import { HealthRing } from '../ui/health-ring';
import {
  Activity, TrendingUp, TrendingDown, Heart, Shield, Globe, Users, DollarSign, Eye, Target, CheckCircle
} from 'lucide-react';
import LampDemo, { LampContainer } from '../ui/lamp';
import { FlipWords } from '../ui/flip-words';
import { useSearchParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useBulkFlagCache } from '~/hooks/useBulkFlagCache';
import { FastAverageColor } from 'fast-average-color';
import { useRef } from 'react';
import { createUrl } from '~/lib/url-utils';


// Metric Card with glassy colored border
const MetricCard = ({
  icon: Icon,
  title,
  value,
  change,
  trend,
  color,
  suffix = '',
  prefix = '',
}: {
  icon: any;
  title: string;
  value: number;
  change: string;
  trend: 'up' | 'down' | 'stable';
  color: string;
  suffix?: string;
  prefix?: string;
}) => (
  <div className="relative rounded-3xl overflow-visible">
    {/* Glassy colored border */}
    <div
      className="absolute inset-0 rounded-3xl pointer-events-none z-10"
      style={{
        boxShadow: (() => {
          const safeColor: string = typeof color === 'string' && color ? color : 'from-blue-500';
          const colorPart = safeColor.split(' ')[0] || 'from-blue-500';
          const base = colorPart.replace('from-', 'rgba(').replace('-500', ',0.35)');
          const base2 = colorPart.replace('from-', 'rgba(').replace('-500', ',0.18)');
          return `0 0 0 5px ${base}, 0 0 24px 8px ${base2}`;
        })(),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        opacity: 0.85,
      }}
    />
    <GlassCard variant="glass" glow="hover" className="hover:scale-105 transition-all duration-300 relative z-20">
      <div className={`p-3 rounded-2xl bg-gradient-to-r ${color} shadow-lg mb-4 w-fit`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-white/70 text-sm font-medium mb-2">{title}</h3>
      <p className="text-white text-2xl font-bold mb-2">
        {prefix}<AnimatedNumber value={value} decimals={1} />{suffix}
      </p>
      <div className={`text-sm flex items-center gap-1 ${
        trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-yellow-400'
      }`}>
        {trend === 'up' && <TrendingUp className="w-4 h-4" />}
        {trend === 'down' && <TrendingDown className="w-4 h-4" />}
        {trend === 'stable' && <Activity className="w-4 h-4" />}
        {change}
      </div>
    </GlassCard>
  </div>
);

// Achievement Card
const Achievement = ({
  title,
  description,
  badge,
  time,
  unlocked = true,
}: {
  title: string;
  description: string;
  badge: string;
  time: string;
  unlocked?: boolean;
}) => (
  <CardSpotlight className="w-full" color="rgba(59,130,246,0.1)">
    <div className={`flex items-start space-x-3 p-4 rounded-xl transition-all ${unlocked ? 'bg-white/5' : 'bg-white/5/10'}`}>
      <span className={`text-2xl ${unlocked ? '' : 'grayscale'}`}>{badge}</span>
      <div className="flex-1">
        <h4 className={`font-medium text-sm ${unlocked ? 'text-white' : 'text-white/50'}`}>{title}</h4>
        <p className={`text-xs mt-1 ${unlocked ? 'text-white/70' : 'text-white/30'}`}>{description}</p>
        <span className={`text-xs ${unlocked ? 'text-white/50' : 'text-white/20'}`}>{time}</span>
      </div>
      {unlocked && <CheckCircle className="w-4 h-4 text-green-400" />}
    </div>
  </CardSpotlight>
);

// Crisis Card
const CrisisCard = ({
  crisis,
}: {
  crisis: {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    icon: any;
    color: string;
  };
}) => (
  <BackgroundGradient className="w-full h-full rounded-xl p-6" animate={false}>
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-white/20">
            <crisis.icon className="w-5 h-5 text-white" />
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            crisis.severity === 'high' || crisis.severity === 'critical'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {crisis.severity.toUpperCase()}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">Confidence</div>
          <div className="text-sm font-bold text-white">{crisis.confidence}%</div>
        </div>
      </div>
      <h3 className="text-white font-bold text-lg mb-2">{crisis.title}</h3>
      <p className="text-white/80 text-sm">{crisis.description}</p>
    </div>
  </BackgroundGradient>
);

// FlipWordDropdown: Only flips on hover/click, seamless dropdown, controls metricsPeriod
const FlipWordDropdown = ({
  options,
  value,
  onChange,
  className = '',
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [display, setDisplay] = useState(value);
  useEffect(() => { setDisplay(value); }, [value]);

  // Animate flip only on change
  return (
    <span
      className={`relative inline-block align-middle select-none ${className}`}
      tabIndex={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onClick={() => setOpen((o) => !o)}
      style={{ minWidth: 70 }}
    >
      <span className="inline-block cursor-pointer text-blue-300 text-lg font-bold transition-colors duration-200">
        <FlipWords
          words={[display]}
          duration={0} // No auto-flip
          className="inline-block"
        />
      </span>
      {open && (
        <div className="absolute left-0 mt-2 w-32 rounded-lg bg-slate-900/95 shadow-lg border border-blue-700 z-50 animate-fade-in">
          {options.filter(opt => opt !== value).map(opt => (
            <div
              key={opt}
              className="px-4 py-2 text-blue-200 hover:bg-blue-700/30 hover:text-white cursor-pointer transition-colors"
              onClick={() => { setDisplay(opt); onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </span>
  );
};

// Dynamically import LiveTime as a client-only component
const LiveTime = dynamic(() => import('../ui/LiveTime').then(mod => mod.LiveTime), { ssr: false });

// Define or import the correct type for indicators
interface GlobalIndicators {
  globalGDP?: number;
  globalGrowth?: number;
  unemploymentRate?: number;
  tradeVolume?: number;
  // Add other fields as needed
}

export default function GlobalOverview() {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const searchParams = useSearchParams();
  const router = useRouter();
  const highlightCountryId = searchParams?.get('countryId');

  const { user } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );
  const userCountryId = userProfile?.countryId;

  // Live tRPC queries for SDI data
  const { data: indicators, isLoading: loadingIndicators, error: errorIndicators } = api.sdi.getEconomicIndicators.useQuery(undefined, { refetchInterval: 10000 });
  const { data: crises, isLoading: loadingCrises, error: errorCrises } = api.sdi.getActiveCrises.useQuery(undefined, { refetchInterval: 10000 });
  const { data: countriesResult, isLoading: loadingCountries, error: errorCountries } = api.countries.getAll.useQuery({ limit: 1000 });
  const countries = countriesResult?.countries ?? [];
  // Fetch achievements from backend
  const { data: achievements = [], isLoading: loadingAchievements } =
    (api.sdi.getAchievements?.useQuery?.() as { data?: any[]; isLoading?: boolean } | undefined) ?? { data: [], isLoading: false };

  // Health metrics calculated from real data
  const healthMetrics = {
    economic: { current: indicators?.globalGrowth ? Math.round(indicators.globalGrowth * 25) : 0, target: 100 },
    political: { current: crises ? Math.max(0, 100 - (crises.filter(c => c.type === 'political_crisis').length * 15)) : 85, target: 100 },
    social: { current: indicators?.unemploymentRate ? Math.max(0, 100 - Math.round(indicators.unemploymentRate * 2)) : 92, target: 100 },
    security: { current: crises ? Math.max(0, 100 - (crises.filter(c => c.type === 'security_threat').length * 20)) : 88, target: 100 },
  };

  // Daily stats from indicators
  const dailyStats = [
    {
      icon: DollarSign,
      label: 'Global GDP',
      value: indicators?.globalGDP ? indicators.globalGDP / 1e12 : 0,
      change: indicators?.globalGrowth ? `+${indicators.globalGrowth.toFixed(1)}%` : '+0.0%',
      trend: (indicators?.globalGrowth || 0) > 0 ? 'up' as const : 'down' as const,
      color: 'from-green-500 to-emerald-500',
      suffix: 'T',
    },
    {
      icon: Users,
      label: 'Population',
      value: countries.reduce((sum, c) => sum + (c.currentPopulation || c.baselinePopulation || 0), 0) / 1e9,
      change: '+1.2%', // Population growth is typically stable
      trend: 'up' as const,
      color: 'from-blue-500 to-cyan-500',
      suffix: 'B',
    },
    ...(indicators && 'tradeVolume' in indicators ? [{
      icon: Globe,
      label: 'Trade Volume',
      value: (indicators as GlobalIndicators).tradeVolume ? (indicators as GlobalIndicators).tradeVolume! / 1e12 : 0,
      change: '+30.1%',
      trend: 'up' as const,
      color: 'from-purple-500 to-pink-500',
      suffix: 'T',
    }] : []),
    {
      icon: Shield,
      label: 'Security Index',
      value: healthMetrics.security.current,
      change: '+0.8%',
      trend: 'up' as const,
      color: 'from-indigo-500 to-blue-500',
      suffix: '',
    },
  ];

  const [metricsPeriod, setMetricsPeriod] = useState<'Today' | 'Weekly' | 'Monthly' | 'Quarterly'>('Today');
  const metricsOptions = ['Today', 'Weekly', 'Monthly', 'Quarterly'];

  // Example: You can expand these with real data for each period
  const metricsByPeriod: Record<string, typeof dailyStats> = {
    Today: dailyStats,
    Weekly: dailyStats.map(stat => ({ ...stat, value: stat.value * 7, change: '+5.2%', trend: 'up' as const })),
    Monthly: dailyStats.map(stat => ({ ...stat, value: stat.value * 30, change: '+12.8%', trend: 'up' as const })),
    Quarterly: dailyStats.map(stat => ({ ...stat, value: stat.value * 90, change: '+25.4%', trend: 'up' as const })),
  };

  // Use real countries data
  const nations = countries.map(c => ({
    id: c.id,
    name: c.name,
    gdp: (c.currentTotalGdp || (c.baselinePopulation * c.baselineGdpPerCapita)) / 1e12,
    isUser: highlightCountryId === c.id
  }));

  const countryNames = countries.map((c) => c.name);
  const { flagUrls, isLoading: flagsLoading } = useBulkFlagCache(countryNames);

  // Helper to get dominant color from flag
  function useDominantColor(imageUrl: string | null | undefined) {
    const [color, setColor] = useState<string | null>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    
    useEffect(() => {
      if (!imageUrl) {
        setColor(null);
        return;
      }
      
      let mounted = true;
      
      const extractColor = async () => {
        try {
          const fac = new FastAverageColor();
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.src = imageUrl;
          
          img.onload = () => {
            if (!mounted) return;
            try {
              const result = fac.getColor(img);
              if (mounted && result && result.hex) {
                setColor(result.hex);
              }
            } catch (err) {
              console.warn('Failed to extract color from flag:', err);
              if (mounted) setColor(null);
            }
          };
          
          img.onerror = () => {
            if (mounted) setColor(null);
          };
          
          imgRef.current = img;
        } catch (err) {
          console.warn('Error setting up color extraction:', err);
          if (mounted) setColor(null);
        }
      };
      
      void extractColor();
      
      return () => {
        mounted = false;
        if (imgRef.current) {
          imgRef.current.onload = null;
          imgRef.current.onerror = null;
          imgRef.current = null;
        }
      };
    }, [imageUrl]);
    
    return color;
  }

  function NationCard({ nation, flagUrl, highlightCountryId, userCountryId, router }: {
    nation: any;
    flagUrl: string | null;
    highlightCountryId: string | null;
    userCountryId: string | null | undefined;
    router: any;
  }) {
    const dominantColor = useDominantColor(flagUrl);
    const canViewECI = userCountryId && nation.id === userCountryId;
    const isHighlighted = nation.id === highlightCountryId;
    
    return (
      <div
        className={`relative rounded-xl p-4 bg-blue-900/20 border border-blue-700/30 text-white transition-all duration-200 overflow-hidden hover:scale-105 ${
          isHighlighted ? 'ring-4 ring-orange-400 scale-105' : ''
        }`}
        style={dominantColor ? { 
          boxShadow: `0 0 0 2px ${dominantColor}55, 0 4px 20px ${dominantColor}33`,
          borderColor: dominantColor + '66'
        } : undefined}
      >
        {/* Flag as blurred background */}
        {flagUrl && (
          <div
            className="absolute inset-0 z-0 flag-waving-bg"
            style={{
              backgroundImage: `url(${flagUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(12px) brightness(0.6) saturate(1.3)',
              opacity: 0.8,
              pointerEvents: 'none',
            }}
          />
        )}
        
        {/* Fallback gradient background when no flag */}
        {!flagUrl && (
          <div
            className="absolute inset-0 z-0"
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(37,99,235,0.2) 100%)',
              pointerEvents: 'none',
            }}
          />
        )}
        
        {/* Animated overlay using dominant color */}
        {dominantColor && (
          <div
            className="absolute inset-0 z-10 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 70% 30%, ${dominantColor}25 0%, transparent 70%)`,
              mixBlendMode: 'overlay',
              animation: 'pulse 3s ease-in-out infinite',
            }}
          />
        )}
        
        {/* Content */}
        <div className="relative z-20 backdrop-blur-[1px]">
          <div className="text-lg font-bold mb-1 drop-shadow-sm">{nation.name}</div>
          <div className="text-sm text-blue-200 drop-shadow-sm">
            GDP: ${((nation.currentTotalGdp || 0) / 1e12).toFixed(2)}T
          </div>
        </div>
        
        {/* Card footer for actions */}
        <div className="relative z-20 mt-4 flex justify-end">
          {canViewECI && (
            <Button
              size="sm"
              className="bg-orange-600/90 text-white border-orange-500/30 hover:bg-orange-600 transition-colors"
              onClick={() => router.push(createUrl('/eci'))}
            >
              🏛️ View in ECI
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full animate-fade-in relative">
      {/* Background Sparkles - ensure sparkles are above background but below main content */}
      <div className="absolute inset-0 h-full z-20 pointer-events-none">
        <SparklesCore
          id="tsparticles"
          background="transparent"
          minSize={0.6}
          maxSize={1.4}
          particleDensity={100}
          className="w-full h-full z-20 pointer-events-none"
          particleColor="#3b82f6"
        />
      </div>

      {/* Header with Live Status */}
      <GlassCard variant="diplomatic" glow="hover" className="p-8 mb-6 z-30 relative">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-blue-100 diplomatic-header mb-2">Global Overview</h1>
            <p className="text-lg text-blue-200">Real-time monitoring of global health and economic indicators</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                <AnimatedNumber value={48} decimals={0} />
              </div>
              <div className="text-sm text-blue-300">Active Nations</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">
                <LiveTime />
              </div>
              <div className="text-sm text-blue-300">Live Time</div>
            </div>
            <Badge variant="secondary" className="bg-green-700/40 text-green-100 border-none flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Live
            </Badge>
          </div>
        </div>

        {/* Health Rings Section */}
        <div className="mb-8">
          <LampContainer className="sdi-lamp-header mb-6 z-40">
            <h2 className="text-2xl font-bold text-blue-100 mb-0">Global Health</h2>
          </LampContainer>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <HealthRing 
                value={healthMetrics.economic.current}
                target={healthMetrics.economic.target}
                color="#10b981"
                label="Economic" 
                tooltip="Economic Health: Measures the overall stability and growth of the global economy."
                size={120}
              />
              <p className="text-white/70 text-sm mt-2">Economic Health</p>
            </div>
            <div className="text-center">
              <HealthRing 
                value={healthMetrics.political.current}
                target={healthMetrics.political.target}
                color="#3b82f6"
                label="Political" 
                tooltip="Political Stability: Indicates the level of political unrest and stability across nations."
                size={120}
              />
              <p className="text-white/70 text-sm mt-2">Political Stability</p>
            </div>
            <div className="text-center">
              <HealthRing 
                value={healthMetrics.social.current}
                target={healthMetrics.social.target}
                color="#8b5cf6"
                label="Social" 
                tooltip="Social Harmony: Measures the level of social cohesion and conflict resolution."
                size={120}
              />
              <p className="text-white/70 text-sm mt-2">Social Harmony</p>
            </div>
            <div className="text-center">
              <HealthRing 
                value={healthMetrics.security.current}
                target={healthMetrics.security.target}
                color="#6366f1"
                label="Security" 
                tooltip="Security Index: Evaluates the overall security and safety of global infrastructure."
                size={120}
              />
              <p className="text-white/70 text-sm mt-2">Security Index</p>
            </div>
          </div>
        </div>

        {/* Daily Stats Grid */}
        <div className="mb-8">
          <LampContainer className="sdi-lamp-header mb-6 flex items-center gap-2 z-40">
            <h2 className="text-2xl font-bold text-blue-100 mb-0 flex items-center">
              <FlipWordDropdown
                options={metricsOptions}
                value={metricsPeriod}
                onChange={v => setMetricsPeriod(v as typeof metricsPeriod)}
                className="mr-2"
              />
              <span>Metrics</span>
            </h2>
          </LampContainer>
          {/* Loading/Error States for indicators */}
          {loadingIndicators && (
            <div className="text-blue-300 text-center py-8">Loading economic indicators...</div>
          )}
          {errorIndicators && (
            <div className="text-red-400 text-center py-8">Error loading indicators: {errorIndicators.message}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(metricsByPeriod[metricsPeriod] || dailyStats).map((stat, index) => (
              <MetricCard
                key={index}
                icon={stat.icon}
                title={stat.label}
                value={stat.value}
                change={stat.change}
                trend={stat.trend}
                color={stat.color}
                suffix={stat.suffix}
              />
            ))}
          </div>
        </div>

        {/* Two Column Layout for Achievements and Crises */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Achievements */}
          <div>
            <LampContainer className="sdi-lamp-header mb-4 z-40">
              <h2 className="text-2xl font-bold text-blue-100 mb-0">Recent Achievements</h2>
            </LampContainer>
            <div className="space-y-3">
              {achievements.map((achievement: any, index: number) => (
                <Achievement
                  key={index}
                  title={achievement.title}
                  description={achievement.description}
                  badge={achievement.badge}
                  time={achievement.time}
                  unlocked={achievement.unlocked}
                />
              ))}
            </div>
          </div>

          {/* Active Crises */}
          <div>
            <h2 className="text-2xl font-bold text-blue-100 mb-4">Active Situations</h2>
            {/* Loading/Error States for crises */}
            {loadingCrises && (
              <div className="text-blue-300 text-center py-8">Loading crises...</div>
            )}
            {errorCrises && (
              <div className="text-red-400 text-center py-8">Error loading crises: {errorCrises.message}</div>
            )}
            <div className="space-y-4">
              {(crises ?? []).map((crisis: any, index: number) => (
                <CrisisCard key={index} crisis={{
                  title: crisis?.title ?? '',
                  description: crisis?.description ?? '',
                  severity: crisis?.severity ?? 'low',
                  confidence: crisis?.confidence ?? 90,
                  icon: crisis?.type === 'economic_crisis' ? DollarSign : Globe,
                  color: (crisis?.severity === 'high' || crisis?.severity === 'critical')
                    ? 'from-red-500/10 to-orange-500/10'
                    : 'from-yellow-500/10 to-green-500/10',
                }} />
              ))}
            </div>
            {/* Quick Actions */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-blue-100 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Button className="bg-blue-600 hover:bg-blue-700 w-full transition-all duration-300 hover:scale-105">
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>
                <Button variant="outline" className="border-blue-600 w-full transition-all duration-300 hover:scale-105">
                  <Target className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Nations Overview */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-blue-100 mb-2">Nations Overview</h2>
        {loadingCountries && <div className="text-blue-300 text-center py-4">Loading nations...</div>}
        {errorCountries && <div className="text-red-400 text-center py-4">Error loading nations: {errorCountries.message}</div>}
        {flagsLoading && <div className="text-blue-300 text-center py-2">Loading flag cache...</div>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {countries.map(nation => (
            <NationCard
              key={nation.id}
              nation={nation}
              flagUrl={(flagUrls[nation.name] !== undefined ? flagUrls[nation.name] : null) as string | null}
              highlightCountryId={highlightCountryId}
              userCountryId={userCountryId}
              router={router}
            />
          ))}
        </div>
        <style jsx>{`
          .flag-waving-bg {
            animation: flag-wave 6s ease-in-out infinite;
            will-change: transform;
            mask-image: linear-gradient(to bottom, rgba(0,0,0,0.7) 80%, transparent 100%);
          }
          @keyframes flag-wave {
            0% { transform: skewY(0deg) scaleX(1) translateY(0); }
            10% { transform: skewY(-2deg) scaleX(1.01) translateY(-1px); }
            20% { transform: skewY(2deg) scaleX(0.99) translateY(1px); }
            30% { transform: skewY(-1deg) scaleX(1.01) translateY(-2px); }
            40% { transform: skewY(1deg) scaleX(0.99) translateY(2px); }
            50% { transform: skewY(0deg) scaleX(1) translateY(0); }
            100% { transform: skewY(0deg) scaleX(1) translateY(0); }
          }
        `}</style>
      </div>
    </div>
  );
} 