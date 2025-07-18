import React, { useState, useEffect } from 'react';
import { api } from '~/trpc/react';
import { GlassCard } from '../ui/enhanced-card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { AnimatedNumber } from '../ui/animated-number';
import { CardSpotlight } from '../ui/card-spotlight';
import { BackgroundGradient } from '../ui/background-gradient';
import { SparklesCore } from '../ui/sparkles';
import {
  Activity, TrendingUp, TrendingDown, Heart, Shield, Globe, Users, DollarSign, Eye, Target, CheckCircle
} from 'lucide-react';
import LampDemo, { LampContainer } from '../ui/lamp';
import { FlipWords } from '../ui/flip-words';

// Enhanced Health Ring Component with Animated Gradient System
// Convert hex to RGB for gradient
const hexToRgb = (hexInput?: string) => {
  let hex = hexInput || '#10b981';
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join("");
  }
  const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result && result.length >= 4) {
    return {
      r: parseInt(result[1] ?? '0', 16),
      g: parseInt(result[2] ?? '0', 16),
      b: parseInt(result[3] ?? '0', 16),
    };
  }
  return { r: 16, g: 185, b: 129 }; // Default green
};

// Tooltip component
const Tooltip = ({ children, text }: { children: React.ReactNode; text: string }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
      tabIndex={0}
    >
      {children}
      {show && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-10 z-50 px-3 py-2 rounded-lg bg-black/80 text-xs text-white shadow-lg whitespace-nowrap animate-fade-in">
          {text}
        </div>
      )}
    </div>
  );
};

// HealthRing with glass blur border on hover and colored border
const HealthRing = ({
  metric,
  size = 120,
  strokeWidth = 8,
  primaryColor = '#10b981', // Green as default
  label = 'Health',
  tooltip = '',
}: {
  metric: { current: number; target: number };
  size?: number;
  strokeWidth?: number;
  primaryColor?: string;
  label?: string;
  tooltip?: string;
}) => {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = (metric.current / metric.target) * circumference;
  const rgb = hexToRgb(primaryColor);
  const [hovered, setHovered] = React.useState(false);

  // Glassy border color
  const borderColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.45)`;

  return (
    <Tooltip text={tooltip || label}>
      <div
        className={`relative flex items-center justify-center transition-all duration-300 group/healthring`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        tabIndex={0}
        onFocus={() => setHovered(true)}
        onBlur={() => setHovered(false)}
        style={{ cursor: 'pointer' }}
      >
        {/* Glass blur border always visible, colored */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none z-10"
          style={{
            boxShadow: `0 0 0 6px ${borderColor}, 0 0 24px 8px ${borderColor}`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            opacity: hovered ? 1 : 0.7,
            transition: 'opacity 0.3s',
          }}
        />
        <svg width={size} height={size} className="transform -rotate-90 z-20">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeWidth}
          />
          {/* Animated gradient progress circle */}
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={primaryColor} stopOpacity="0.8">
                <animate
                  attributeName="stop-opacity"
                  values="0.8;1;0.8"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="50%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`}>
                <animate
                  attributeName="stop-opacity"
                  values="0.6;0.9;0.6"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </stop>
              <stop offset="100%" stopColor={`rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`}>
                <animate
                  attributeName="stop-opacity"
                  values="0.4;0.7;0.4"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </stop>
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#gradient-${label})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            style={{
              filter: hovered
                ? `drop-shadow(0 0 16px ${primaryColor}) drop-shadow(0 0 32px rgba(${rgb.r},${rgb.g},${rgb.b},0.5))`
                : `drop-shadow(0 0 8px ${primaryColor})`,
              transition: 'stroke-dashoffset 1s ease-in-out, filter 0.3s',
            }}
          >
            <animate
              attributeName="stroke-dashoffset"
              from={circumference}
              to={circumference - progress}
              dur="1.5s"
              fill="freeze"
            />
          </circle>
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30">
          <span className="text-2xl font-bold text-white">
            <AnimatedNumber value={metric.current} decimals={0} />
          </span>
          <span className="text-xs text-white/60">of {metric.target}</span>
          <span className="text-xs text-white/40 mt-1">{label}</span>
        </div>
      </div>
    </Tooltip>
  );
};

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
    <GlassCard variant="glass" blur="prominent" glow="hover" className="hover:scale-105 transition-all duration-300 relative z-20">
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

export default function GlobalOverview() {
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Live tRPC queries for SDI data
  const { data: indicators, isLoading: loadingIndicators, error: errorIndicators } = api.sdi.getEconomicIndicators.useQuery(undefined, { refetchInterval: 10000 });
  const { data: crises, isLoading: loadingCrises, error: errorCrises } = api.sdi.getActiveCrises.useQuery(undefined, { refetchInterval: 10000 });
  // Achievements: (Assume a future endpoint or keep as static for now)
  // For demo, keep static, but you can wire to api.sdi.getAchievements when available
  const achievements = [
    {
      title: 'Economic Stability',
      description: 'Maintained global economic growth above 3% for 12 consecutive quarters',
      badge: '🏆',
      time: '2 hours ago',
      unlocked: true,
    },
    {
      title: 'Diplomatic Success',
      description: 'Resolved 5 international disputes through mediation',
      badge: '🤝',
      time: '1 day ago',
      unlocked: true,
    },
    {
      title: 'Security Milestone',
      description: 'Zero major security incidents for 30 days',
      badge: '🛡️',
      time: '3 days ago',
      unlocked: true,
    },
    {
      title: 'Global Cooperation',
      description: 'All nations participating in climate initiative',
      badge: '🌍',
      time: '1 week ago',
      unlocked: false,
    },
  ];

  // Health metrics (simulate from indicators for now)
  const healthMetrics = {
    economic: { current: indicators?.globalGrowth ? Math.round(indicators.globalGrowth * 25) : 0, target: 100 },
    political: { current: 85, target: 100 }, // TODO: Replace with real data
    social: { current: 92, target: 100 },    // TODO: Replace with real data
    security: { current: indicators?.unemploymentRate ? Math.max(0, 100 - Math.round(indicators.unemploymentRate * 10)) : 0, target: 100 },
  };

  // Daily stats from indicators
  const dailyStats = [
    {
      icon: DollarSign,
      label: 'Global GDP',
      value: indicators?.globalGDP ? indicators.globalGDP / 1e12 : 0,
      change: '+20.3%', // TODO: Replace with real change
      trend: 'up' as const,
      color: 'from-green-500 to-emerald-500',
      suffix: 'T',
    },
    {
      icon: Users,
      label: 'Population',
      value: 7.8, // TODO: Replace with real data
      change: '+10.2%',
      trend: 'up' as const,
      color: 'from-blue-500 to-cyan-500',
      suffix: 'B',
    },
    {
      icon: Globe,
      label: 'Trade Volume',
      value: indicators?.tradeVolume ? indicators.tradeVolume / 1e12 : 0,
      change: '+30.1%',
      trend: 'up' as const,
      color: 'from-purple-500 to-pink-500',
      suffix: 'T',
    },
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
      <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 mb-6 z-30 relative">
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
                {new Date().toLocaleTimeString()}
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
                metric={healthMetrics.economic} 
                primaryColor="#10b981"
                label="Economic" 
                tooltip="Economic Health: Measures the overall stability and growth of the global economy."
              />
              <p className="text-white/70 text-sm mt-2">Economic Health</p>
            </div>
            <div className="text-center">
              <HealthRing 
                metric={healthMetrics.political} 
                primaryColor="#3b82f6"
                label="Political" 
                tooltip="Political Stability: Indicates the level of political unrest and stability across nations."
              />
              <p className="text-white/70 text-sm mt-2">Political Stability</p>
            </div>
            <div className="text-center">
              <HealthRing 
                metric={healthMetrics.social} 
                primaryColor="#8b5cf6"
                label="Social" 
                tooltip="Social Harmony: Measures the level of social cohesion and conflict resolution."
              />
              <p className="text-white/70 text-sm mt-2">Social Harmony</p>
            </div>
            <div className="text-center">
              <HealthRing 
                metric={healthMetrics.security} 
                primaryColor="#6366f1"
                label="Security" 
                tooltip="Security Index: Evaluates the overall security and safety of global infrastructure."
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
              {achievements.map((achievement, index) => (
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
    </div>
  );
} 