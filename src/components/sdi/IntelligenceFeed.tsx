import React, { useState } from 'react';
import { GlassCard } from '../ui/enhanced-card';
import { InfiniteMovingCards } from '../ui/infinite-moving-cards';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangle, TrendingUp, Globe, Shield, DollarSign, Users, Clock } from 'lucide-react';
import { api } from '~/trpc/react';

interface IntelligenceItem {
  id: string;
  title: string;
  content: string;
  category: 'economic' | 'crisis' | 'diplomatic' | 'security' | 'technology' | 'environment';
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: string;
  timestamp: Date;
  region?: string;
  affectedCountries?: string[];
  isActive: boolean;
}

const categoryIcons = {
  economic: DollarSign,
  crisis: AlertTriangle,
  diplomatic: Globe,
  security: Shield,
  technology: TrendingUp,
  environment: Users
};

const priorityColors = {
  low: 'bg-gray-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500'
};

export default function IntelligenceFeed() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');

  // Live tRPC query with polling
  const { data, isLoading, error } = api.sdi.getIntelligenceFeed.useQuery({
    category: selectedCategory as 'all' | 'economic' | 'crisis' | 'diplomatic' | 'security' | 'technology' | 'environment',
    priority: selectedPriority as 'all' | 'low' | 'medium' | 'high' | 'critical',
    limit: 20,
    offset: 0,
  }, { refetchInterval: 5000 });

  const filteredData: IntelligenceItem[] = data?.data ?? [];

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getCategoryColor = (category: string) => {
    const colors = {
      economic: 'text-green-400',
      crisis: 'text-red-400',
      diplomatic: 'text-blue-400',
      security: 'text-purple-400',
      technology: 'text-cyan-400',
      environment: 'text-emerald-400'
    };
    return colors[category as keyof typeof colors] || 'text-gray-400';
  };

  return (
    <GlassCard variant="diplomatic" blur="prominent" glow="hover" className="p-0 lg:p-0 sdi-hero-card overflow-hidden relative animate-fade-in">
      {/* Aurora overlay for cinematic effect */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="aurora-bg opacity-40" />
      </div>
      
      <div className="relative z-10 p-8 lg:p-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-blue-100 tracking-tight diplomatic-header">
            Intelligence Feed
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-green-700/40 text-green-100 border-none">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Live
            </Badge>
            <span className="text-sm text-blue-300">{isLoading ? 'Loading...' : `${filteredData.length} active items`}</span>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
            <TabsList className="grid w-full grid-cols-7 bg-blue-900/20">
              <TabsTrigger value="all" className="text-blue-200">All</TabsTrigger>
              <TabsTrigger value="economic" className="text-green-400">Economic</TabsTrigger>
              <TabsTrigger value="crisis" className="text-red-400">Crisis</TabsTrigger>
              <TabsTrigger value="diplomatic" className="text-blue-400">Diplomatic</TabsTrigger>
              <TabsTrigger value="security" className="text-purple-400">Security</TabsTrigger>
              <TabsTrigger value="technology" className="text-cyan-400">Technology</TabsTrigger>
              <TabsTrigger value="environment" className="text-emerald-400">Environment</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Priority Filter */}
        <div className="mb-6 flex gap-2">
          {(['all', 'low', 'medium', 'high', 'critical'] as const).map(priority => (
            <Button
              key={priority}
              variant={selectedPriority === priority ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPriority(priority)}
              className={`${
                selectedPriority === priority 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-900/20 text-blue-200 border-blue-600'
              }`}
            >
              {priority === 'all' ? 'All' : priority.charAt(0).toUpperCase() + priority.slice(1)}
            </Button>
          ))}
        </div>

        {/* Loading/Error States */}
        {isLoading && (
          <div className="text-blue-300 text-center py-8">Loading intelligence feed...</div>
        )}
        {error && (
          <div className="text-red-400 text-center py-8">Error loading intelligence: {error.message}</div>
        )}

        {/* Intelligence Items Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {filteredData.map((item: IntelligenceItem) => {
            const IconComponent = categoryIcons[item.category as keyof typeof categoryIcons];
            return (
              <Card key={item.id} className="bg-blue-900/20 border-blue-700/30 hover:bg-blue-800/30 transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent className={`w-5 h-5 ${getCategoryColor(item.category)}`} />
                      <Badge className={`${priorityColors[item.priority as keyof typeof priorityColors]} text-white`}>
                        {item.priority}
                      </Badge>
                    </div>
                    <span className="text-xs text-blue-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(new Date(item.timestamp))}
                    </span>
                  </div>
                  <CardTitle className="text-blue-100 text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-blue-200 text-sm mb-3">{item.content}</p>
                  <div className="flex items-center justify-between text-xs text-blue-300">
                    <span>{item.source}</span>
                    {item.region && <span>{item.region}</span>}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Live Feed Ticker */}
        <div className="border-t border-blue-700/30 pt-6">
          <h3 className="text-lg font-semibold text-blue-100 mb-4">Live Intelligence Stream</h3>
          <InfiniteMovingCards
            items={filteredData.map((item: IntelligenceItem) => ({
              quote: item.content,
              name: item.source,
              title: item.category.charAt(0).toUpperCase() + item.category.slice(1),
              key: item.id
            }))}
            direction="left"
            speed="normal"
            pauseOnHover={true}
            className="bg-transparent sdi-intel-feed"
          />
        </div>
      </div>
    </GlassCard>
  );
} 