/**
 * @fileoverview Public API for context-aggregator package
 */

// Re-export all interfaces
export type {
  IContextAggregator,
  ILoadingStrategy,
  Context
} from './interfaces/IContextAggregator.js';

export type {
  IProjectAnalyzer,
  ProjectType,
  ProjectInfo as IProjectInfo,
  FrameworkInfo
} from './interfaces/IProjectAnalyzer.js';

export type {
  IContextOptimizer,
  OptimizationStrategy,
  OptimizationResult,
  TokenInfo,
  ContextChunk
} from './interfaces/IContextOptimizer.js';

export type {
  IRelevanceScorer,
  FileRelevance,
  ScoringCriteria,
  RelevanceFactors
} from './interfaces/IRelevanceScorer.js';

// Re-export all types
export type {
  LoadedContext,
  LoadingOptions,
  IContextAggregatorOptions
} from './types/ContextTypes.js';

// Re-export injection tokens
export { TYPES } from './types/InjectionTokens.js';

// Re-export factory functions
export { createContextAggregator, createContextContainer } from './utils/ContextContainer.js';