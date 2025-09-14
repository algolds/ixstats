"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '~/lib/utils';
import { 
  Send, 
  Image, 
  BarChart3, 
  TrendingUp, 
  Globe, 
  Loader2, 
  X, 
  Plus,
  Sparkles
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { api } from '~/trpc/react';
import { toast } from 'sonner';

interface GlassCanvasComposerProps {
  account: any;
  onPost: () => void;
  placeholder?: string;
  countryId: string;
}

interface DataVisualization {
  id: string;
  type: 'economic_chart' | 'diplomatic_map' | 'trade_flow' | 'gdp_growth';
  title: string;
  data: any;
  config: any;
}

export function GlassCanvasComposer({ 
  account, 
  onPost, 
  placeholder = "What's happening in your nation?",
  countryId 
}: GlassCanvasComposerProps) {
  const [content, setContent] = useState('');
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);

  // Get latest economic data for visualizations
  const { data: economicData } = api.countries.getEconomicData.useQuery({ countryId });
  const { data: gdpHistoryData } = api.countries.getHistoricalData.useQuery({ countryId });
  const { data: diplomaticData } = api.diplomatic.getRelationships.useQuery({ countryId });
  const { data: tradeData } = api.countries.getTradeData.useQuery({ countryId });

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      toast.success("Post shared successfully!");
      setContent('');
      setSelectedVisualizations([]);
      onPost();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create post");
    }
  });

  const handleSubmit = useCallback(() => {
    if (!content.trim() && selectedVisualizations.length === 0) {
      toast.error("Please add content or a visualization");
      return;
    }

    // Create post with embedded visualizations
    const postData = {
      userId: account.id,
      content: content.trim(),
      hashtags: extractHashtags(content),
      mentions: extractMentions(content),
      visibility: 'public' as const,
      visualizations: selectedVisualizations.map(viz => ({
        type: viz.type,
        title: viz.title,
        config: viz.config
      }))
    };

    createPostMutation.mutate(postData);
  }, [content, selectedVisualizations, account.id, createPostMutation]);

  const extractHashtags = (text: string): string[] => {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
  };

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@[\w]+/g);
    return mentions ? mentions.map(mention => mention.substring(1)) : [];
  };

  const addVisualization = (type: DataVisualization['type']) => {
    setIsGeneratingVisualization(true);
    
    // Simulate creating a visualization based on live data
    setTimeout(() => {
      let newVisualization: DataVisualization;
      
      switch (type) {
        case 'economic_chart':
          newVisualization = {
            id: `econ-${Date.now()}`,
            type: 'economic_chart',
            title: 'GDP Growth Trajectory',
            data: gdpHistoryData || [],
            config: {
              chartType: 'line',
              colors: ['#3B82F6', '#10B981'],
              showGrid: true,
              timeRange: '6M'
            }
          };
          break;
        case 'diplomatic_map':
          newVisualization = {
            id: `diplo-${Date.now()}`,
            type: 'diplomatic_map',
            title: 'Diplomatic Relations Map',
            data: diplomaticData || [],
            config: {
              mapType: 'world',
              showRelationStrength: true,
              colorScheme: 'diplomatic'
            }
          };
          break;
        case 'trade_flow':
          newVisualization = {
            id: `trade-${Date.now()}`,
            type: 'trade_flow',
            title: 'Trade Flow Analysis',
            data: tradeData || [],
            config: {
              flowType: 'sankey',
              showVolumes: true,
              timeframe: 'current_quarter'
            }
          };
          break;
        case 'gdp_growth':
          newVisualization = {
            id: `gdp-${Date.now()}`,
            type: 'gdp_growth',
            title: 'Economic Performance Overview',
            data: economicData || {},
            config: {
              metrics: ['gdp', 'inflation', 'unemployment'],
              displayType: 'dashboard',
              comparison: 'regional_average'
            }
          };
          break;
        default:
          return;
      }

      setSelectedVisualizations(prev => [...prev, newVisualization]);
      setIsGeneratingVisualization(false);
      toast.success(`${newVisualization.title} added to post`);
    }, 1000);
  };

  const removeVisualization = (id: string) => {
    setSelectedVisualizations(prev => prev.filter(viz => viz.id !== id));
  };

  const getVisualizationPreview = (viz: DataVisualization) => {
    switch (viz.type) {
      case 'economic_chart':
        return (
          <div className="w-full h-24 bg-gradient-to-r from-blue-500/20 to-green-500/20 rounded flex items-center justify-center">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-400" />
              <div className="text-sm">
                <div className="font-medium">GDP: +{(((economicData as any)?.adjustedGdpGrowth || 0.03) * 100).toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">Q4 Performance</div>
              </div>
            </div>
          </div>
        );
      case 'diplomatic_map':
        return (
          <div className="w-full h-24 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Globe className="h-6 w-6 text-blue-400" />
              <div className="text-sm">
                <div className="font-medium">{diplomaticData?.length || 12} Relations</div>
                <div className="text-xs text-muted-foreground">Global Network</div>
              </div>
            </div>
          </div>
        );
      case 'trade_flow':
        return (
          <div className="w-full h-24 bg-gradient-to-r from-purple-500/20 to-orange-500/20 rounded flex items-center justify-center">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-purple-400" />
              <div className="text-sm">
                <div className="font-medium">${((tradeData?.totalVolume || 2.4) / 1000).toFixed(1)}B</div>
                <div className="text-xs text-muted-foreground">Trade Volume</div>
              </div>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-24 bg-gradient-to-r from-gray-500/20 to-gray-400/20 rounded flex items-center justify-center">
            <BarChart3 className="h-6 w-6 text-gray-400" />
          </div>
        );
    }
  };

  const characterLimit = 280;
  const remainingChars = characterLimit - content.length;

  return (
    <Card className="glass-hierarchy-child border-blue-500/30 bg-blue-500/5">
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Account Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {account.displayName.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm">{account.displayName}</div>
              <div className="text-xs text-muted-foreground">@{account.username}</div>
            </div>
            <Badge variant="outline" className="ml-auto">
              Glass Canvas
            </Badge>
          </div>

          {/* Text Composer */}
          <div className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={placeholder}
              className="min-h-24 resize-none border-0 bg-white/5 backdrop-blur-sm focus:bg-white/10 transition-all"
              maxLength={characterLimit}
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Enhanced with live economic data
              </span>
              <span className={cn(
                "font-medium",
                remainingChars < 20 ? "text-red-400" : remainingChars < 50 ? "text-orange-400" : "text-muted-foreground"
              )}>
                {remainingChars}
              </span>
            </div>
          </div>

          {/* Selected Visualizations */}
          <AnimatePresence>
            {selectedVisualizations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {selectedVisualizations.map((viz) => (
                  <motion.div
                    key={viz.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative p-3 border border-white/10 rounded-lg bg-white/5"
                  >
                    <button
                      onClick={() => removeVisualization(viz.id)}
                      className="absolute top-2 right-2 p-1 hover:bg-red-500/20 rounded-full transition-colors"
                    >
                      <X className="h-4 w-4 text-red-400" />
                    </button>
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{viz.title}</div>
                      {getVisualizationPreview(viz)}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Visualization Panel */}
          <AnimatePresence>
            {showVisualizationPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="border border-white/10 rounded-lg p-3 bg-white/5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  <span className="font-medium text-sm">Add Live Data Visualization</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('economic_chart')}
                    disabled={isGeneratingVisualization}
                    className="h-auto flex-col p-3"
                  >
                    <TrendingUp className="h-6 w-6 mb-1" />
                    <span className="text-xs">Economic Chart</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('diplomatic_map')}
                    disabled={isGeneratingVisualization}
                    className="h-auto flex-col p-3"
                  >
                    <Globe className="h-6 w-6 mb-1" />
                    <span className="text-xs">Diplomatic Map</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('trade_flow')}
                    disabled={isGeneratingVisualization}
                    className="h-auto flex-col p-3"
                  >
                    <BarChart3 className="h-6 w-6 mb-1" />
                    <span className="text-xs">Trade Flows</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('gdp_growth')}
                    disabled={isGeneratingVisualization}
                    className="h-auto flex-col p-3"
                  >
                    <BarChart3 className="h-6 w-6 mb-1" />
                    <span className="text-xs">GDP Dashboard</span>
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowVisualizationPanel(!showVisualizationPanel)}
                className="text-blue-400 hover:text-blue-300"
              >
                {isGeneratingVisualization ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Data Viz
              </Button>
              <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300">
                <Image className="h-4 w-4" />
                Media
              </Button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createPostMutation.isPending || (!content.trim() && selectedVisualizations.length === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {createPostMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}