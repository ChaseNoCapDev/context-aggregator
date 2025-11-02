import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import { TYPES } from '../types/InjectionTokens.js';
import type { ILoadingStrategy } from '../interfaces/IContextAggregator.js';
import type { LoadedContext, LoadingOptions } from '../types/ContextTypes.js';
import type { IRelevanceScorer } from '../interfaces/IRelevanceScorer.js';
import path from 'path';

/**
 * Focused loading strategy
 * Loads only files directly relevant to the query or focus area
 */
@injectable()
export class FocusedLoadingStrategy implements ILoadingStrategy {
  readonly name = 'focused';

  constructor(
    @inject(TYPES.IFileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.ILogger) private logger: ILogger,
    @inject(TYPES.IRelevanceScorer) private relevanceScorer: IRelevanceScorer
  ) {}

  /**
   * Load context focused on specific query or patterns
   */
  async loadContext(rootPath: string, options: LoadingOptions): Promise<LoadedContext> {
    this.logger.info('Loading context with focused strategy', { 
      rootPath, 
      query: options.query,
      patterns: options.includePatterns
    });

    if (!options.query && !options.includePatterns?.length) {
      throw new Error('Focused strategy requires either a query or include patterns');
    }

    const startTime = Date.now();
    const files = new Map<string, string>();
    const metadata = new Map<string, any>();
    let totalTokens = 0;
    const maxTokens = options.maxTokens || 8000;

    try {
      // Find all candidate files
      const allFiles = await this.findAllFiles(rootPath, options);
      
      // Score and filter files based on focus criteria
      const scoredFiles = await this.scoreFilesByFocus(
        allFiles,
        rootPath,
        options
      );

      // Load files in order of relevance until token limit
      for (const { path: filePath, score, reason } of scoredFiles) {
        if (totalTokens >= maxTokens) break;

        try {
          const fullPath = path.join(rootPath, filePath);
          const content = await this.fileSystem.readFile(fullPath);
          const tokens = this.estimateTokens(content);

          if (totalTokens + tokens <= maxTokens) {
            files.set(filePath, content);
            totalTokens += tokens;
            
            // Store relevance metadata
            if (!metadata.has('relevance')) {
              metadata.set('relevance', new Map());
            }
            metadata.get('relevance').set(filePath, { score, reason });
          }
        } catch (error) {
          this.logger.warn('Failed to load file', { filePath, error });
        }
      }

      // Add focus summary to metadata
      metadata.set('focusSummary', {
        query: options.query,
        patterns: options.includePatterns,
        filesFound: scoredFiles.length,
        filesLoaded: files.size,
        averageScore: scoredFiles.slice(0, files.size)
          .reduce((sum, f) => sum + f.score, 0) / files.size
      });

      this.logger.info('Focused loading complete', {
        filesLoaded: files.size,
        totalTokens,
        duration: Date.now() - startTime
      });

      return {
        files,
        metadata,
        totalTokens,
        strategy: this.name
      };
    } catch (error) {
      this.logger.error('Failed to load context with focused strategy', error as Error);
      throw error;
    }
  }

  /**
   * Find all files matching basic criteria
   */
  private async findAllFiles(
    rootPath: string,
    options: LoadingOptions
  ): Promise<string[]> {
    const files: string[] = [];
    const visited = new Set<string>();

    const walk = async (dir: string, depth = 0): Promise<void> => {
      if (depth > (options.maxDepth || 10) || visited.has(dir)) return;
      visited.add(dir);

      try {
        const entries = await this.fileSystem.listDirectory(dir);

        for (const entry of entries) {
          const fullPath = path.join(dir, entry);

          // Apply exclude patterns
          if (this.shouldExclude(entry, fullPath, options)) continue;

          const stats = await this.fileSystem.getStats(fullPath);

          if (stats.isDirectory) {
            await walk(fullPath, depth + 1);
          } else {
            // Check file type filters
            if (this.matchesFileType(entry, options)) {
              const relativePath = path.relative(rootPath, fullPath);
              files.push(relativePath);
            }
          }
        }
      } catch (error) {
        // Ignore permission errors
      }
    };

    await walk(rootPath);
    return files;
  }

  /**
   * Score files based on focus criteria
   */
  private async scoreFilesByFocus(
    files: string[],
    rootPath: string,
    options: LoadingOptions
  ): Promise<Array<{ path: string; score: number; reason: string }>> {
    const scoringCriteria = {
      query: options.query,
      contextPath: rootPath,
      fileTypes: options.fileTypes,
      includePatterns: options.includePatterns,
      excludePatterns: options.excludePatterns,
      threshold: 30, // Lower threshold for focused loading
      weights: {
        queryScore: 3.0,     // High weight for query matches
        nameScore: 2.5,      // High weight for filename matches
        pathScore: 2.0,      // Good weight for path matches
        typeScore: 1.0,      // Normal weight for file type
        depthScore: 0.5,     // Low weight for depth
        sizeScore: 0.3,      // Low weight for size
        recencyScore: 0.2    // Very low weight for recency
      }
    };

    const scoredFiles = await this.relevanceScorer.scoreFiles(files, scoringCriteria);

    // Additional scoring for focused patterns
    if (options.includePatterns) {
      for (const file of scoredFiles) {
        for (const pattern of options.includePatterns) {
          if (this.matchesPattern(file.path, pattern)) {
            file.score *= 1.5; // Boost score for pattern matches
            file.reason = `${file.reason}, matches pattern: ${pattern}`;
          }
        }
      }
    }

    // Sort by score and apply additional filtering
    return scoredFiles
      .sort((a, b) => b.score - a.score)
      .filter(f => f.score >= 30); // Only keep reasonably relevant files
  }

  /**
   * Check if file should be excluded
   */
  private shouldExclude(
    filename: string,
    fullPath: string,
    options: LoadingOptions
  ): boolean {
    // Default excludes
    const defaultExcludes = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', '.cache',
      '.next', '.nuxt', '.turbo', 'venv',
      '__pycache__', '.pytest_cache', '.mypy_cache'
    ];

    if (defaultExcludes.includes(filename)) return true;

    // Custom exclude patterns
    if (options.excludePatterns) {
      for (const pattern of options.excludePatterns) {
        if (this.matchesPattern(fullPath, pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if file matches type filters
   */
  private matchesFileType(filename: string, options: LoadingOptions): boolean {
    if (!options.fileTypes || options.fileTypes.length === 0) {
      // If no types specified, include common source files
      const defaultTypes = [
        '.ts', '.tsx', '.js', '.jsx',
        '.py', '.go', '.rs', '.java',
        '.json', '.yaml', '.yml',
        '.md', '.txt'
      ];
      return defaultTypes.some(ext => filename.endsWith(ext));
    }

    return options.fileTypes.some(type => {
      if (type.startsWith('.')) {
        return filename.endsWith(type);
      }
      return filename.includes(type);
    });
  }

  /**
   * Check if path matches pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\\/g, '/')
      .replace(/\*\*/g, '{{GLOBSTAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/{{GLOBSTAR}}/g, '.*')
      .replace(/\[(!)?([^\]]+)\]/g, (match, negate, chars) => {
        return negate ? `[^${chars}]` : `[${chars}]`;
      });

    const regex = new RegExp(regexPattern, 'i');
    const normalizedPath = filePath.replace(/\\/g, '/');
    return regex.test(normalizedPath);
  }

  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
}