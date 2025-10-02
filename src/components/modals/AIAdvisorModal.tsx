"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Skeleton } from "~/components/ui/skeleton";
import { GlassCard } from "~/components/ui/enhanced-card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  RefreshCw,
  Download,
  Share2,
  Bookmark,
  Star,
  Target,
  Users,
  DollarSign,
  Globe,
  Shield,
  Zap,
  Brain,
  Sparkles,
  ArrowRight,
  ChevronRight,
  Activity,
} from "lucide-react";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface AIAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  countryId: string;
  countryName: string;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  recommendations?: AIRecommendation[];
}

interface AIRecommendation {
  id: string;
  type: 'economic' | 'social' | 'political' | 'environmental' | 'strategic';
  title: string;
  description: string;
  impact: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
  };
  confidence: number;
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  actions: string[];
  reasoning: string;
}

const RECOMMENDATION_COLORS = {
  economic: "#8b5cf6",
  social: "#06b6d4", 
  political: "#84cc16",
  environmental: "#f97316",
  strategic: "#ec4899"
};

const IMPACT_COLORS = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#ef4444",
  critical: "#dc2626"
};

const QUICK_QUESTIONS = [
  "What are the main economic risks for my country?",
  "How can I improve GDP growth?",
  "What population policies should I consider?",
  "What are the best investment opportunities?",
  "How can I reduce economic volatility?",
  "What infrastructure projects are most important?",
  "How can I improve social development?",
  "What environmental policies should I implement?"
];

export function AIAdvisorModal({
  isOpen,
  onClose,
  countryId,
  countryName,
}: AIAdvisorModalProps) {
  const [activeTab, setActiveTab] = useState("chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<AIRecommendation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get country data
  const { data: countryData, isLoading: countryLoading } = 
    api.countries.getByIdWithEconomicData.useQuery(
      { id: countryId },
      { enabled: isOpen }
    );

  // Get AI recommendations
  const { data: aiRecommendations, isLoading: recommendationsLoading } =
    api.eci.getAIRecommendations.useQuery(
      { userId: countryId || 'disabled' }, // Using countryId as userId for now
      { enabled: isOpen && !!countryId }
    );

  // Get advanced analytics for context
  const { data: advancedAnalytics, isLoading: analyticsLoading } =
    api.eci.getAdvancedAnalytics.useQuery(
      { userId: countryId || 'disabled' },
      { enabled: isOpen && !!countryId }
    );

  const isLoading = countryLoading || recommendationsLoading || analyticsLoading;

  // Initialize with welcome message
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: "welcome",
        type: "ai",
        content: `Hello! I'm your AI Economic Advisor for ${countryName}. I can help you analyze economic trends, provide strategic recommendations, and answer questions about your nation's development. How can I assist you today?`,
        timestamp: new Date(),
        recommendations: generateInitialRecommendations()
      };
      setMessages([welcomeMessage]);
    }
  }, [isOpen, countryName, messages.length]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Generate initial recommendations based on country data
  const generateInitialRecommendations = (): AIRecommendation[] => {
    if (!countryData) return [];

    const recommendations: AIRecommendation[] = [];

    // Economic recommendations
    if (countryData.adjustedGdpGrowth < 0.02) {
      recommendations.push({
        id: "econ-1",
        type: "economic",
        title: "Boost Economic Growth",
        description: "GDP growth is below optimal levels. Consider investment incentives and infrastructure development.",
        impact: { economic: 8, governance: 6 },
        confidence: 0.85,
        timeframe: "medium_term",
        actions: [
          "Increase public investment in infrastructure",
          "Implement tax incentives for businesses",
          "Improve trade policies",
          "Enhance education and skills training"
        ],
        reasoning: "Low GDP growth indicates underutilized economic potential. Strategic investments can stimulate economic activity and create sustainable growth."
      });
    }

    // Population recommendations
    if (countryData.populationGrowthRate < 0.01) {
      recommendations.push({
        id: "pop-1",
        type: "social",
        title: "Address Population Growth",
        description: "Population growth is declining. Consider policies to support demographic sustainability.",
        impact: { social: 6, governance: 4 },
        confidence: 0.78,
        timeframe: "long_term",
        actions: [
          "Implement family support programs",
          "Improve healthcare access",
          "Create immigration policies",
          "Support youth development programs"
        ],
        reasoning: "Declining population growth can lead to labor shortages and economic stagnation. Proactive policies can help maintain demographic balance."
      });
    }

    // Volatility recommendations
    if (advancedAnalytics?.volatility?.gdp && advancedAnalytics.volatility.gdp > 0.2) {
      recommendations.push({
        id: "vol-1",
        type: "economic",
        title: "Reduce Economic Volatility",
        description: "High GDP volatility detected. Implement stabilization measures.",
        impact: { economic: 7, governance: 5 },
        confidence: 0.82,
        timeframe: "immediate",
        actions: [
          "Diversify economic sectors",
          "Implement fiscal stabilization policies",
          "Strengthen financial regulations",
          "Create economic buffers"
        ],
        reasoning: "High volatility creates uncertainty for businesses and investors. Stabilization measures can improve economic predictability and growth."
      });
    }

    return recommendations.slice(0, 3); // Limit to top 3
  };

  // Process user message and generate AI response
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      const aiResponse = generateAIResponse(inputMessage);
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "ai",
        content: aiResponse.content,
        timestamp: new Date(),
        recommendations: aiResponse.recommendations
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsTyping(false);
    }, 1500);
  };

  // Generate AI response based on user input
  const generateAIResponse = (userInput: string): { content: string; recommendations?: AIRecommendation[] } => {
    const input = userInput.toLowerCase();
    
    // Economic growth questions
    if (input.includes("gdp") || input.includes("growth") || input.includes("economic")) {
      const growthRate = countryData?.adjustedGdpGrowth || 0;
      const content = `Your current GDP growth rate is ${(growthRate * 100).toFixed(1)}%. ${
        growthRate > 0.03 ? "This is a healthy growth rate!" : 
        growthRate > 0.01 ? "There's room for improvement." : 
        "This needs immediate attention."
      } I recommend focusing on investment in infrastructure, education, and technology to boost economic performance.`;
      
      return {
        content,
        recommendations: [{
          id: "gdp-response",
          type: "economic",
          title: "Economic Growth Strategy",
          description: "Comprehensive approach to boost GDP growth through strategic investments.",
          impact: { economic: 8, governance: 6 },
          confidence: 0.88,
          timeframe: "medium_term",
          actions: [
            "Increase infrastructure spending",
            "Improve education system",
            "Attract foreign investment",
            "Develop technology sector"
          ],
          reasoning: "Strategic investments in key sectors can create multiplier effects and sustainable economic growth."
        }]
      };
    }

    // Population questions
    if (input.includes("population") || input.includes("demographic")) {
      const popGrowth = countryData?.populationGrowthRate || 0;
      const content = `Your population growth rate is ${(popGrowth * 100).toFixed(1)}%. ${
        popGrowth > 0.015 ? "This indicates healthy population dynamics." :
        popGrowth > 0.005 ? "Population growth is moderate." :
        "Population growth is concerning and may need policy intervention."
      } Consider policies that support sustainable population growth while maintaining quality of life.`;
      
      return {
        content,
        recommendations: [{
          id: "pop-response",
          type: "social",
          title: "Population Policy Framework",
          description: "Balanced approach to population management and social development.",
          impact: { social: 6, governance: 4 },
          confidence: 0.75,
          timeframe: "long_term",
          actions: [
            "Implement family support programs",
            "Improve healthcare access",
            "Create immigration policies",
            "Support youth development"
          ],
          reasoning: "Sustainable population policies ensure long-term economic and social stability."
        }]
      };
    }

    // Risk questions
    if (input.includes("risk") || input.includes("volatility") || input.includes("danger")) {
      const volatility = advancedAnalytics?.volatility?.gdp || 0;
      const content = `Based on my analysis, your economic volatility is ${(volatility * 100).toFixed(1)}%. ${
        volatility < 0.1 ? "This indicates stable economic conditions." :
        volatility < 0.2 ? "Moderate volatility - monitor closely." :
        "High volatility detected - immediate action recommended."
      } I can help you develop risk mitigation strategies.`;
      
      return {
        content,
        recommendations: [{
          id: "risk-response",
          type: "strategic",
          title: "Risk Mitigation Strategy",
          description: "Comprehensive approach to reduce economic volatility and manage risks.",
          impact: { economic: 7, governance: 6 },
          confidence: 0.85,
          timeframe: "immediate",
          actions: [
            "Diversify economic sectors",
            "Implement fiscal buffers",
            "Strengthen regulations",
            "Create emergency funds"
          ],
          reasoning: "Proactive risk management can prevent economic crises and maintain stability."
        }]
      };
    }

    // Default response
    return {
      content: "I understand your question about " + userInput + ". Let me analyze your country's data and provide specific recommendations. Could you please provide more details about what aspect you'd like me to focus on?"
    };
  };

  const handleQuickQuestion = (question: string) => {
    setInputMessage(question);
  };

  const getRecommendationColor = (type: string) => {
    return RECOMMENDATION_COLORS[type as keyof typeof RECOMMENDATION_COLORS] || "#6b7280";
  };

  // Convert impact object to display string and color
  const getImpactDisplay = (impact: { economic?: number; social?: number; diplomatic?: number; governance?: number; }) => {
    const maxValue = Math.max(
      impact.economic || 0,
      impact.social || 0,
      impact.diplomatic || 0,
      impact.governance || 0
    );

    if (maxValue >= 8) return { text: "High", color: "#ef4444" };
    if (maxValue >= 6) return { text: "Medium", color: "#f59e0b" };
    if (maxValue >= 4) return { text: "Low", color: "#10b981" };
    return { text: "Minimal", color: "#6b7280" };
  };

  const getImpactColor = (impact: { economic?: number; social?: number; diplomatic?: number; governance?: number; }) => {
    return getImpactDisplay(impact).color;
  };

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-500" />
              AI Economic Advisor - {countryName}
            </DialogTitle>
            <DialogDescription>
              Loading AI advisor and analyzing your nation's data...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-blue-500" />
            AI Economic Advisor - {countryName}
          </DialogTitle>
          <DialogDescription>
            AI-powered insights, recommendations, and strategic guidance for your nation
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="chat">Chat</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="space-y-4">
            {/* Chat Interface */}
            <GlassCard>
              <div className="h-96 flex flex-col">
                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div key={message.id} className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.type === 'ai' && (
                          <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                            <Bot className="h-4 w-4" />
                          </div>
                        )}
                        
                        <div className={`max-w-[80%] ${message.type === 'user' ? 'order-2' : 'order-1'}`}>
                          <div className={`rounded-lg p-3 ${
                            message.type === 'user' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-gray-100 dark:bg-gray-800'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                          </div>
                          
                          {/* Recommendations in AI messages */}
                          {message.recommendations && message.recommendations.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.recommendations.map((rec) => (
                                <div
                                  key={rec.id}
                                  className="p-2 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                                  onClick={() => setSelectedRecommendation(rec)}
                                >
                                  <div className="flex items-center gap-2">
                                    <div 
                                      className="w-2 h-2 rounded-full"
                                      style={{ backgroundColor: getRecommendationColor(rec.type) }}
                                    />
                                    <span className="text-xs font-medium">{rec.title}</span>
                                    <Badge
                                      variant="outline"
                                      className="ml-auto text-xs"
                                      style={{ borderColor: getImpactColor(rec.impact) }}
                                    >
                                      {getImpactDisplay(rec.impact).text}
                                    </Badge>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        
                        {message.type === 'user' && (
                          <div className="h-8 w-8 rounded-full bg-gray-500 text-white flex items-center justify-center">
                            <User className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {isTyping && (
                      <div className="flex gap-3 justify-start">
                        <div className="h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                {/* Quick Questions */}
                <div className="p-4 border-t">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {QUICK_QUESTIONS.slice(0, 4).map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickQuestion(question)}
                        className="text-xs"
                      >
                        {question}
                      </Button>
                    ))}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <Input
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Ask me about your nation's economy..."
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      className="flex-1"
                    />
                    <Button onClick={handleSendMessage} disabled={!inputMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-4">
            {/* AI Recommendations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {generateInitialRecommendations().map((recommendation) => (
                <GlassCard 
                  key={recommendation.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => setSelectedRecommendation(recommendation)}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getRecommendationColor(recommendation.type) }}
                      />
                      <Badge
                        variant="outline"
                        style={{ borderColor: getImpactColor(recommendation.impact) }}
                      >
                        {getImpactDisplay(recommendation.impact).text}
                      </Badge>
                    </div>
                    
                    <h4 className="font-semibold mb-1">{recommendation.title}</h4>
                    <p className="text-sm text-muted-foreground mb-3">{recommendation.description}</p>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confidence: {(recommendation.confidence * 100).toFixed(0)}%</span>
                      <span className="capitalize">{recommendation.timeframe.replace('_', ' ')}</span>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-4">
            {/* AI Insights */}
            <GlassCard>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  AI Insights
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Economic Performance</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Your GDP growth rate of {(countryData?.adjustedGdpGrowth || 0) * 100}% indicates 
                      {countryData?.adjustedGdpGrowth && countryData.adjustedGdpGrowth > 0.03 ? ' strong economic performance.' : 
                       countryData?.adjustedGdpGrowth && countryData.adjustedGdpGrowth > 0.01 ? ' moderate growth with room for improvement.' : 
                       ' economic challenges that require attention.'}
                    </p>
                  </div>

                  <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="font-medium">Demographic Trends</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Population growth rate of {(countryData?.populationGrowthRate || 0) * 100}% suggests 
                      {countryData?.populationGrowthRate && countryData.populationGrowthRate > 0.015 ? ' healthy demographic dynamics.' :
                       countryData?.populationGrowthRate && countryData.populationGrowthRate > 0.005 ? ' moderate population growth.' :
                       ' demographic challenges that may need policy intervention.'}
                    </p>
                  </div>

                  {advancedAnalytics?.volatility && (
                    <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/20">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Economic Stability</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Economic volatility analysis shows {advancedAnalytics.volatility.gdp && advancedAnalytics.volatility.gdp > 0.2 ? 
                        'high volatility requiring stabilization measures.' :
                        advancedAnalytics.volatility.gdp && advancedAnalytics.volatility.gdp > 0.1 ?
                        'moderate volatility with stable conditions.' :
                        'low volatility indicating economic stability.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </TabsContent>
        </Tabs>

        {/* Recommendation Detail Modal */}
        {selectedRecommendation && (
          <Dialog open={!!selectedRecommendation} onOpenChange={() => setSelectedRecommendation(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getRecommendationColor(selectedRecommendation.type) }}
                  />
                  {selectedRecommendation.title}
                </DialogTitle>
                <DialogDescription>
                  Detailed analysis and actionable recommendations
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedRecommendation.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Impact</h4>
                    <Badge
                      variant="outline"
                      style={{ borderColor: getImpactColor(selectedRecommendation.impact) }}
                    >
                      {getImpactDisplay(selectedRecommendation.impact).text}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Confidence</h4>
                    <p className="text-sm">{(selectedRecommendation.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Recommended Actions</h4>
                  <ul className="space-y-1">
                    {selectedRecommendation.actions.map((action, index) => (
                      <li key={index} className="text-sm flex items-center gap-2">
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        {action}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div>
                  <h4 className="font-medium mb-2">Reasoning</h4>
                  <p className="text-sm text-muted-foreground">{selectedRecommendation.reasoning}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
} 