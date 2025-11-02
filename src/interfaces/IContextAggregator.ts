/**
 * @fileoverview Main context aggregator interface
 */

import type { LoadingOptions, LoadedContext } from '../types/ContextTypes.js';
import type { ProjectInfo } from './IProjectAnalyzer.js';
import type { OptimizationStrategy } from './IContextOptimizer.js';

/**
 * Main interface for context aggregation
 */
export interface IContextAggregator {
  /**
   * Aggregate context from a project
   */
  aggregateContext(rootPath: string, options?: LoadingOptions): Promise<Context>;
  
  /**
   * Load context with specific strategy
   */
  loadContext(
    rootPath: string,
    strategy: 'progressive' | 'focused' | 'breadth-first',
    options?: LoadingOptions
  ): Promise<LoadedContext>;
  
  /**
   * Optimize existing context
   */
  optimizeContext(
    context: Context,
    strategy: OptimizationStrategy,
    maxTokens?: number
  ): Promise<Context>;
  
  /**
   * Get available loading strategies
   */
  getStrategies(): string[];
  
  /**
   * Register a custom loading strategy
   */
  registerStrategy(name: string, strategy: ILoadingStrategy): void;
}

/**
 * Loading strategy interface
 */
export interface ILoadingStrategy {
  readonly name: string;
  loadContext(rootPath: string, options: LoadingOptions): Promise<LoadedContext>;
}

/**
 * Complete context with metadata
 */
export interface Context {
  rootPath: string;
  files: Map<string, string>;
  metadata: Map<string, any>;
  projectInfo: ProjectInfo;
  summary: string;
  tokens: number;
  optimized?: Context;
}