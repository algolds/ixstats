import React, { useState, useEffect } from 'react';
import { AlertTriangle, Shield, Activity, TrendingDown, Zap, Globe, Users, DollarSign, Clock, Target, CheckCircle, XCircle, AlertCircle, Play, Pause, RotateCcw } from 'lucide-react';
import { GlassCard } from '../src/components/ui/enhanced-card';

interface Crisis {
  id: number;
  title: string;
  type: string;
  severity: string;
  status: string;
  affected: string[];
  startTime: string;
  duration: string;
  impact: {
    economic: number;
    political: number;
    social: number;
  };
  description: string;
  responseTeam: string;
  nextAction: string;
  confidence: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const activeCrises = [
  {
    id: 1,
    title: 'Economic Recession Warning',
    type: 'economic',
    severity: 'high',
    status: 'active',
    affected: ['Sarpadon', 'Dericania', 'Faneria'],
    startTime: '2 hours ago',
    duration: 'Ongoing',
    impact: {
      economic: -2.3,
      political: -1.1,
      social: -0.8
    },
    description: 'GDP contraction indicators suggest potential regional recession',
    responseTeam: 'Economic Stabilization Unit',
    nextAction: 'Emergency economic summit scheduled',
    confidence: 87,
    icon: DollarSign,
    color: 'from-red-500 to-orange-500'
  },
  {
    id: 2,
    title: 'Supply Chain Disruption',
    type: 'logistical',
    severity: 'medium',
    status: 'monitoring',
    affected: ['Latium', 'Burgundie'],
    startTime: '6 hours ago',
    duration: '2-3 days estimated',
    impact: {
      economic: -1.2,
      political: -0.3,
      social: -0.5
    },
    description: 'Major shipping route blocked due to infrastructure failure',
    responseTeam: 'Logistics Crisis Team',
    nextAction: 'Rerouting coordination in progress',
    confidence: 94,
    icon: Globe,
    color: 'from-yellow-500 to-orange-500'
  },
  {
    id: 3,
    title: 'Diplomatic Tension Escalation',
    type: 'political',
    severity: 'medium',
    status: 'resolving',
    affected: ['Veltorina', 'Hendalarsk'],
    startTime: '1 day ago',
    duration: 'De-escalating',
    impact: {
      economic: -0.8,
      political: -2.1,
      social: -0.4
    },
    description: 'Trade dispute over technology licensing agreements',
    responseTeam: 'Diplomatic Mediation Unit',
    nextAction: 'Mediation session tomorrow',
    confidence: 76,
    icon: Users,
    color: 'from-blue-500 to-purple-500'
  }
];

const riskFactors = [
  { category: 'Economic Volatility', level: 'Medium', score: 64, trend: '+5%', color: 'text-yellow-400' },
  { category: 'Political Instability', level: 'Low', score: 23, trend: '-2%', color: 'text-green-400' },
  { category: 'Social Unrest', level: 'Low', score: 18, trend: '-1%', color: 'text-green-400' },
  { category: 'Resource Scarcity', level: 'Medium', score: 45, trend: '+3%', color: 'text-yellow-400' },
  { category: 'Climate Events', level: 'Low', score: 31, trend: '0%', color: 'text-green-400' }
];

const responseProtocols = [
  {
    name: 'Economic Stabilization',
    type: 'economic',
    readiness: 95,
    lastDrill: '2 weeks ago',
    resources: 'Emergency funds, policy tools',
    icon: DollarSign,
    color: 'from-green-500 to-emerald-500'
  },
  {
    name: 'Diplomatic Mediation',
    type: 'political', 
    readiness: 88,
    lastDrill: '1 month ago',
    resources: 'Mediator teams, communication channels',
    icon: Users,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    name: 'Supply Chain Recovery',
    type: 'logistical',
    readiness: 92,
    lastDrill: '3 weeks ago',
    resources: 'Alternative routes, emergency supplies',
    icon: Globe,
    color: 'from-purple-500 to-pink-500'
  }
];

const CrisisManagement = () => {
  const [selectedCrisis, setSelectedCrisis] = useState<Crisis | null>(null);
  const [alertLevel, setAlertLevel] = useState('normal'); // normal, elevated, high, critical
  const [simulationMode, setSimulationMode] = useState(false);


  const CrisisCard = ({ crisis }: { crisis: any }) => {
    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'critical': return 'text-red-400 bg-red-500/20';
        case 'high': return 'text-orange-400 bg-orange-500/20';
        case 'medium': return 'text-yellow-400 bg-yellow-500/20';
        case 'low': return 'text-green-400 bg-green-500/20';
        default: return 'text-gray-400 bg-gray-500/20';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'active': return <AlertTriangle className="w-4 h-4 text-red-400" />;
        case 'monitoring': return <AlertCircle className="w-4 h-4 text-yellow-400" />;
        case 'resolving': return <Activity className="w-4 h-4 text-blue-400" />;
        case 'resolved': return <CheckCircle className="w-4 h-4 text-green-400" />;
        default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
      }
    };

    return (
      <GlassCard variant="security" 
        className={`cursor-pointer hover:scale-[1.02] transition-all duration-300 ${
          selectedCrisis?.id === crisis.id ? 'ring-2 ring-blue-400/50' : ''
        }`}
        onClick={() => setSelectedCrisis(selectedCrisis?.id === crisis.id ? null : crisis)}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-white/20">
              <crisis.icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSeverityColor(crisis.severity)}`}>
                {crisis.severity.toUpperCase()}
              </span>
              <div className="flex items-center space-x-2 mt-1">
                {getStatusIcon(crisis.status)}
                <span className="text-xs text-white/70">{crisis.status.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-white/60">Confidence</div>
            <div className="text-sm font-bold text-white">{crisis.confidence}%</div>
          </div>
        </div>

        <h3 className="text-white font-bold text-lg mb-2">{crisis.title}</h3>
        <p className="text-white/80 text-sm mb-3">{crisis.description}</p>
        
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-white/60">{crisis.startTime} • {crisis.duration}</div>
          <div className="flex space-x-1">
            {crisis.affected.slice(0, 3).map((country: string, idx: number) => (
              <span key={idx} className="text-xs px-2 py-1 bg-white/20 rounded-full text-white/80">
                {country}
              </span>
            ))}
          </div>
        </div>

        {/* Impact Indicators */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center">
            <div className={`text-lg font-bold ${crisis.impact.economic < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {crisis.impact.economic > 0 ? '+' : ''}{crisis.impact.economic}%
            </div>
            <div className="text-xs text-white/60">Economic</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${crisis.impact.political < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {crisis.impact.political > 0 ? '+' : ''}{crisis.impact.political}%
            </div>
            <div className="text-xs text-white/60">Political</div>
          </div>
          <div className="text-center">
            <div className={`text-lg font-bold ${crisis.impact.social < 0 ? 'text-red-400' : 'text-green-400'}`}>
              {crisis.impact.social > 0 ? '+' : ''}{crisis.impact.social}%
            </div>
            <div className="text-xs text-white/60">Social</div>
          </div>
        </div>

        {selectedCrisis?.id === crisis.id && (
          <div className="border-t border-white/20 pt-4 animate-in slide-in-from-top duration-300">
            <div className="space-y-3">
              <div>
                <h4 className="text-white font-medium text-sm mb-1">Response Team</h4>
                <p className="text-white/70 text-sm">{crisis.responseTeam}</p>
              </div>
              <div>
                <h4 className="text-white font-medium text-sm mb-1">Next Action</h4>
                <p className="text-white/70 text-sm">{crisis.nextAction}</p>
              </div>
              
              <div className="flex space-x-2 pt-2">
                <button className="flex-1 p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-all text-blue-400 text-sm font-medium">
                  Deploy Response
                </button>
                <button className="flex-1 p-2 rounded-xl bg-green-500/20 hover:bg-green-500/30 transition-all text-green-400 text-sm font-medium">
                  View Details
                </button>
              </div>
            </div>
          </div>
        )}
      </GlassCard>
    );
  };

  const getAlertLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'from-red-500 to-red-600';
      case 'high': return 'from-orange-500 to-red-500';
      case 'elevated': return 'from-yellow-500 to-orange-500';
      case 'normal': return 'from-green-500 to-emerald-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Crisis Management</h1>
            <p className="text-white/60">Real-time crisis monitoring and emergency response coordination</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Alert Level Indicator */}
            <GlassCard variant="security" className={`px-4 py-2 bg-gradient-to-r ${getAlertLevelColor(alertLevel)}`}>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-white" />
                <span className="text-white font-medium text-sm">
                  Alert Level: {alertLevel.toUpperCase()}
                </span>
              </div>
            </GlassCard>

            {/* Simulation Mode Toggle */}
            <GlassCard variant="security" className="px-4 py-2">
              <button
                onClick={() => setSimulationMode(!simulationMode)}
                className={`flex items-center space-x-2 text-sm font-medium transition-all ${
                  simulationMode ? 'text-yellow-400' : 'text-white/70'
                }`}
              >
                <Target className="w-4 h-4" />
                <span>Simulation Mode</span>
              </button>
            </GlassCard>
          </div>
        </div>

        {/* System Status */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <GlassCard variant="security" className="text-center">
            <div className="text-2xl font-bold text-red-400">{activeCrises.length}</div>
            <div className="text-white/60 text-sm">Active Crises</div>
          </GlassCard>
          
          <GlassCard variant="security" className="text-center">
            <div className="text-2xl font-bold text-green-400">3</div>
            <div className="text-white/60 text-sm">Response Teams</div>
          </GlassCard>
          
          <GlassCard variant="security" className="text-center">
            <div className="text-2xl font-bold text-blue-400">91%</div>
            <div className="text-white/60 text-sm">System Readiness</div>
          </GlassCard>
          
          <GlassCard variant="security" className="text-center">
            <div className="text-2xl font-bold text-yellow-400">12</div>
            <div className="text-white/60 text-sm">Risk Factors</div>
          </GlassCard>
          
          <GlassCard variant="security" className="text-center">
            <div className="text-2xl font-bold text-purple-400">00:15:32</div>
            <div className="text-white/60 text-sm">Avg Response</div>
          </GlassCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Crises */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Active Situations</h2>
            
            <div className="flex items-center space-x-2">
              <button className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white">
                <Play className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white">
                <Pause className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="space-y-4">
            {activeCrises.map((crisis) => (
              <CrisisCard key={crisis.id} crisis={crisis} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Risk Assessment */}
          <GlassCard variant="security">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Risk Assessment</h3>
              <Activity className="w-5 h-5 text-yellow-400" />
            </div>
            
            <div className="space-y-3">
              {riskFactors.map((risk, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-white text-sm">{risk.category}</span>
                    <span className={`text-sm font-medium ${risk.color}`}>{risk.level}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 h-2 bg-white/10 rounded-full">
                      <div 
                        className={`h-full rounded-full ${
                          risk.level === 'High' ? 'bg-red-400' :
                          risk.level === 'Medium' ? 'bg-yellow-400' :
                          'bg-green-400'
                        }`}
                        style={{ width: `${risk.score}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/60 w-12">{risk.trend}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Response Protocols */}
          <GlassCard variant="security">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Response Protocols</h3>
              <Shield className="w-5 h-5 text-green-400" />
            </div>
            
            <div className="space-y-4">
              {responseProtocols.map((protocol, index) => (
                <div key={index} className="p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <protocol.icon className="w-4 h-4 text-white/70" />
                      <span className="text-white font-medium text-sm">{protocol.name}</span>
                    </div>
                    <span className={`text-sm font-bold ${
                      protocol.readiness >= 90 ? 'text-green-400' :
                      protocol.readiness >= 70 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {protocol.readiness}%
                    </span>
                  </div>
                  <div className="text-xs text-white/60 mb-1">{protocol.resources}</div>
                  <div className="text-xs text-white/50">Last drill: {protocol.lastDrill}</div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard variant="security">
            <h3 className="text-white font-bold mb-4">Emergency Actions</h3>
            
            <div className="space-y-2">
              <button className="w-full p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-all text-red-400 text-sm font-medium text-left">
                🚨 Declare Emergency
              </button>
              <button className="w-full p-3 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 transition-all text-yellow-400 text-sm font-medium text-left">
                ⚡ Activate Protocol
              </button>
              <button className="w-full p-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-all text-blue-400 text-sm font-medium text-left">
                📞 Contact Teams
              </button>
              <button className="w-full p-3 rounded-xl bg-green-500/20 hover:bg-green-500/30 transition-all text-green-400 text-sm font-medium text-left">
                📊 Generate Report
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default CrisisManagement;