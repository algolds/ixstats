/**
 * Action Queue Management System
 *
 * Handles the processing, queuing, and execution of intelligence-driven actions
 * with timeline management, dependency resolution, and progress tracking.
 */

import type { ActionableRecommendation } from '~/app/mycountry/types/intelligence';

// ============================================================================
// TYPES
// ============================================================================

export type ActionStatus =
  | 'pending'      // Awaiting user confirmation
  | 'queued'       // Confirmed, waiting to start
  | 'in_progress'  // Currently being executed
  | 'paused'       // Temporarily suspended
  | 'completed'    // Successfully finished
  | 'failed'       // Execution failed
  | 'cancelled';   // User cancelled

export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

export interface ActionQueueItem {
  id: string;
  recommendation: ActionableRecommendation;
  status: ActionStatus;
  priority: ActionPriority;

  // Timeline
  queuedAt: number;
  startedAt?: number;
  estimatedCompletionAt?: number;
  completedAt?: number;

  // Progress tracking
  progress: number; // 0-100
  currentPhase: string;
  totalPhases: number;
  completedPhases: number;

  // Dependencies
  dependsOn: string[]; // IDs of other actions
  blockedBy: string[]; // IDs of actions blocking this one

  // Results
  actualImpact?: {
    economic?: number;
    social?: number;
    diplomatic?: number;
    governance?: number;
  };
  outcome?: 'success' | 'partial' | 'failure';
  notes?: string;

  // Notifications
  notificationsSent: {
    started: boolean;
    milestone: boolean;
    completed: boolean;
    failed: boolean;
  };
}

export interface ActionPhase {
  id: string;
  name: string;
  description: string;
  duration: number; // milliseconds
  requirements: string[];
  outcomes: string[];
}

export interface ActionExecutionPlan {
  actionId: string;
  phases: ActionPhase[];
  totalDuration: number;
  resourceRequirements: {
    economic: number;
    political: number;
    time: number;
  };
  risks: Array<{
    type: 'economic' | 'political' | 'social' | 'timeline';
    severity: 'low' | 'medium' | 'high';
    description: string;
    mitigation: string;
  }>;
  successCriteria: string[];
}

// ============================================================================
// ACTION QUEUE MANAGER
// ============================================================================

class ActionQueueManager {
  private queue: Map<string, ActionQueueItem> = new Map();
  private listeners: Set<(queue: ActionQueueItem[]) => void> = new Set();

  /**
   * Add a recommendation to the action queue
   */
  addToQueue(
    recommendation: ActionableRecommendation,
    priority: ActionPriority = 'medium'
  ): ActionQueueItem {
    const id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Calculate estimated timeline based on difficulty
    const baseDuration = this.parseDuration(recommendation.estimatedDuration);
    const estimatedCompletionAt = Date.now() + baseDuration;

    const item: ActionQueueItem = {
      id,
      recommendation,
      status: 'pending',
      priority,
      queuedAt: Date.now(),
      estimatedCompletionAt,
      progress: 0,
      currentPhase: 'Awaiting confirmation',
      totalPhases: this.calculatePhases(recommendation),
      completedPhases: 0,
      dependsOn: [],
      blockedBy: [],
      notificationsSent: {
        started: false,
        milestone: false,
        completed: false,
        failed: false
      }
    };

    this.queue.set(id, item);
    this.notifyListeners();

    return item;
  }

  /**
   * Confirm an action and move it to queued status
   */
  confirmAction(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    item.status = 'queued';
    this.notifyListeners();

    // Check if action can start immediately
    this.processQueue();
  }

  /**
   * Start executing an action
   */
  startAction(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    // Check dependencies
    if (item.blockedBy.length > 0) {
      throw new Error(`Action blocked by: ${item.blockedBy.join(', ')}`);
    }

    item.status = 'in_progress';
    item.startedAt = Date.now();
    item.currentPhase = 'Initialization';
    item.progress = 5;

    this.notifyListeners();

    // Simulate progressive execution
    this.simulateExecution(actionId);
  }

  /**
   * Pause an in-progress action
   */
  pauseAction(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    if (item.status !== 'in_progress') {
      throw new Error(`Cannot pause action in ${item.status} status`);
    }

    item.status = 'paused';
    this.notifyListeners();
  }

  /**
   * Resume a paused action
   */
  resumeAction(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    if (item.status !== 'paused') {
      throw new Error(`Cannot resume action in ${item.status} status`);
    }

    item.status = 'in_progress';
    this.notifyListeners();

    // Continue execution
    this.simulateExecution(actionId);
  }

  /**
   * Cancel an action
   */
  cancelAction(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    item.status = 'cancelled';
    item.completedAt = Date.now();
    this.notifyListeners();
  }

  /**
   * Complete an action successfully
   */
  completeAction(actionId: string, actualImpact?: ActionQueueItem['actualImpact']): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    item.status = 'completed';
    item.completedAt = Date.now();
    item.progress = 100;
    item.currentPhase = 'Completed';
    item.outcome = 'success';

    if (actualImpact) {
      item.actualImpact = actualImpact;
    }

    if (!item.notificationsSent.completed) {
      this.sendNotification(actionId, 'completed');
      item.notificationsSent.completed = true;
    }

    this.notifyListeners();

    // Process next items in queue
    this.processQueue();
  }

  /**
   * Mark an action as failed
   */
  failAction(actionId: string, reason: string): void {
    const item = this.queue.get(actionId);
    if (!item) throw new Error(`Action ${actionId} not found`);

    item.status = 'failed';
    item.completedAt = Date.now();
    item.outcome = 'failure';
    item.notes = reason;

    if (!item.notificationsSent.failed) {
      this.sendNotification(actionId, 'failed', reason);
      item.notificationsSent.failed = true;
    }

    this.notifyListeners();
  }

  /**
   * Get all items in the queue
   */
  getQueue(): ActionQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get a specific action by ID
   */
  getAction(actionId: string): ActionQueueItem | undefined {
    return this.queue.get(actionId);
  }

  /**
   * Get actions by status
   */
  getActionsByStatus(status: ActionStatus): ActionQueueItem[] {
    return this.getQueue().filter(item => item.status === status);
  }

  /**
   * Get active actions (queued or in progress)
   */
  getActiveActions(): ActionQueueItem[] {
    return this.getQueue().filter(
      item => item.status === 'queued' || item.status === 'in_progress'
    );
  }

  /**
   * Subscribe to queue updates
   */
  subscribe(listener: (queue: ActionQueueItem[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Generate execution plan for an action
   */
  generateExecutionPlan(recommendation: ActionableRecommendation): ActionExecutionPlan {
    const phases = this.generatePhases(recommendation);
    const totalDuration = phases.reduce((sum, phase) => sum + phase.duration, 0);

    return {
      actionId: recommendation.id,
      phases,
      totalDuration,
      resourceRequirements: {
        economic: this.estimateEconomicCost(recommendation),
        political: this.estimatePoliticalCost(recommendation),
        time: totalDuration
      },
      risks: this.assessRisks(recommendation),
      successCriteria: this.defineSuccessCriteria(recommendation)
    };
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private notifyListeners(): void {
    const queue = this.getQueue();
    this.listeners.forEach(listener => listener(queue));
  }

  private processQueue(): void {
    // Find queued actions that can start
    const queuedActions = this.getActionsByStatus('queued')
      .filter(item => item.blockedBy.length === 0)
      .sort((a, b) => {
        // Sort by priority, then by queued time
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.queuedAt - b.queuedAt;
      });

    // Start the highest priority action
    if (queuedActions.length > 0) {
      const nextAction = queuedActions[0]!;
      this.startAction(nextAction.id);
    }
  }

  private simulateExecution(actionId: string): void {
    const item = this.queue.get(actionId);
    if (!item || item.status !== 'in_progress') return;

    // Simulate phased progression
    const interval = setInterval(() => {
      const current = this.queue.get(actionId);
      if (!current || current.status !== 'in_progress') {
        clearInterval(interval);
        return;
      }

      // Increment progress
      current.progress = Math.min(100, current.progress + 5);

      // Update phase
      const phaseProgress = Math.floor((current.progress / 100) * current.totalPhases);
      current.completedPhases = phaseProgress;
      current.currentPhase = this.getPhaseNameForProgress(current.progress, current.recommendation);

      // Send milestone notifications
      if (current.progress === 50 && !current.notificationsSent.milestone) {
        this.sendNotification(actionId, 'milestone');
        current.notificationsSent.milestone = true;
      }

      // Complete when reaching 100%
      if (current.progress >= 100) {
        clearInterval(interval);
        this.completeAction(actionId, {
          economic: current.recommendation.impact.economic,
          social: current.recommendation.impact.social,
          diplomatic: current.recommendation.impact.diplomatic,
          governance: current.recommendation.impact.governance
        });
      }

      this.notifyListeners();
    }, 2000); // Update every 2 seconds
  }

  private sendNotification(actionId: string, type: 'started' | 'milestone' | 'completed' | 'failed', details?: string): void {
    const item = this.queue.get(actionId);
    if (!item) return;

    // In production, this would integrate with the notification system
    console.log(`[Action Notification] ${type.toUpperCase()}: ${item.recommendation.title}`, details);

    // TODO: Integrate with notification center
    // notificationCenter.send({
    //   type: 'action_update',
    //   severity: type === 'failed' ? 'high' : 'medium',
    //   title: `Action ${type}`,
    //   message: `${item.recommendation.title} ${type}`,
    //   actionId
    // });
  }

  private parseDuration(duration: string): number {
    // Parse duration string (e.g., "1-2 weeks", "3 months") into milliseconds
    const weeks = duration.match(/(\d+).*week/i);
    if (weeks) return parseInt(weeks[1]!) * 7 * 24 * 60 * 60 * 1000;

    const months = duration.match(/(\d+).*month/i);
    if (months) return parseInt(months[1]!) * 30 * 24 * 60 * 60 * 1000;

    return 7 * 24 * 60 * 60 * 1000; // Default to 1 week
  }

  private calculatePhases(recommendation: ActionableRecommendation): number {
    // Determine number of phases based on difficulty
    switch (recommendation.difficulty) {
      case 'easy': return 3;
      case 'moderate': return 5;
      case 'complex': return 7;
      case 'major': return 10;
      default: return 5;
    }
  }

  private generatePhases(recommendation: ActionableRecommendation): ActionPhase[] {
    const baseDuration = this.parseDuration(recommendation.estimatedDuration);
    const phaseCount = this.calculatePhases(recommendation);
    const phaseDuration = baseDuration / phaseCount;

    const phaseNames = [
      'Planning & Analysis',
      'Resource Allocation',
      'Stakeholder Engagement',
      'Implementation',
      'Monitoring',
      'Adjustment',
      'Evaluation',
      'Consolidation',
      'Documentation',
      'Review & Reporting'
    ];

    return phaseNames.slice(0, phaseCount).map((name, i) => ({
      id: `phase-${i + 1}`,
      name,
      description: `Phase ${i + 1} of ${phaseCount}: ${name}`,
      duration: phaseDuration,
      requirements: recommendation.prerequisites.slice(0, 2),
      outcomes: [`Complete ${name.toLowerCase()} activities`]
    }));
  }

  private getPhaseNameForProgress(progress: number, recommendation: ActionableRecommendation): string {
    const phases = this.generatePhases(recommendation);
    const phaseIndex = Math.floor((progress / 100) * phases.length);
    return phases[phaseIndex]?.name || 'Finalizing';
  }

  private estimateEconomicCost(recommendation: ActionableRecommendation): number {
    // Estimate based on difficulty and category
    const baseCosts = {
      easy: 1000,
      moderate: 5000,
      complex: 20000,
      major: 100000
    };
    return baseCosts[recommendation.difficulty] || 5000;
  }

  private estimatePoliticalCost(recommendation: ActionableRecommendation): number {
    // Political cost scale: 1-10
    const politicalCosts = {
      easy: 1,
      moderate: 3,
      complex: 6,
      major: 9
    };
    return politicalCosts[recommendation.difficulty] || 3;
  }

  private assessRisks(recommendation: ActionableRecommendation): ActionExecutionPlan['risks'] {
    const risks: ActionExecutionPlan['risks'] = [];

    // Add risks based on category and difficulty
    if (recommendation.category === 'economic') {
      risks.push({
        type: 'economic',
        severity: recommendation.difficulty === 'major' ? 'high' : 'medium',
        description: 'Market volatility may affect implementation costs',
        mitigation: 'Maintain contingency budget of 20%'
      });
    }

    if (recommendation.difficulty === 'major' || recommendation.difficulty === 'complex') {
      risks.push({
        type: 'timeline',
        severity: 'medium',
        description: 'Implementation may take longer than estimated',
        mitigation: 'Build buffer time into schedule'
      });
    }

    return risks;
  }

  private defineSuccessCriteria(recommendation: ActionableRecommendation): string[] {
    return [
      `Achieve ${recommendation.successProbability}% of expected impact`,
      `Complete within ${recommendation.estimatedDuration}`,
      'Maintain stakeholder approval above 70%',
      'Stay within allocated budget',
      'No critical implementation issues'
    ];
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const actionQueueManager = new ActionQueueManager();
