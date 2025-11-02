import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import { TYPES } from '../types/InjectionTokens.js';
import type { ILoadingStrategy } from '../interfaces/IContextAggregator.js';
import type { LoadedContext, LoadingOptions } from '../types/ContextTypes.js';

/**
 * Breadth-first loading strategy
 * Loads files level by level from the root, giving a broad overview
 */
@injectable()
export class BreadthFirstLoadingStrategy implements ILoadingStrategy {
  readonly name = 'breadth-first';

  constructor(
    @inject(TYPES.IFileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.ILogger) private logger: ILogger
  ) {}

  /**
   * Load context breadth-first from root
   */
  async loadContext(rootPath: string, options: LoadingOptions): Promise<LoadedContext> {
    this.logger.info('Loading context with breadth-first strategy', { 
      rootPath,
      maxDepth: options.maxDepth
    });

    const startTime = Date.now();
    const files = new Map<string, string>();
    const metadata = new Map<string, any>();
    let totalTokens = 0;
    const maxTokens = options.maxTokens || 8000;
    const maxDepth = options.maxDepth || 5;

    try {
      // Load files level by level
      const levelStats: Array<{ level: number; files: number; tokens: number }> = [];
      
      for (let level = 0; level <= maxDepth && totalTokens < maxTokens; level++) {
        const levelFiles = await this.loadFilesAtLevel(
          rootPath,
          level,
          maxTokens - totalTokens,
          options
        );

        let levelTokens = 0;
        let levelFileCount = 0;

        for (const [filePath, content] of levelFiles) {
          files.set(filePath, content);
          const tokens = this.estimateTokens(content);
          totalTokens += tokens;
          levelTokens += tokens;
          levelFileCount++;
        }

        if (levelFileCount > 0) {
          levelStats.push({ level, files: levelFileCount, tokens: levelTokens });
        }

        this.logger.info('Completed level', { level, filesLoaded: levelFileCount, tokens: levelTokens });
      }

      // Build directory structure metadata
      const structure = await this.buildDirectoryStructure(rootPath, Math.min(3, maxDepth));
      metadata.set('directoryStructure', structure);
      metadata.set('levelStats', levelStats);

      this.logger.info('Breadth-first loading complete', {
        filesLoaded: files.size,
        totalTokens,
        levelsProcessed: levelStats.length,
        duration: Date.now() - startTime
      });

      return {
        files,
        metadata,
        totalTokens,
        strategy: this.name
      };
    } catch (error) {
      this.logger.error('Failed to load context with breadth-first strategy', error as Error);
      throw error;
    }
  }

  /**
   * Load files at a specific depth level
   */
  private async loadFilesAtLevel(
    rootPath: string,
    targetLevel: number,
    tokenBudget: number,
    options: LoadingOptions
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    let tokensUsed = 0;

    const dirsAtLevel = await this.getDirectoriesAtLevel(rootPath, targetLevel);
    
    // Process directories at this level
    for (const dir of dirsAtLevel) {
      if (tokensUsed >= tokenBudget) break;

      const entries = await this.fileSystem.listDirectory(dir);
      
      // Sort entries to prioritize important files
      const sortedEntries = this.sortEntries(entries);

      for (const entry of sortedEntries) {
        if (tokensUsed >= tokenBudget) break;

        const fullPath = this.fileSystem.join(dir, entry);
        
        // Skip if excluded
        if (this.shouldExclude(entry, options)) continue;

        try {
          const isFile = await this.fileSystem.isFile(fullPath);
          
          if (isFile && this.shouldIncludeFile(entry, options)) {
            const content = await this.fileSystem.readFile(fullPath);
            const tokens = this.estimateTokens(content);

            if (tokensUsed + tokens <= tokenBudget) {
              const relativePath = this.fileSystem.relative(rootPath, fullPath);
              files.set(relativePath, content);
              tokensUsed += tokens;
            }
          }
        } catch (error) {
          // Ignore read errors
        }
      }
    }

    return files;
  }

  /**
   * Get all directories at a specific depth level
   */
  private async getDirectoriesAtLevel(rootPath: string, targetLevel: number): Promise<string[]> {
    if (targetLevel === 0) return [rootPath];

    const dirsAtLevel: string[] = [];
    const visited = new Set<string>();

    const findDirs = async (currentPath: string, currentLevel: number): Promise<void> => {
      if (currentLevel > targetLevel || visited.has(currentPath)) return;
      visited.add(currentPath);

      if (currentLevel === targetLevel) {
        dirsAtLevel.push(currentPath);
        return;
      }

      try {
        const entries = await this.fileSystem.listDirectory(currentPath);
        
        for (const entry of entries) {
          const fullPath = this.fileSystem.join(currentPath, entry);
          
          // Skip common non-source directories
          if (this.isIgnoredDirectory(entry)) continue;

          try {
            const isDir = await this.fileSystem.isDirectory(fullPath);
            if (isDir) {
              await findDirs(fullPath, currentLevel + 1);
            }
          } catch {
            // Ignore stat errors
          }
        }
      } catch {
        // Ignore readdir errors
      }
    };

    await findDirs(rootPath, 0);
    return dirsAtLevel;
  }

  /**
   * Build directory structure for metadata
   */
  private async buildDirectoryStructure(
    rootPath: string,
    maxDepth: number
  ): Promise<any> {
    const structure: any = {
      name: this.fileSystem.basename(rootPath),
      type: 'directory',
      children: []
    };

    const buildLevel = async (currentPath: string, node: any, depth: number): Promise<void> => {
      if (depth > maxDepth) return;

      try {
        const entries = await this.fileSystem.listDirectory(currentPath);
        
        for (const entry of entries) {
          if (this.isIgnoredDirectory(entry)) continue;

          const fullPath = this.fileSystem.join(currentPath, entry);
          
          try {
            const isDir = await this.fileSystem.isDirectory(fullPath);
            
            if (isDir) {
              const childNode = {
                name: entry,
                type: 'directory',
                children: []
              };
              node.children.push(childNode);
              
              if (depth < maxDepth) {
                await buildLevel(fullPath, childNode, depth + 1);
              }
            } else if (depth === 0) {
              // Only include files at root level in structure
              const stats = await this.fileSystem.getStats(fullPath);
              node.children.push({
                name: entry,
                type: 'file',
                size: stats.size
              });
            }
          } catch {
            // Ignore stat errors
          }
        }
      } catch {
        // Ignore readdir errors
      }
    };

    await buildLevel(rootPath, structure, 0);
    return structure;
  }

  /**
   * Sort entries to prioritize important files
   */
  private sortEntries(entries: string[]): string[] {
    const priorities: Record<string, number> = {
      'README.md': 1,
      'readme.md': 1,
      'package.json': 2,
      'tsconfig.json': 3,
      'index.ts': 4,
      'index.js': 4,
      'main.ts': 5,
      'main.js': 5,
      'app.ts': 6,
      'app.js': 6
    };

    return entries.sort((a, b) => {
      const aPriority = priorities[a] || 999;
      const bPriority = priorities[b] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Secondary sort: directories first, then alphabetical
      return a.localeCompare(b);
    });
  }

  /**
   * Check if directory should be ignored
   */
  private isIgnoredDirectory(name: string): boolean {
    const ignored = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', '.cache',
      '.next', '.nuxt', '.turbo', 'venv',
      '__pycache__', '.pytest_cache', '.mypy_cache',
      'vendor', 'tmp', 'temp'
    ];
    return ignored.includes(name) || name.startsWith('.');
  }

  /**
   * Check if entry should be excluded based on options
   */
  private shouldExclude(entry: string, options: LoadingOptions): boolean {
    if (this.isIgnoredDirectory(entry)) return true;

    if (options.excludePatterns) {
      return options.excludePatterns.some(pattern => 
        this.matchesPattern(entry, pattern)
      );
    }

    return false;
  }

  /**
   * Check if file should be included
   */
  private shouldIncludeFile(filename: string, options: LoadingOptions): boolean {
    // Check file type filters
    if (options.fileTypes && options.fileTypes.length > 0) {
      const ext = this.fileSystem.basename(filename).split('.').pop()?.toLowerCase();
      if (ext && !options.fileTypes.includes(`.${ext}`)) {
        return false;
      }
    }

    // Check include patterns
    if (options.includePatterns) {
      return options.includePatterns.some(pattern => 
        this.matchesPattern(filename, pattern)
      );
    }

    // Default: include common file types
    const commonExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.json', '.yaml', '.yml',
      '.md', '.txt', '.env.example'
    ];
    
    const ext = this.fileSystem.basename(filename).split('.').pop()?.toLowerCase();
    return ext ? commonExtensions.includes(`.${ext}`) : false;
  }

  /**
   * Simple pattern matching
   */
  private matchesPattern(text: string, pattern: string): boolean {
    // Convert simple glob to regex
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(regex, 'i').test(text);
  }

  /**
   * Estimate token count
   */
  private estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }
}