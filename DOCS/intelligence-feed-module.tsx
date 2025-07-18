import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, TrendingUp, Globe, Users, DollarSign, Zap, Eye, Target, Bell, Filter, Search, Calendar, MapPin, ArrowRight } from 'lucide-react';

const intelligenceData = [
  {
    id: 1,
    type: 'economic',
    priority: 'high',
    title: 'Trade Route Disruption Alert',
    description: 'Major shipping lane through Latium experiencing delays due to infrastructure maintenance',
    impact: 'Global trade volume may decrease by 0.3% this quarter',
    source: 'Trade Intelligence Network',
    confidence: 87,
    timestamp: '2 minutes ago',
    countries: ['Latium', 'Burgundie', 'Sarpadon'],
    icon: DollarSign,
    color: 'from-red-500 to-orange-500'
  },
  {
    id: 2,
    type: 'political',
    priority: 'medium',
    title: 'Diplomatic Summit Scheduled',
    description: 'Caphira announces multi-lateral economic cooperation summit next quarter',
    impact: 'Potential new trade agreements could boost regional GDP by 2-4%',
    source: 'Diplomatic Monitoring',
    confidence: 92,
    timestamp: '15 minutes ago',
    countries: ['Caphira', 'Urcea', 'Burgundie'],
    icon: Globe,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 3,
    type: 'social',
    priority: 'low',
    title: 'Population Growth Acceleration',
    description: 'Dericania reports unexpected 0.8% population increase this month',
    impact: 'Labor force expansion may drive economic growth acceleration',
    source: 'Demographic Intelligence',
    confidence: 76,
    timestamp: '1 hour ago',
    countries: ['Dericania'],
    icon: Users,
    color: 'from-green-500 to-emerald-500'
  },
  {
    id: 4,
    type: 'technological',
    priority: 'high',
    title: 'Innovation Breakthrough',
    description: 'Veltorina unveils new renewable energy technology, claims 40% efficiency increase',
    impact: 'Could disrupt global energy markets and accelerate clean tech adoption',
    source: 'Technology Watch',
    confidence: 94,
    timestamp: '3 hours ago',
    countries: ['Veltorina'],
    icon: Zap,
    color: 'from-purple-500 to-pink-500'
  },
  {
    id: 5,
    type: 'economic',
    priority: 'medium',
    title: 'Resource Discovery',
    description: 'Faneria announces significant lithium deposits found in northern regions',
    impact: 'Global lithium prices may decrease, affecting EV industry supply chains',
    source: 'Resource Intelligence',
    confidence: 89,
    timestamp: '6 hours ago',
    countries: ['Faneria'],
    icon: Target,
    color: 'from-yellow-500 to-orange-500'
  }
];

const trendingTopics = [
  { topic: 'Trade Wars', mentions: 247, trend: '+12%', sentiment: 'negative' },
  { topic: 'Clean Energy', mentions: 189, trend: '+28%', sentiment: 'positive' },
  { topic: 'Digital Currency', mentions: 156, trend: '+45%', sentiment: 'neutral' },
  { topic: 'Labor Shortage', mentions: 134, trend: '+8%', sentiment: 'negative' }
];

const networkActivity = {
  totalSources: 1247,
  activeSources: 892,
  alertsToday: 23,
  avgConfidence: 84
};

const IntelligenceFeed = () => {
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIntel, setSelectedIntel] = useState(null);

  const GlassCard = ({ children, className = "", gradient = "" }) => (
    <div className={`relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl hover:shadow-3xl transition-all duration-300 ${gradient && `bg-gradient-to-br ${gradient}`} ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl" />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );

  const IntelCard = ({ intel }) => (
    <GlassCard 
      className={`cursor-pointer hover:scale-[1.02] transition-all duration-300 ${
        selectedIntel?.id === intel.id ? 'ring-2 ring-blue-400/50' : ''
      }`}
      onClick={() => setSelectedIntel(selectedIntel?.id === intel.id ? null : intel)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl bg-gradient-to-r ${intel.color} shadow-lg`}>
            <intel.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              intel.priority === 'high' ? 'bg-red-500/20 text-red-400' :
              intel.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {intel.priority.toUpperCase()}
            </span>
            <span className="text-xs text-white/60 ml-2">{intel.timestamp}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/60">Confidence</div>
          <div className="text-sm font-bold text-white">{intel.confidence}%</div>
        </div>
      </div>

      <h3 className="text-white font-bold text-lg mb-2">{intel.title}</h3>
      <p className="text-white/80 text-sm mb-3">{intel.description}</p>
      
      <div className="flex items-center justify-between">
        <div className="flex space-x-1">
          {intel.countries.slice(0, 3).map((country, idx) => (
            <span key={idx} className="text-xs px-2 py-1 bg-white/10 rounded-full text-white/70">
              {country}
            </span>
          ))}
        </div>
        <ArrowRight className="w-4 h-4 text-white/40" />
      </div>

      {selectedIntel?.id === intel.id && (
        <div className="mt-4 pt-4 border-t border-white/10 animate-in slide-in-from-top duration-300">
          <div className="mb-3">
            <h4 className="text-white font-medium text-sm mb-1">Projected Impact</h4>
            <p className="text-white/70 text-sm">{intel.impact}</p>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-white/60">Source: {intel.source}</span>
            <span className="text-blue-400 font-medium">View Full Report →</span>
          </div>
        </div>
      )}
    </GlassCard>
  );

  const filteredIntel = intelligenceData.filter(intel => {
    const matchesFilter = filter === 'all' || intel.type === filter;
    const matchesSearch = intel.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         intel.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Intelligence Feed</h1>
            <p className="text-white/60">Real-time global intelligence and early warning system</p>
          </div>
          <div className="flex items-center space-x-3">
            <GlassCard className="px-4 py-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-white/80 text-sm font-medium">{networkActivity.activeSources} Sources Active</span>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex space-x-4 mb-6">
          <GlassCard className="flex-1">
            <div className="flex items-center space-x-3">
              <Search className="w-5 h-5 text-white/60" />
              <input
                type="text"
                placeholder="Search intelligence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent text-white placeholder-white/50 outline-none flex-1"
              />
            </div>
          </GlassCard>
          
          <GlassCard className="px-4 py-3">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-transparent text-white outline-none"
            >
              <option value="all" className="bg-slate-800">All Types</option>
              <option value="economic" className="bg-slate-800">Economic</option>
              <option value="political" className="bg-slate-800">Political</option>
              <option value="social" className="bg-slate-800">Social</option>
              <option value="technological" className="bg-slate-800">Technology</option>
            </select>
          </GlassCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Feed */}
        <div className="lg:col-span-3 space-y-4">
          {filteredIntel.map((intel) => (
            <IntelCard key={intel.id} intel={intel} />
          ))}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Network Status */}
          <GlassCard gradient="from-blue-500/10 to-cyan-500/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Network Status</h3>
              <Eye className="w-5 h-5 text-blue-400" />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Total Sources</span>
                <span className="text-white font-medium">{networkActivity.totalSources}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Active Now</span>
                <span className="text-green-400 font-medium">{networkActivity.activeSources}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Alerts Today</span>
                <span className="text-yellow-400 font-medium">{networkActivity.alertsToday}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/70 text-sm">Avg Confidence</span>
                <span className="text-blue-400 font-medium">{networkActivity.avgConfidence}%</span>
              </div>
            </div>
          </GlassCard>

          {/* Trending Topics */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">Trending Topics</h3>
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            
            <div className="space-y-3">
              {trendingTopics.map((topic, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-pointer">
                  <div>
                    <div className="text-white font-medium text-sm">{topic.topic}</div>
                    <div className="text-white/60 text-xs">{topic.mentions} mentions</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      topic.sentiment === 'positive' ? 'text-green-400' :
                      topic.sentiment === 'negative' ? 'text-red-400' :
                      'text-yellow-400'
                    }`}>
                      {topic.trend}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Quick Actions */}
          <GlassCard gradient="from-purple-500/10 to-pink-500/10">
            <h3 className="text-white font-bold mb-4">Quick Actions</h3>
            
            <div className="space-y-2">
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Generate Report
              </button>
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Set Alert Threshold
              </button>
              <button className="w-full p-3 rounded-xl bg-white/10 hover:bg-white/20 transition-all text-white text-sm font-medium text-left">
                Export Data
              </button>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};

export default IntelligenceFeed;