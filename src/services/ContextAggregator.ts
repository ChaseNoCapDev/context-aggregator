import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { ICache } from '@chasenocap/cache';
import { Cacheable } from '@chasenocap/cache';
import { TYPES } from '../types/InjectionTokens.js';
import type { 
  IContextAggregator, 
  ILoadingStrategy, 
  Context
} from '../interfaces/IContextAggregator.js';
import type { LoadingOptions, LoadedContext } from '../types/ContextTypes.js';
import type { IProjectAnalyzer, ProjectInfo } from '../interfaces/IProjectAnalyzer.js';
import type { IContextOptimizer, OptimizationStrategy } from '../interfaces/IContextOptimizer.js';
import { ProgressiveLoadingStrategy } from '../strategies/ProgressiveLoadingStrategy.js';
import { FocusedLoadingStrategy } from '../strategies/FocusedLoadingStrategy.js';
import { BreadthFirstLoadingStrategy } from '../strategies/BreadthFirstLoadingStrategy.js';

/**
 * Main context aggregator implementation
 * Orchestrates context loading, optimization, and caching
 */
@injectable()
export class ContextAggregator implements IContextAggregator {
  private strategies: Map<string, ILoadingStrategy>;

  constructor(
    @inject(TYPES.ILogger) private logger: ILogger,
    @inject(TYPES.ICache) cache: ICache,
    @inject(TYPES.IProjectAnalyzer) private projectAnalyzer: IProjectAnalyzer,
    @inject(TYPES.IContextOptimizer) private contextOptimizer: IContextOptimizer,
    @inject(TYPES.ProgressiveLoadingStrategy) progressiveStrategy: ProgressiveLoadingStrategy,
    @inject(TYPES.FocusedLoadingStrategy) focusedStrategy: FocusedLoadingStrategy,
    @inject(TYPES.BreadthFirstLoadingStrategy) breadthFirstStrategy: BreadthFirstLoadingStrategy
  ) {
    this.strategies = new Map<string, ILoadingStrategy>();
    this.strategies.set('progressive', progressiveStrategy);
    this.strategies.set('focused', focusedStrategy);
    this.strategies.set('breadth-first', breadthFirstStrategy);
  }

  /**
   * Aggregate context from a project
   */
  @Cacheable({ ttl: 3600 }) // Cache for 1 hour
  async aggregateContext(rootPath: string, options: LoadingOptions = {}): Promise<Context> {
    const startTime = Date.now();
    this.logger.info('Aggregating context', { rootPath, strategy: options.strategy });

    try {
      // Select loading strategy
      const strategyName = options.strategy || 'progressive';
      const strategy = this.strategies.get(strategyName);
      
      if (!strategy) {
        throw new Error(`Unknown loading strategy: ${strategyName}`);
      }

      // Load context using selected strategy
      const loadedContext = await strategy.loadContext(rootPath, options);

      // Analyze project if not already done
      let projectInfo: ProjectInfo;
      if (loadedContext.metadata.has('projectInfo')) {
        projectInfo = loadedContext.metadata.get('projectInfo');
      } else {
        projectInfo = await this.projectAnalyzer.analyzeProject(rootPath);
      }

      // Build initial context
      const context: Context = {
        rootPath,
        files: loadedContext.files,
        metadata: loadedContext.metadata,
        projectInfo,
        summary: this.generateContextSummary(loadedContext, projectInfo),
        tokens: loadedContext.totalTokens
      };

      // Apply optimization if requested
      if (options.optimize) {
        context.optimized = await this.optimizeContext(
          context,
          options.optimizationStrategy || 'selective',
          options.maxTokens
        );
      }

      this.logger.info('Context aggregation complete', {
        filesLoaded: context.files.size,
        totalTokens: context.tokens,
        duration: Date.now() - startTime
      });

      return context;
    } catch (error) {
      this.logger.error('Failed to aggregate context', error as Error);
      throw error;
    }
  }

  /**
   * Load context with specific strategy
   */
  async loadContext(
    rootPath: string,
    strategy: 'progressive' | 'focused' | 'breadth-first',
    options: LoadingOptions = {}
  ): Promise<LoadedContext> {
    const loadingStrategy = this.strategies.get(strategy);
    
    if (!loadingStrategy) {
      throw new Error(`Unknown loading strategy: ${strategy}`);
    }

    return loadingStrategy.loadContext(rootPath, { ...options, strategy });
  }

  /**
   * Optimize existing context
   */
  async optimizeContext(
    context: Context,
    strategy: OptimizationStrategy,
    maxTokens?: number
  ): Promise<Context> {
    this.logger.info('Optimizing context', { strategy, currentTokens: context.tokens });

    // Combine all file contents
    const allContent = Array.from(context.files.entries())
      .map(([path, content]) => `// File: ${path}\n${content}`)
      .join('\n\n');

    // Optimize content
    const result = await this.contextOptimizer.optimizeContext(
      allContent,
      strategy,
      maxTokens
    );

    // Parse optimized content back into files
    const optimizedFiles = this.parseOptimizedContent(result.optimizedContent);

    // Create optimized context
    const optimizedContext: Context = {
      ...context,
      files: optimizedFiles,
      tokens: result.optimizedTokens,
      metadata: new Map([
        ...context.metadata,
        ['optimization', {
          strategy,
          originalTokens: result.originalTokens,
          optimizedTokens: result.optimizedTokens,
          reduction: result.reduction
        }]
      ])
    };

    return optimizedContext;
  }

  /**
   * Get available loading strategies
   */
  getStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Register a custom loading strategy
   */
  registerStrategy(name: string, strategy: ILoadingStrategy): void {
    this.logger.info('Registering custom loading strategy', { name });
    this.strategies.set(name, strategy);
  }

  /**
   * Generate context summary
   */
  private generateContextSummary(
    loadedContext: LoadedContext,
    projectInfo: ProjectInfo
  ): string {
    const parts: string[] = [];

    // Project type and framework
    parts.push(`Project: ${projectInfo.type} application`);
    if (projectInfo.framework) {
      parts.push(`Framework: ${projectInfo.framework.name}`);
    }

    // Languages
    if (projectInfo.languages.length > 0) {
      parts.push(`Languages: ${projectInfo.languages.join(', ')}`);
    }

    // Files loaded
    parts.push(`Files loaded: ${loadedContext.files.size}`);
    parts.push(`Total tokens: ${loadedContext.totalTokens}`);

    // Loading strategy
    parts.push(`Loading strategy: ${loadedContext.strategy}`);

    // Additional metadata
    if (loadedContext.metadata.has('focusSummary')) {
      const focus = loadedContext.metadata.get('focusSummary');
      if (focus.query) {
        parts.push(`Query focus: "${focus.query}"`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Parse optimized content back into file map
   */
  private parseOptimizedContent(content: string): Map<string, string> {
    const files = new Map<string, string>();
    const fileRegex = /\/\/ File: (.+?)\n([\s\S]*?)(?=\/\/ File: |$)/g;
    
    let match;
    while ((match = fileRegex.exec(content)) !== null) {
      const [, filePath, fileContent] = match;
      files.set(filePath.trim(), fileContent.trim());
    }

    // If no file markers found, treat as single file
    if (files.size === 0) {
      files.set('optimized-content', content);
    }

    return files;
  }
}