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
  Sparkles,
  Repeat2,
  ChevronDown,
  ChevronUp,
  Users
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Textarea } from '~/components/ui/textarea';
import { Card, CardContent } from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { api } from '~/trpc/react';
import { toast } from 'sonner';
import { MediaSearchModal } from '~/components/MediaSearchModal';

interface GlassCanvasComposerProps {
  account: any;
  accounts: any[];
  onAccountSelect?: (account: any) => void;
  onAccountSettings?: (account: any) => void;
  onCreateAccount?: () => void;
  isOwner: boolean;
  onPost: () => void;
  placeholder?: string;
  countryId: string;
  repostData?: {
    originalPost: any;
    mode: 'repost';
  };
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
  accounts,
  onAccountSelect,
  onAccountSettings,
  onCreateAccount,
  isOwner,
  onPost,
  placeholder = "What's happening in your nation?",
  countryId,
  repostData
}: GlassCanvasComposerProps) {
  const [content, setContent] = useState('');
  const [selectedVisualizations, setSelectedVisualizations] = useState<DataVisualization[]>([]);
  const [showVisualizationPanel, setShowVisualizationPanel] = useState(false);
  const [isGeneratingVisualization, setIsGeneratingVisualization] = useState(false);
  const [showAccountManager, setShowAccountManager] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Get latest economic data for visualizations - live wired
  const { data: economicData, isLoading: isLoadingEconomic } = api.countries.getEconomicData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: gdpHistoryData, isLoading: isLoadingHistory } = api.countries.getHistoricalData.useQuery(
    { countryId, limit: 30 },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: diplomaticData, isLoading: isLoadingDiplomatic } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );
  const { data: tradeData, isLoading: isLoadingTrade } = api.countries.getTradeData.useQuery(
    { countryId },
    { enabled: !!countryId, refetchOnWindowFocus: false }
  );

  // Check if we have data available for visualizations
  const hasEconomicData = !!economicData;
  const hasHistoricalData = !!gdpHistoryData && gdpHistoryData.length > 0;
  const hasDiplomaticData = !!diplomaticData && diplomaticData.length > 0;
  const hasTradeData = !!tradeData;

  const createPostMutation = api.thinkpages.createPost.useMutation({
    onSuccess: () => {
      toast.success("Post shared successfully!");
      setContent('');
      setSelectedVisualizations([]);
      setSelectedImages([]);
      onPost();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create post");
    }
  });

  const handleSubmit = useCallback(() => {
    if (!content.trim() && selectedVisualizations.length === 0 && selectedImages.length === 0) {
      toast.error("Please add content, a visualization, or an image");
      return;
    }

    // Create post with embedded visualizations and media
    const postData = {
      accountId: account.id,
      content: content.trim(),
      hashtags: extractHashtags(content),
      mentions: extractMentions(content),
      visibility: 'public' as const,
      visualizations: selectedVisualizations.map(viz => ({
        type: viz.type,
        title: viz.title,
        config: viz.config
      })),
      mediaUrls: selectedImages,
      repostOfId: repostData?.originalPost?.id
    };

    createPostMutation.mutate(postData);
  }, [content, selectedVisualizations, selectedImages, account.id, createPostMutation, repostData]);

  const extractHashtags = (text: string): string[] => {
    const hashtags = text.match(/#[\w]+/g);
    return hashtags ? hashtags.map(tag => tag.substring(1)) : [];
  };

  const extractMentions = (text: string): string[] => {
    const mentions = text.match(/@[\w]+/g);
    return mentions ? mentions.map(mention => mention.substring(1)) : [];
  };

  const addVisualization = (type: DataVisualization['type']) => {
    // Validate data availability before adding visualization
    let hasRequiredData = false;
    let errorMessage = '';

    switch (type) {
      case 'economic_chart':
        hasRequiredData = hasHistoricalData;
        errorMessage = 'No historical GDP data available for this country';
        break;
      case 'diplomatic_map':
        hasRequiredData = hasDiplomaticData;
        errorMessage = 'No diplomatic relationships data available';
        break;
      case 'trade_flow':
        hasRequiredData = hasTradeData;
        errorMessage = 'No trade data available for this country';
        break;
      case 'gdp_growth':
        hasRequiredData = hasEconomicData;
        errorMessage = 'No economic data available for this country';
        break;
    }

    if (!hasRequiredData) {
      toast.error(errorMessage);
      return;
    }

    setIsGeneratingVisualization(true);
    
    // Create visualization based on live data
    setTimeout(() => {
      let newVisualization: DataVisualization;
      
      switch (type) {
        case 'economic_chart':
          newVisualization = {
            id: `econ-${Date.now()}`,
            type: 'economic_chart',
            title: 'GDP Growth Trajectory',
            data: gdpHistoryData!,
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
            data: diplomaticData!,
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
            data: tradeData!,
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
            data: economicData!,
            config: {
              metrics: ['gdp', 'inflation', 'unemployment'],
              displayType: 'dashboard',
              comparison: 'regional_average'
            }
          };
          break;
        default:
          setIsGeneratingVisualization(false);
          return;
      }

      setSelectedVisualizations(prev => [...prev, newVisualization]);
      setIsGeneratingVisualization(false);
      toast.success(`${newVisualization.title} added to post`);
    }, 800);
  };

  const removeVisualization = (id: string) => {
    setSelectedVisualizations(prev => prev.filter(viz => viz.id !== id));
  };

  const handleImageSelect = (imageUrl: string) => {
    if (selectedImages.length >= 4) {
      toast.error("Maximum 4 images per post");
      return;
    }
    setSelectedImages(prev => [...prev, imageUrl]);
    setShowMediaModal(false);
    toast.success("Image added to post");
  };

  const removeImage = (imageUrl: string) => {
    setSelectedImages(prev => prev.filter(url => url !== imageUrl));
  };

  const handleFileUpload = async (file: File) => {
    if (selectedImages.length >= 4) {
      toast.error("Maximum 4 images per post");
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setSelectedImages(prev => [...prev, result.dataUrl]);
        toast.success("Image uploaded successfully");
      } else {
        toast.error(result.error || "Failed to upload image");
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error("Failed to upload image");
    } finally {
      setIsUploadingImage(false);
    }
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
          {/* Account Info with Manager */}
          <Collapsible open={showAccountManager} onOpenChange={setShowAccountManager}>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={account.profileImageUrl} alt={account.displayName} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white font-semibold">
                  {account.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium text-sm">{account.displayName}</div>
                <div className="text-xs text-muted-foreground">@{account.username}</div>
              </div>
              <Badge variant="outline" className="mr-2">
                Glass Canvas
              </Badge>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  {showAccountManager ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent className="mt-3">
              <div className="border-t border-white/10 pt-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm">Switch Account</h4>
                  {isOwner && accounts.length < 25 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onCreateAccount}
                      className="h-7 text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      New Account
                    </Button>
                  )}
                </div>
                
                <div className="grid gap-2 max-h-40 overflow-y-auto">
                  {accounts.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => {
                        onAccountSelect?.(acc);
                        setShowAccountManager(false);
                      }}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                        acc.id === account.id
                          ? "bg-blue-500/20 border border-blue-500/30"
                          : "hover:bg-white/10 border border-transparent"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={acc.profileImageUrl} />
                        <AvatarFallback className="text-xs">
                          {acc.displayName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs truncate">{acc.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate">@{acc.username}</div>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                        {acc.accountType}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Embedded Repost Display */}
          {repostData && (
            <Card className="border-green-500/30 bg-green-500/5 p-3">
              <div className="flex items-center gap-2 text-green-500 text-xs mb-2">
                <Repeat2 className="h-3 w-3" />
                <span>Reposting</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={repostData.originalPost.account?.profileImageUrl} alt={repostData.originalPost.account?.displayName} />
                  <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-xs font-semibold">
                    {repostData.originalPost.account?.displayName?.charAt(0) || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-sm">{repostData.originalPost.account?.displayName || 'Unknown'}</span>
                    <span className="text-muted-foreground text-xs">@{repostData.originalPost.account?.username || 'unknown'}</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground line-clamp-3">
                {repostData.originalPost.content}
              </div>
            </Card>
          )}

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
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">
                  Enhanced with live data
                </span>
                {(hasEconomicData || hasHistoricalData || hasDiplomaticData || hasTradeData) && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-400 border-green-500/30">
                    Live
                  </Badge>
                )}
              </div>
              <span className={cn(
                "font-medium",
                remainingChars < 20 ? "text-red-400" : remainingChars < 50 ? "text-orange-400" : "text-muted-foreground"
              )}>
                {remainingChars}
              </span>
            </div>
          </div>

          {/* Selected Images */}
          <AnimatePresence>
            {selectedImages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-2"
              >
                {selectedImages.map((imageUrl, index) => (
                  <motion.div
                    key={imageUrl}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative aspect-video rounded-lg overflow-hidden border border-white/10 bg-white/5"
                  >
                    <button
                      onClick={() => removeImage(imageUrl)}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-red-500/80 rounded-full transition-colors z-10"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                    <img
                      src={imageUrl}
                      alt={`Selected image ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-sm">Add Live Data Visualization</span>
                  </div>
                  {(isLoadingEconomic || isLoadingHistory || isLoadingDiplomatic || isLoadingTrade) && (
                    <div className="flex items-center gap-1 text-xs text-blue-400">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Loading data...</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('economic_chart')}
                    disabled={isGeneratingVisualization || isLoadingHistory || !hasHistoricalData}
                    className="h-auto flex-col p-3"
                  >
                    {isLoadingHistory ? (
                      <Loader2 className="h-6 w-6 mb-1 animate-spin" />
                    ) : (
                      <TrendingUp className="h-6 w-6 mb-1" />
                    )}
                    <span className="text-xs">Economic Chart</span>
                    {!hasHistoricalData && !isLoadingHistory && (
                      <span className="text-[10px] text-red-400">No data</span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('diplomatic_map')}
                    disabled={isGeneratingVisualization || isLoadingDiplomatic || !hasDiplomaticData}
                    className="h-auto flex-col p-3"
                  >
                    {isLoadingDiplomatic ? (
                      <Loader2 className="h-6 w-6 mb-1 animate-spin" />
                    ) : (
                      <Globe className="h-6 w-6 mb-1" />
                    )}
                    <span className="text-xs">Diplomatic Map</span>
                    {!hasDiplomaticData && !isLoadingDiplomatic && (
                      <span className="text-[10px] text-red-400">No data</span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('trade_flow')}
                    disabled={isGeneratingVisualization || isLoadingTrade || !hasTradeData}
                    className="h-auto flex-col p-3"
                  >
                    {isLoadingTrade ? (
                      <Loader2 className="h-6 w-6 mb-1 animate-spin" />
                    ) : (
                      <BarChart3 className="h-6 w-6 mb-1" />
                    )}
                    <span className="text-xs">Trade Flows</span>
                    {!hasTradeData && !isLoadingTrade && (
                      <span className="text-[10px] text-red-400">No data</span>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => addVisualization('gdp_growth')}
                    disabled={isGeneratingVisualization || isLoadingEconomic || !hasEconomicData}
                    className="h-auto flex-col p-3"
                  >
                    {isLoadingEconomic ? (
                      <Loader2 className="h-6 w-6 mb-1 animate-spin" />
                    ) : (
                      <BarChart3 className="h-6 w-6 mb-1" />
                    )}
                    <span className="text-xs">GDP Dashboard</span>
                    {!hasEconomicData && !isLoadingEconomic && (
                      <span className="text-[10px] text-red-400">No data</span>
                    )}
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMediaModal(true)}
                disabled={isUploadingImage || selectedImages.length >= 4}
                className="text-green-400 hover:text-green-300"
              >
                {isUploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Image className="h-4 w-4" />
                )}
                Media
                {selectedImages.length > 0 && (
                  <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0 h-4">
                    {selectedImages.length}/4
                  </Badge>
                )}
              </Button>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={createPostMutation.isPending || (!content.trim() && selectedVisualizations.length === 0 && selectedImages.length === 0)}
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

      {/* Media Search Modal */}
      <MediaSearchModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onImageSelect={handleImageSelect}
      />
    </Card>
  );
}