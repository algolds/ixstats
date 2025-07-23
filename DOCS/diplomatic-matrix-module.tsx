import React, { useState, useEffect } from 'react';
import { Globe, Heart, Shield, TrendingUp, Users, MessageSquare, Award, AlertTriangle, Handshake, Target, Eye, Filter, ArrowRight, BarChart3 } from 'lucide-react';
import { GlassCard } from '../src/components/ui/enhanced-card';

interface Country {
  name: string;
  flag: string;
  power: string;
}

interface Relationship {
  country1: Country;
  country2: Country;
  relationship: number;
  trend: string;
  type: string;
  lastEvent: string;
  eventTime: string;
  tradeVolume: string;
  militaryCooperation: string;
  status: string;
}

interface DiplomaticEvent {
  id: number;
  type: string;
  title: string;
  participants: string[];
  date: string;
  priority: string;
  impact: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const relationshipData = [
  {
    country1: { name: 'Caphira', flag: '🇨🇦', power: 'Superpower' },
    country2: { name: 'Urcea', flag: '🇺🇸', power: 'Superpower' },
    relationship: 85,
    trend: '+2',
    type: 'Strategic Alliance',
    lastEvent: 'Trade agreement signed',
    eventTime: '2 days ago',
    tradeVolume: '$2.4T',
    militaryCooperation: 'High',
    status: 'stable'
  },
  {
    country1: { name: 'Burgundie', flag: '🇫🇷', power: 'Global Power' },
    country2: { name: 'Latium', flag: '🇮🇹', power: 'Global Power' },
    relationship: 92,
    trend: '+5',
    type: 'Regional Partnership',
    lastEvent: 'Cultural exchange program',
    eventTime: '1 week ago',
    tradeVolume: '$890B',
    militaryCooperation: 'Medium',
    status: 'improving'
  },
  {
    country1: { name: 'Sarpadon', flag: '🇬🇷', power: 'Major Power' },
    country2: { name: 'Dericania', flag: '🇮🇳', power: 'Regional Power' },
    relationship: 68,
    trend: '-3',
    type: 'Trade Partnership',
    lastEvent: 'Border dispute mediation',
    eventTime: '3 days ago',
    tradeVolume: '$420B',
    militaryCooperation: 'Low',
    status: 'tense'
  },
  {
    country1: { name: 'Veltorina', flag: '🇩🇪', power: 'Major Power' },
    country2: { name: 'Hendalarsk', flag: '🇸🇪', power: 'Regional Power' },
    relationship: 88,
    trend: '+1',
    type: 'Technology Alliance',
    lastEvent: 'Joint research initiative',
    eventTime: '5 days ago',
    tradeVolume: '$650B',
    militaryCooperation: 'Medium',
    status: 'stable'
  }
];

const diplomaticEvents = [
  {
    id: 1,
    type: 'summit',
    title: 'Global Economic Summit',
    participants: ['Caphira', 'Urcea', 'Burgundie', 'Latium'],
    date: 'Next month',
    priority: 'high',
    impact: 'Major trade agreements expected',
    icon: Handshake,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 2,
    type: 'conflict',
    title: 'Resource Dispute Resolution',
    participants: ['Sarpadon', 'Dericania'],
    date: 'Ongoing',
    priority: 'medium',
    impact: 'Regional stability concerns',
    icon: AlertTriangle,
    color: 'from-red-500 to-orange-500'
  },
  {
    id: 3,
    type: 'cooperation',
    title: 'Climate Initiative Launch',
    participants: ['Veltorina', 'Hendalarsk', 'Faneria'],
    date: 'This week',
    priority: 'medium',
    impact: 'Environmental cooperation framework',
    icon: Globe,
    color: 'from-green-500 to-emerald-500'
  }
];

const globalDiplomacy = {
  totalRelationships: 156,
  activeNegotiations: 23,
  treatiesThisYear: 47,
  avgRelationshipScore: 74.2,
  conflictRisk: 'Low',
  cooperationIndex: 82
};

const DiplomaticMatrix = () => {
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'network'


  const RelationshipCard = ({ relationship }: { relationship: Relationship }) => {
    const getRelationshipColor = (score: number) => {
      if (score >= 80) return 'text-green-400';
      if (score >= 60) return 'text-yellow-400';
      return 'text-red-400';
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'improving': return '📈';
        case 'stable': return '🤝';
        case 'tense': return '⚠️';
        default: return '🤝';
      }
    };

    return (
      <GlassCard variant="diplomatic" 
        className={`cursor-pointer hover:scale-[1.02] transition-all duration-300 ${
          selectedRelationship?.country1.name === relationship.country1.name && 
          selectedRelationship?.country2.name === relationship.country2.name ? 'ring-2 ring-blue-400/50' : ''
        }`}
        onClick={() => setSelectedRelationship(
          selectedRelationship?.country1.name === relationship.country1.name && 
          selectedRelationship?.country2.name === relationship.country2.name ? null : relationship
        )}
      >
        {/* Country Flags and Names */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">{relationship.country1.flag}</span>
              <div>
                <div className="text-white font-medium">{relationship.country1.name}</div>
                <div className="text-white/60 text-xs">{relationship.country1.power}</div>
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <span className="text-2xl">{getStatusIcon(relationship.status)}</span>
              <div className={`text-2xl font-bold ${getRelationshipColor(relationship.relationship)}`}>
                {relationship.relationship}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <div className="text-white font-medium">{relationship.country2.name}</div>
                <div className="text-white/60 text-xs">{relationship.country2.power}</div>
              </div>
              <span className="text-3xl">{relationship.country2.flag}</span>
            </div>
          </div>
        </div>

        {/* Relationship Type and Trend */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm px-3 py-1 rounded-full bg-blue-500/20 text-blue-400">
            {relationship.type}
          </span>
          <div className="flex items-center space-x-2">
            <span className={`text-sm font-medium ${
              relationship.trend.startsWith('+') ? 'text-green-400' : 'text-red-400'
            }`}>
              {relationship.trend}
            </span>
            <span className="text-white/60 text-xs">this month</span>
          </div>
        </div>

        {/* Last Event */}
        <div className="text-sm text-white/80 mb-2">{relationship.lastEvent}</div>
        <div className="text-xs text-white/60 mb-4">{relationship.eventTime}</div>

        {selectedRelationship?.country1.name === relationship.country1.name && 
         selectedRelationship?.country2.name === relationship.country2.name && (
          <div className="border-t border-white/10 pt-4 animate-in slide-in-from-top duration-300">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-white/60 mb-1">Trade Volume</div>
                <div className="text-white font-medium">{relationship.tradeVolume}</div>
              </div>
              <div>
                <div className="text-white/60 mb-1">Military Cooperation</div>
                <div className={`font-medium ${
                  relationship.militaryCooperation === 'High' ? 'text-green-400' :
                  relationship.militaryCooperation === 'Medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {relationship.militaryCooperation}
                </div>
              </div>
            </div>
            
            <button className="w-full mt-4 p-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 transition-all text-blue-400 text-sm font-medium">
              View Detailed Analysis →
            </button>
          </div>
        )}
      </GlassCard>
    );
  };

  const EventCard = ({ event }: { event: DiplomaticEvent }) => (
    <GlassCard variant="diplomatic">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-white/20">
            <event.icon className="w-5 h-5 text-white" />
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            event.priority === 'high' ? 'bg-red-500/30 text-red-300' :
            'bg-yellow-500/30 text-yellow-300'
          }`}>
            {event.priority.toUpperCase()}
          </span>
        </div>
        <span className="text-xs text-white/70">{event.date}</span>
      </div>
      
      <h3 className="text-white font-bold mb-2">{event.title}</h3>
      <p className="text-white/80 text-sm mb-3">{event.impact}</p>
      
      <div className="flex flex-wrap gap-1">
                    {event.participants.map((country: string, idx: number) => (
          <span key={idx} className="text-xs px-2 py-1 bg-white/20 rounded-full text-white/80">
            {country}
          </span>
        ))}
      </div>
    </GlassCard>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Diplomatic Matrix</h1>
            <p className="text-white/60">Global relationship monitoring and diplomatic intelligence</p>
          </div>
          
          <div className="flex items-center space-x-3">
            <GlassCard variant="diplomatic" className="px-4 py-2">
              <div className="flex items-center space-x-2">
                <Heart className="w-4 h-4 text-green-400" />
                <span className="text-white/80 text-sm font-medium">
                  {globalDiplomacy.avgRelationshipScore.toFixed(1)} Avg Relations
                </span>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Global Diplomacy Overview */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-white">{globalDiplomacy.totalRelationships}</div>
            <div className="text-white/60 text-sm">Total Relations</div>
          </GlassCard>
          
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-yellow-400">{globalDiplomacy.activeNegotiations}</div>
            <div className="text-white/60 text-sm">Active Talks</div>
          </GlassCard>
          
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-green-400">{globalDiplomacy.treatiesThisYear}</div>
            <div className="text-white/60 text-sm">Treaties (YTD)</div>
          </GlassCard>
          
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-blue-400">{globalDiplomacy.cooperationIndex}</div>
            <div className="text-white/60 text-sm">Cooperation</div>
          </GlassCard>
          
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-green-400">{globalDiplomacy.conflictRisk}</div>
            <div className="text-white/60 text-sm">Conflict Risk</div>
          </GlassCard>
          
          <GlassCard variant="diplomatic" className="text-center">
            <div className="text-2xl font-bold text-purple-400">74.2</div>
            <div className="text-white/60 text-sm">Avg Score</div>
          </GlassCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Relationships Grid */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">Key Relationships</h2>
            
            <div className="flex items-center space-x-3">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm outline-none"
              >
                <option value="all" className="bg-slate-800">All Types</option>
                <option value="alliance" className="bg-slate-800">Alliances</option>
                <option value="partnership" className="bg-slate-800">Partnerships</option>
                <option value="cooperation" className="bg-slate-800">Cooperation</option>
              </select>
            </div>
          </div>
          
          <div className="space-y-4">
            {relationshipData.map((relationship, index) => (
              <RelationshipCard key={index} relationship={relationship} />
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Events */}
          <div>
            <h3 className="text-xl font-bold text-white mb-4">Diplomatic Events</h3>
            <div className="space-y-4">
              {diplomaticEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          </div>

          {/* Relationship Health */}
          <GlassCard variant="diplomatic">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Relationship Health</h3>
              <Heart className="w-5 h-5 text-green-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Strong Relations</span>
                <span className="text-green-400 font-medium">12</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Neutral Relations</span>
                <span className="text-yellow-400 font-medium">8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Tense Relations</span>
                <span className="text-red-400 font-medium">3</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Conflicts</span>
                <span className="text-red-400 font-medium">0</span>
              </div>
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard variant="diplomatic">
            <h3 className="text-white font-bold mb-4">Quick Actions</h3>
            
            <div className="space-y-2">
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Generate Diplomatic Report
              </button>
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Schedule Summit
              </button>
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Mediation Request
              </button>
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Alert Settings
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default DiplomaticMatrix;