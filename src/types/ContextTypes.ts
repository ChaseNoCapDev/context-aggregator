/**
 * @fileoverview Shared types for context-aggregator
 */

import type { ILogger } from '@chasenocap/logger';

/**
 * Context aggregator options
 */
export interface IContextAggregatorOptions {
  projectRoot: string;
  logger?: ILogger;
  cache?: {
    type?: 'memory' | 'redis';
    ttl?: number;
    prefix?: string;
  };
}

/**
 * Loading options
 */
export interface LoadingOptions {
  strategy?: 'progressive' | 'focused' | 'breadth-first';
  maxTokens?: number;
  maxDepth?: number;
  fileTypes?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  query?: string;
  optimize?: boolean;
  optimizationStrategy?: 'summarize' | 'selective' | 'compress';
}

/**
 * Loaded context result
 */
export interface LoadedContext {
  files: Map<string, string>;
  metadata: Map<string, any>;
  totalTokens: number;
  strategy: string;
}