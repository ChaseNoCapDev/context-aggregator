/**
 * @fileoverview Context optimizer interface
 */

/**
 * Context optimizer interface
 */
export interface IContextOptimizer {
  /**
   * Optimize context content
   */
  optimizeContext(
    content: string,
    strategy: OptimizationStrategy,
    maxTokens?: number
  ): Promise<OptimizationResult>;
  
  /**
   * Chunk context into smaller pieces
   */
  chunkContext(
    content: string,
    maxChunkSize?: number
  ): Promise<ContextChunk[]>;
  
  /**
   * Estimate token count
   */
  estimateTokenCount(content: string): number;
  
  /**
   * Get detailed token information
   */
  getTokenInfo(content: string): Promise<TokenInfo>;
}

/**
 * Optimization strategies
 */
export type OptimizationStrategy = 'summarize' | 'selective' | 'compress';

/**
 * Optimization result
 */
export interface OptimizationResult {
  originalContent: string;
  optimizedContent: string;
  originalTokens: number;
  optimizedTokens: number;
  reduction: number;
  strategy: OptimizationStrategy;
}

/**
 * Token information
 */
export interface TokenInfo {
  totalTokens: number;
  breakdown: Record<string, number>;
  estimatedCost: number;
  withinLimit: boolean;
}

/**
 * Context chunk
 */
export interface ContextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata: {
    hasCode: boolean;
    hasDocumentation: boolean;
    language: string;
  };
}