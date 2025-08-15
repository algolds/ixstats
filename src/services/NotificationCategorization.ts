/**
 * Advanced Notification Categorization System
 * Intelligent categorization with urgency levels and contextual classification
 */

import type {
  UnifiedNotification,
  NotificationContext,
  NotificationCategory,
  NotificationPriority,
  NotificationSeverity,
  NotificationType,
} from '~/types/unified-notifications';

// Enhanced category definitions with sub-categories
export interface EnhancedCategory {
  primary: NotificationCategory;
  subcategory: string;
  urgencyLevel: 1 | 2 | 3 | 4 | 5; // 1=lowest, 5=highest
  defaultPriority: NotificationPriority;
  contextualFactors: string[];
  escalationTriggers: EscalationTrigger[];
  deliveryPreferences: {
    immediate: boolean;
    batchable: boolean;
    suppressible: boolean;
    requiresAction: boolean;
  };
}

// Escalation trigger for upgrading notification priority
export interface EscalationTrigger {
  condition: string;
  priorityUpgrade: NotificationPriority;
  deliveryUpgrade?: string;
  reasoning: string;
}

// Contextual classification result
export interface ClassificationResult {
  enhancedCategory: EnhancedCategory;
  confidence: number; // 0-1
  alternativeCategories: EnhancedCategory[];
  reasoning: string[];
  suggestedActions: string[];
  escalationRecommendation?: {
    trigger: EscalationTrigger;
    timeframe: number; // milliseconds
  };
}

// Pattern-based classification rules
interface ClassificationPattern {
  keywords: string[];
  context: string[];
  priority: number; // match priority, higher = more specific
  category: EnhancedCategory;
}

export class NotificationCategorization {
  private categories: Map<string, EnhancedCategory> = new Map();
  private patterns: ClassificationPattern[] = [];
  private contextualRules: Map<string, (context: NotificationContext) => number> = new Map();

  constructor() {
    this.initializeCategories();
    this.initializePatterns();
    this.initializeContextualRules();
  }

  /**
   * Intelligently categorize a notification with context awareness
   */
  async categorizeNotification(
    notification: UnifiedNotification,
    context: NotificationContext
  ): Promise<ClassificationResult> {
    // Extract content features
    const contentFeatures = this.extractContentFeatures(notification);
    
    // Apply pattern matching
    const patternMatches = this.applyPatternMatching(contentFeatures, context);
    
    // Apply contextual scoring
    const contextualScores = await this.applyContextualScoring(patternMatches, context);
    
    // Select best category
    const bestMatch = this.selectBestCategory(contextualScores);
    
    // Check for escalation conditions
    const escalationCheck = this.checkEscalationConditions(notification, bestMatch, context);
    
    // Generate alternative suggestions
    const alternatives = contextualScores
      .slice(1, 4)
      .map(match => match.category);
    
    // Generate reasoning
    const reasoning = this.generateCategoringReasoning(bestMatch, contentFeatures, context);
    
    // Suggest actions
    const suggestedActions = this.generateActionSuggestions(bestMatch, notification, context);

    return {
      enhancedCategory: bestMatch.category,
      confidence: bestMatch.score,
      alternativeCategories: alternatives,
      reasoning,
      suggestedActions,
      escalationRecommendation: escalationCheck,
    };
  }

  /**
   * Dynamic urgency level calculation based on multiple factors
   */
  calculateDynamicUrgency(
    notification: UnifiedNotification,
    context: NotificationContext,
    category: EnhancedCategory
  ): 1 | 2 | 3 | 4 | 5 {
    let urgency = category.urgencyLevel;
    
    // Time-based urgency modifiers
    const timeFactors = this.calculateTimeUrgency(notification, context);
    urgency = Math.min(5, urgency + timeFactors) as 1 | 2 | 3 | 4 | 5;
    
    // Context-based urgency modifiers
    const contextFactors = this.calculateContextUrgency(context, category);
    urgency = Math.min(5, urgency + contextFactors) as 1 | 2 | 3 | 4 | 5;
    
    // Content-based urgency modifiers
    const contentFactors = this.calculateContentUrgency(notification);
    urgency = Math.min(5, urgency + contentFactors) as 1 | 2 | 3 | 4 | 5;
    
    return urgency;
  }

  /**
   * Cross-category impact analysis
   */
  analyzeCrossCategoryImpact(
    notification: UnifiedNotification,
    context: NotificationContext
  ): {
    affectedCategories: NotificationCategory[];
    impactLevel: 'low' | 'medium' | 'high' | 'critical';
    cascadingEffects: string[];
    recommendedBroadcast: boolean;
  } {
    const affectedCategories: NotificationCategory[] = [];
    let impactLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const cascadingEffects: string[] = [];
    let recommendedBroadcast = false;

    // Economic notifications can affect diplomatic and governance
    if (notification.category === 'economic') {
      if (notification.title.toLowerCase().includes('crisis') || 
          notification.title.toLowerCase().includes('crash')) {
        affectedCategories.push('diplomatic', 'governance', 'social');
        impactLevel = 'critical';
        cascadingEffects.push('Potential diplomatic strain', 'Government stability concerns', 'Social unrest risk');
        recommendedBroadcast = true;
      }
    }

    // Crisis notifications affect all categories
    if (notification.category === 'crisis') {
      affectedCategories.push('economic', 'diplomatic', 'governance', 'social', 'security');
      impactLevel = 'critical';
      cascadingEffects.push('Multi-sector emergency response required');
      recommendedBroadcast = true;
    }

    // Security notifications can affect diplomatic relations
    if (notification.category === 'security') {
      if (notification.severity === 'urgent') {
        affectedCategories.push('diplomatic', 'governance');
        impactLevel = 'high';
        cascadingEffects.push('Diplomatic implications', 'Government response required');
      }
    }

    // Achievement notifications can boost other areas
    if (notification.category === 'achievement') {
      if (notification.priority === 'high') {
        affectedCategories.push('economic', 'diplomatic');
        impactLevel = 'medium';
        cascadingEffects.push('Positive reputation effects', 'Economic confidence boost');
      }
    }

    return {
      affectedCategories,
      impactLevel,
      cascadingEffects,
      recommendedBroadcast,
    };
  }

  // Private helper methods

  private initializeCategories() {
    // Economic category definitions
    this.categories.set('economic-growth', {
      primary: 'economic',
      subcategory: 'growth',
      urgencyLevel: 2,
      defaultPriority: 'medium',
      contextualFactors: ['market_hours', 'executive_mode', 'economic_dashboard'],
      escalationTriggers: [
        {
          condition: 'growth_rate_drop > 5%',
          priorityUpgrade: 'high',
          reasoning: 'Significant economic decline detected'
        }
      ],
      deliveryPreferences: {
        immediate: false,
        batchable: true,
        suppressible: true,
        requiresAction: false,
      }
    });

    this.categories.set('economic-crisis', {
      primary: 'economic',
      subcategory: 'crisis',
      urgencyLevel: 5,
      defaultPriority: 'critical',
      contextualFactors: ['any_time', 'any_mode'],
      escalationTriggers: [],
      deliveryPreferences: {
        immediate: true,
        batchable: false,
        suppressible: false,
        requiresAction: true,
      }
    });

    // Diplomatic categories
    this.categories.set('diplomatic-relations', {
      primary: 'diplomatic',
      subcategory: 'relations',
      urgencyLevel: 3,
      defaultPriority: 'medium',
      contextualFactors: ['executive_mode', 'diplomatic_dashboard'],
      escalationTriggers: [
        {
          condition: 'relations_drop > 20%',
          priorityUpgrade: 'high',
          reasoning: 'Significant diplomatic deterioration'
        }
      ],
      deliveryPreferences: {
        immediate: false,
        batchable: true,
        suppressible: false,
        requiresAction: false,
      }
    });

    this.categories.set('diplomatic-conflict', {
      primary: 'diplomatic',
      subcategory: 'conflict',
      urgencyLevel: 4,
      defaultPriority: 'high',
      contextualFactors: ['any_time', 'executive_mode'],
      escalationTriggers: [
        {
          condition: 'conflict_escalation',
          priorityUpgrade: 'critical',
          reasoning: 'Diplomatic conflict requires immediate attention'
        }
      ],
      deliveryPreferences: {
        immediate: true,
        batchable: false,
        suppressible: false,
        requiresAction: true,
      }
    });

    // Governance categories
    this.categories.set('governance-efficiency', {
      primary: 'governance',
      subcategory: 'efficiency',
      urgencyLevel: 2,
      defaultPriority: 'medium',
      contextualFactors: ['business_hours', 'governance_dashboard'],
      escalationTriggers: [
        {
          condition: 'efficiency_drop > 15%',
          priorityUpgrade: 'high',
          reasoning: 'Government efficiency decline'
        }
      ],
      deliveryPreferences: {
        immediate: false,
        batchable: true,
        suppressible: true,
        requiresAction: false,
      }
    });

    // Crisis categories
    this.categories.set('crisis-emergency', {
      primary: 'crisis',
      subcategory: 'emergency',
      urgencyLevel: 5,
      defaultPriority: 'critical',
      contextualFactors: ['any_time', 'any_mode'],
      escalationTriggers: [],
      deliveryPreferences: {
        immediate: true,
        batchable: false,
        suppressible: false,
        requiresAction: true,
      }
    });

    // Achievement categories
    this.categories.set('achievement-milestone', {
      primary: 'achievement',
      subcategory: 'milestone',
      urgencyLevel: 1,
      defaultPriority: 'low',
      contextualFactors: ['business_hours', 'achievement_context'],
      escalationTriggers: [
        {
          condition: 'major_milestone',
          priorityUpgrade: 'medium',
          reasoning: 'Significant achievement milestone reached'
        }
      ],
      deliveryPreferences: {
        immediate: false,
        batchable: true,
        suppressible: true,
        requiresAction: false,
      }
    });

    // System categories
    this.categories.set('system-error', {
      primary: 'system',
      subcategory: 'error',
      urgencyLevel: 4,
      defaultPriority: 'high',
      contextualFactors: ['admin_mode', 'technical_context'],
      escalationTriggers: [
        {
          condition: 'critical_system_failure',
          priorityUpgrade: 'critical',
          reasoning: 'System stability at risk'
        }
      ],
      deliveryPreferences: {
        immediate: true,
        batchable: false,
        suppressible: false,
        requiresAction: true,
      }
    });
  }

  private initializePatterns() {
    // Economic patterns
    this.patterns.push({
      keywords: ['gdp', 'growth', 'economy', 'market', 'trade', 'revenue'],
      context: ['economic_data', 'financial_metrics'],
      priority: 8,
      category: this.categories.get('economic-growth')!,
    });

    this.patterns.push({
      keywords: ['crisis', 'crash', 'recession', 'collapse', 'emergency', 'critical'],
      context: ['economic_data'],
      priority: 10,
      category: this.categories.get('economic-crisis')!,
    });

    // Diplomatic patterns
    this.patterns.push({
      keywords: ['diplomatic', 'relations', 'treaty', 'alliance', 'ambassador'],
      context: ['diplomatic_context'],
      priority: 7,
      category: this.categories.get('diplomatic-relations')!,
    });

    this.patterns.push({
      keywords: ['conflict', 'war', 'sanctions', 'dispute', 'tension'],
      context: ['diplomatic_context'],
      priority: 9,
      category: this.categories.get('diplomatic-conflict')!,
    });

    // Achievement patterns
    this.patterns.push({
      keywords: ['achievement', 'milestone', 'award', 'recognition', 'success'],
      context: ['achievement_context'],
      priority: 5,
      category: this.categories.get('achievement-milestone')!,
    });

    // System patterns
    this.patterns.push({
      keywords: ['error', 'failure', 'bug', 'crash', 'system', 'technical'],
      context: ['system_context'],
      priority: 8,
      category: this.categories.get('system-error')!,
    });
  }

  private initializeContextualRules() {
    // Executive mode boosts certain categories
    this.contextualRules.set('executive_mode', (context) => 
      context.isExecutiveMode ? 0.3 : 0
    );

    // Business hours relevance
    this.contextualRules.set('business_hours', (context) => {
      const hour = new Date().getHours();
      return (hour >= 9 && hour <= 17) ? 0.2 : -0.1;
    });

    // Page context relevance
    this.contextualRules.set('page_relevance', (context) => {
      if (context.currentRoute.includes('dashboard')) return 0.2;
      if (context.currentRoute.includes('mycountry')) return 0.15;
      if (context.currentRoute.includes('admin')) return 0.1;
      return 0;
    });
  }

  private extractContentFeatures(notification: UnifiedNotification): {
    keywords: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    urgencyIndicators: string[];
    actionWords: string[];
  } {
    const text = `${notification.title} ${notification.message}`.toLowerCase();
    const words = text.split(/\s+/);

    // Extract keywords
    const keywords = words.filter(word => word.length > 3);

    // Simple sentiment analysis
    const positiveWords = ['success', 'achievement', 'growth', 'improvement', 'positive'];
    const negativeWords = ['crisis', 'failure', 'decline', 'error', 'problem', 'critical'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    const sentiment = positiveCount > negativeCount ? 'positive' :
                     negativeCount > positiveCount ? 'negative' : 'neutral';

    // Urgency indicators
    const urgencyWords = ['urgent', 'immediate', 'critical', 'emergency', 'asap'];
    const urgencyIndicators = urgencyWords.filter(word => text.includes(word));

    // Action words
    const actionWords = ['requires', 'needs', 'must', 'should', 'action', 'respond'];
    const foundActionWords = actionWords.filter(word => text.includes(word));

    return {
      keywords,
      sentiment,
      urgencyIndicators,
      actionWords: foundActionWords,
    };
  }

  private applyPatternMatching(
    features: any,
    context: NotificationContext
  ): Array<{ category: EnhancedCategory; score: number; matches: string[] }> {
    const matches: Array<{ category: EnhancedCategory; score: number; matches: string[] }> = [];

    for (const pattern of this.patterns) {
      let score = 0;
      const matchedKeywords: string[] = [];

      // Keyword matching
      for (const keyword of pattern.keywords) {
        if (features.keywords.includes(keyword)) {
          score += pattern.priority;
          matchedKeywords.push(keyword);
        }
      }

      // Context matching
      for (const contextKey of pattern.context) {
        const contextScore = this.contextualRules.get(contextKey)?.(context) || 0;
        score += contextScore * 10;
      }

      if (score > 0) {
        matches.push({
          category: pattern.category,
          score: score / 100, // Normalize to 0-1
          matches: matchedKeywords,
        });
      }
    }

    return matches.sort((a, b) => b.score - a.score);
  }

  private async applyContextualScoring(
    matches: Array<{ category: EnhancedCategory; score: number; matches: string[] }>,
    context: NotificationContext
  ): Promise<Array<{ category: EnhancedCategory; score: number; matches: string[] }>> {
    return matches.map(match => {
      let contextualBoost = 0;

      // Apply contextual rules
      for (const factor of match.category.contextualFactors) {
        const rule = this.contextualRules.get(factor);
        if (rule) {
          contextualBoost += rule(context);
        }
      }

      return {
        ...match,
        score: Math.min(1, match.score + contextualBoost),
      };
    });
  }

  private selectBestCategory(
    matches: Array<{ category: EnhancedCategory; score: number; matches: string[] }>
  ): { category: EnhancedCategory; score: number; matches: string[] } {
    return matches[0] || {
      category: this.categories.get('system-error')!, // Default fallback
      score: 0.1,
      matches: [],
    };
  }

  private checkEscalationConditions(
    notification: UnifiedNotification,
    match: { category: EnhancedCategory; score: number; matches: string[] },
    context: NotificationContext
  ): { trigger: EscalationTrigger; timeframe: number } | undefined {
    for (const trigger of match.category.escalationTriggers) {
      if (this.evaluateEscalationCondition(trigger.condition, notification, context)) {
        return {
          trigger,
          timeframe: 5 * 60 * 1000, // 5 minutes default
        };
      }
    }
    return undefined;
  }

  private evaluateEscalationCondition(
    condition: string,
    notification: UnifiedNotification,
    context: NotificationContext
  ): boolean {
    // Simple condition evaluation - would be more sophisticated in practice
    if (condition.includes('growth_rate_drop') && notification.title.includes('decline')) {
      return true;
    }
    if (condition.includes('relations_drop') && notification.message.includes('deteriorat')) {
      return true;
    }
    if (condition === 'major_milestone' && notification.priority === 'high') {
      return true;
    }
    return false;
  }

  private calculateTimeUrgency(
    notification: UnifiedNotification,
    context: NotificationContext
  ): number {
    const age = Date.now() - notification.timestamp;
    const ageMinutes = age / (1000 * 60);

    // Recent notifications get urgency boost
    if (ageMinutes < 5) return 1;
    if (ageMinutes < 15) return 0;
    if (ageMinutes > 60) return -1; // Old notifications lose urgency

    return 0;
  }

  private calculateContextUrgency(
    context: NotificationContext,
    category: EnhancedCategory
  ): number {
    let urgency = 0;

    if (context.isExecutiveMode && category.contextualFactors.includes('executive_mode')) {
      urgency += 1;
    }

    if (context.focusMode && category.deliveryPreferences.requiresAction) {
      urgency += 1;
    }

    return urgency;
  }

  private calculateContentUrgency(notification: UnifiedNotification): number {
    const urgentKeywords = ['critical', 'urgent', 'emergency', 'immediate'];
    const text = `${notification.title} ${notification.message}`.toLowerCase();
    
    return urgentKeywords.filter(keyword => text.includes(keyword)).length;
  }

  private generateCategoringReasoning(
    match: { category: EnhancedCategory; score: number; matches: string[] },
    features: any,
    context: NotificationContext
  ): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Categorized as ${match.category.primary}/${match.category.subcategory} with ${(match.score * 100).toFixed(0)}% confidence`);

    if (match.matches.length > 0) {
      reasoning.push(`Keyword matches: ${match.matches.join(', ')}`);
    }

    if (features.urgencyIndicators.length > 0) {
      reasoning.push(`Urgency indicators detected: ${features.urgencyIndicators.join(', ')}`);
    }

    if (context.isExecutiveMode) {
      reasoning.push('Executive mode context considered');
    }

    return reasoning;
  }

  private generateActionSuggestions(
    match: { category: EnhancedCategory; score: number; matches: string[] },
    notification: UnifiedNotification,
    context: NotificationContext
  ): string[] {
    const suggestions: string[] = [];

    if (match.category.deliveryPreferences.requiresAction) {
      suggestions.push('Immediate action required');
    }

    if (match.category.deliveryPreferences.immediate) {
      suggestions.push('Deliver immediately');
    } else if (match.category.deliveryPreferences.batchable) {
      suggestions.push('Can be batched with similar notifications');
    }

    if (!match.category.deliveryPreferences.suppressible) {
      suggestions.push('Do not suppress this notification');
    }

    return suggestions;
  }
}

// Create singleton instance for export
const categorizationInstance = new NotificationCategorization();

// Export convenience functions
export const categorizeNotification = (
  notification: UnifiedNotification
): Promise<ClassificationResult> => {
  // Create basic context if not provided
  const defaultContext: NotificationContext = {
    userId: '',
    isExecutiveMode: false,
    currentRoute: '',
    ixTime: Date.now(),
    deviceInfo: { type: 'desktop', platform: 'unknown', screenSize: 'large' },
    networkStatus: { online: true, connectionType: 'unknown' },
    batteryStatus: { level: 100, charging: true },
    userActivity: { isActive: true, lastActivity: Date.now(), interactionHistory: [] },
    locationInfo: { timezone: 'UTC', locale: 'en-US' },
    preferences: { quietHours: null, categories: {} },
    socialContext: { connections: [], recentActivity: [] },
    economicProfile: { tier: 'unknown', interests: [] },
    performanceMetrics: { cpuUsage: 0, memoryUsage: 0, renderTime: 0 },
    environmentalFactors: { lightLevel: 'normal', noiseLevel: 'low', weatherConditions: 'unknown' }
  };
  return categorizationInstance.categorizeNotification(notification, defaultContext);
};

export const calculateDynamicUrgency = (
  notification: UnifiedNotification,
  context: NotificationContext
): number => {
  // Add default category - will be determined during actual categorization
  const defaultCategory: EnhancedCategory = {
    primary: 'system',
    secondary: null,
    confidence: 0.5,
    reasoning: 'Default category assignment',
    contextualFactors: []
  };
  return categorizationInstance.calculateDynamicUrgency(notification, context, defaultCategory);
};

export default NotificationCategorization;