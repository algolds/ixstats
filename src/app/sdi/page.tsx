"use client";
import { AuroraBackground } from '../../components/ui/aurora-background';
import IntelligenceFeed from '../../components/sdi/IntelligenceFeed';
import SecureComms from '../../components/sdi/SecureComms';
import FloatingDock from '../../components/sdi/FloatingDock';
import React, { useState } from 'react';
import { Sidebar, SidebarBody, SidebarLink } from '../../components/ui/sidebar';
import { IconMenu2, IconX } from '@tabler/icons-react';
import { FaGlobe, FaSatellite, FaLock, FaExclamationTriangle, FaChartLine, FaHandshake } from 'react-icons/fa';
import { ExecutiveSummary } from '../dashboard/_components/GlobalStatsSection';
import { GlassCard } from '../../components/ui/enhanced-card';
import { Badge } from '../../components/ui/badge';
import { BentoGrid } from '../../components/ui/bento-grid';

// Mock data for ExecutiveSummary
const mockGlobalStats = {
  timestamp: Date.now(),
  totalPopulation: 7_800_000_000,
  totalGdp: 125_700_000_000_000,
  averageGdpPerCapita: 16_100,
  countryCount: 48,
  economicTierDistribution: {
    Impoverished: 0,
    Developing: 10,
    Emerging: 18,
    Developed: 12,
    Healthy: 0,
    Strong: 0,
    "Very Strong": 0,
    Extravagant: 0,
    Advanced: 8,
  },
  populationTierDistribution: {
    X: 1,
    7: 2,
    6: 5,
    5: 8,
    4: 10,
    3: 10,
    2: 7,
    1: 5,
  },
  averagePopulationDensity: 120,
  averageGdpDensity: 500_000,
  globalGrowthRate: 3.2,
  ixTimeTimestamp: Date.now(),
};
const mockTopCountries = [
  { id: '1', name: 'Caphiria', currentTotalGdp: 25_000_000_000_000, economicTier: 'Advanced' },
  { id: '2', name: 'Urcea', currentTotalGdp: 18_000_000_000_000, economicTier: 'Developed' },
  { id: '3', name: 'Burgundie', currentTotalGdp: 12_000_000_000_000, economicTier: 'Emerging' },
  { id: '4', name: 'Latium', currentTotalGdp: 9_000_000_000_000, economicTier: 'Developed' },
  { id: '5', name: 'Sarpedon', currentTotalGdp: 7_000_000_000_000, economicTier: 'Developing' },
];
const mockTrends = [
  { label: 'Economic Growth', value: 3.2, suffix: '%', trend: 'up', description: 'Average annual GDP growth' },
  { label: 'Population Growth', value: 1.2, suffix: '%', trend: 'stable', description: 'Global population increase' },
  { label: 'Trade Volume', value: 2.5, suffix: '%', trend: 'up', description: 'International trade growth' },
  { label: 'Diplomatic Activity', value: 23, trend: 'up', description: 'Active diplomacy channels' },
];

function CrisisManagement() {
  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold mb-4 text-blue-100 diplomatic-header">Crisis Management Center</h2>
      <p className="text-lg text-blue-200 mb-2">Real-time monitoring of global crises and response coordination.</p>
      <div className="text-blue-300">(Mock module: No active crises at this time.)</div>
    </GlassCard>
  );
}
function EconomicIntelligence() {
  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold mb-4 text-blue-100 diplomatic-header">Economic Intelligence Hub</h2>
      <p className="text-lg text-blue-200 mb-2">Strategic economic intelligence and global financial analysis.</p>
      <div className="text-blue-300">(Mock module: All economic indicators stable.)</div>
    </GlassCard>
  );
}
function DiplomaticMatrix() {
  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-8 max-w-3xl mx-auto animate-fade-in">
      <h2 className="text-3xl font-bold mb-4 text-blue-100 diplomatic-header">Diplomatic Relations Matrix</h2>
      <p className="text-lg text-blue-200 mb-2">Comprehensive diplomatic relationship tracking and analysis.</p>
      <div className="text-blue-300">(Mock module: All diplomatic channels operational.)</div>
    </GlassCard>
  );
}

const MODULES = [
  { key: 'summary', label: 'Global Overview' },
  { key: 'intelligence', label: 'Intelligence Feed' },
  { key: 'comms', label: 'Secure Comms' },
  { key: 'crisis', label: 'Crisis Management' },
  { key: 'economic', label: 'Economic Intelligence' },
  { key: 'diplomatic', label: 'Diplomatic Matrix' },
];

export default function SDIPage() {
  const [selected, setSelected] = useState('summary');
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-slate-900 text-white">
      <div className="flex flex-row h-screen w-full overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="h-full w-64 sdi-sidebar flex flex-col py-8 px-4">
          <div className="mb-8 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-full flex items-center justify-center text-3xl shadow-lg mx-auto mb-4 medallion-glow">
              🌐
            </div>
            <h1 className="text-2xl font-bold text-blue-100 diplomatic-header">SDI</h1>
            <p className="text-sm text-blue-200">Sovereign Digital Interface</p>
          </div>
          <nav className="flex flex-col gap-2">
            {MODULES.map((mod) => (
              <button
                key={mod.key}
                className={`w-full text-left px-4 py-2 rounded-lg transition-all font-medium text-blue-100 hover:bg-indigo-700/20 focus:bg-indigo-700/30 ${selected === mod.key ? 'bg-indigo-700/30 font-bold shadow-lg' : ''}`}
                onClick={() => setSelected(mod.key)}
              >
                {mod.label}
              </button>
            ))}
          </nav>
        </div>
        {/* Main Content */}
        <main className="flex-1 flex flex-col h-full overflow-y-auto px-6 py-10 bg-transparent">
          {selected === 'summary' && (
            <div className="max-w-7xl mx-auto w-full animate-fade-in">
              <BentoGrid className="mb-8">
                {/* ExecutiveSummary as a single grid item spanning 2 columns on desktop */}
                <div className="md:col-span-2 col-span-1">
                  <ExecutiveSummary
                    globalStats={mockGlobalStats}
                    topCountries={mockTopCountries}
                    economicTrends={mockTrends}
                    isLoading={false}
                  />
                </div>
                {/* Active Diplomacy Card */}
                <div className="flex flex-col items-center justify-center p-8 rounded-xl glass-card shadow-lg bg-gradient-to-br from-emerald-400/20 to-emerald-900/30 border-none">
                  <div className="text-4xl mb-2 diplomatic-icon">🤝</div>
                  <div className="text-2xl font-bold diplomatic-value">23</div>
                  <div className="text-base text-emerald-100 mt-2 font-medium diplomatic-label">Active Diplomacy</div>
                  <Badge variant="secondary" className="mt-2 bg-emerald-700/40 text-emerald-100 border-none">Live</Badge>
                </div>
              </BentoGrid>
            </div>
          )}
          {selected === 'intelligence' && <IntelligenceFeed />}
          {selected === 'comms' && <SecureComms />}
          {selected === 'crisis' && <CrisisManagement />}
          {selected === 'economic' && <EconomicIntelligence />}
          {selected === 'diplomatic' && <DiplomaticMatrix />}
        </main>
      </div>
    </div>
  );
} 