/**
 * @fileoverview Dependency injection tokens for context-aggregator
 */

export const TYPES = {
  // Core services
  IContextAggregator: Symbol.for('IContextAggregator'),
  IProjectAnalyzer: Symbol.for('IProjectAnalyzer'),
  IContextOptimizer: Symbol.for('IContextOptimizer'),
  IRelevanceScorer: Symbol.for('IRelevanceScorer'),
  
  // Loading strategies
  ProgressiveLoadingStrategy: Symbol.for('ProgressiveLoadingStrategy'),
  FocusedLoadingStrategy: Symbol.for('FocusedLoadingStrategy'),
  BreadthFirstLoadingStrategy: Symbol.for('BreadthFirstLoadingStrategy'),
  
  // External dependencies
  ILogger: Symbol.for('ILogger'),
  IFileSystem: Symbol.for('IFileSystem'),
  ICache: Symbol.for('ICache'),
  
  // Configuration
  IContextAggregatorOptions: Symbol.for('IContextAggregatorOptions'),
  IProjectRoot: Symbol.for('IProjectRoot'),
  ICacheConfig: Symbol.for('ICacheConfig'),
} as const;

export type InjectionToken = typeof TYPES[keyof typeof TYPES];