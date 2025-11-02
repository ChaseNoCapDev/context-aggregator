import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import { TYPES } from '../types/InjectionTokens.js';
import type { ILoadingStrategy } from '../interfaces/IContextAggregator.js';
import type { LoadedContext, LoadingOptions } from '../types/ContextTypes.js';
import type { IRelevanceScorer } from '../interfaces/IRelevanceScorer.js';
import type { IProjectAnalyzer } from '../interfaces/IProjectAnalyzer.js';

/**
 * Progressive loading strategy
 * Loads context in stages based on relevance and token budget
 */
@injectable()
export class ProgressiveLoadingStrategy implements ILoadingStrategy {
  readonly name = 'progressive';

  constructor(
    @inject(TYPES.IFileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.ILogger) private logger: ILogger,
    @inject(TYPES.IRelevanceScorer) private relevanceScorer: IRelevanceScorer,
    @inject(TYPES.IProjectAnalyzer) private projectAnalyzer: IProjectAnalyzer
  ) {}

  /**
   * Load context progressively based on relevance
   */
  async loadContext(rootPath: string, options: LoadingOptions): Promise<LoadedContext> {
    this.logger.info('Loading context progressively', { rootPath, maxTokens: options.maxTokens });
    
    const startTime = Date.now();
    const files = new Map<string, string>();
    const metadata = new Map<string, any>();
    let totalTokens = 0;
    const maxTokens = options.maxTokens || 8000;

    try {
      // Stage 1: Analyze project structure
      const projectInfo = await this.projectAnalyzer.analyzeProject(rootPath);
      metadata.set('projectInfo', projectInfo);

      // Stage 2: Load entry points and core files
      const coreFiles = await this.loadCoreFiles(rootPath, projectInfo.entryPoints);
      for (const [filePath, content] of coreFiles) {
        const tokens = this.estimateTokens(content);
        if (totalTokens + tokens > maxTokens) break;
        
        files.set(filePath, content);
        totalTokens += tokens;
      }

      // Stage 3: Load configuration files
      if (totalTokens < maxTokens * 0.8) {
        const configFiles = await this.loadConfigFiles(rootPath, projectInfo.structure.configFiles);
        for (const [filePath, content] of configFiles) {
          const tokens = this.estimateTokens(content);
          if (totalTokens + tokens > maxTokens) break;
          
          files.set(filePath, content);
          totalTokens += tokens;
        }
      }

      // Stage 4: Load relevant source files based on query
      if (options.query && totalTokens < maxTokens * 0.9) {
        const relevantFiles = await this.loadRelevantFiles(
          rootPath,
          options.query,
          maxTokens - totalTokens,
          files
        );
        
        for (const [filePath, content] of relevantFiles) {
          files.set(filePath, content);
          totalTokens += this.estimateTokens(content);
        }
      }

      // Stage 5: Load documentation if space available
      if (totalTokens < maxTokens * 0.95) {
        const docFiles = await this.loadDocumentation(
          rootPath,
          projectInfo.structure.docsDirs,
          maxTokens - totalTokens
        );
        
        for (const [filePath, content] of docFiles) {
          files.set(filePath, content);
          totalTokens += this.estimateTokens(content);
        }
      }

      this.logger.info('Progressive loading complete', {
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
      this.logger.error('Failed to load context progressively', error as Error);
      throw error;
    }
  }

  /**
   * Load core files (entry points, main files)
   */
  private async loadCoreFiles(
    rootPath: string,
    entryPoints: string[]
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    
    // Load entry points
    for (const entryPoint of entryPoints) {
      const fullPath = this.fileSystem.join(rootPath, entryPoint);
      try {
        const content = await this.fileSystem.readFile(fullPath);
        files.set(entryPoint, content);
      } catch (error) {
        this.logger.warn('Failed to load entry point', { entryPoint, error });
      }
    }

    // Load common core files if not already loaded
    const corePatterns = [
      'README.md', 'readme.md',
      'package.json',
      'tsconfig.json',
      '.env.example',
      'docker-compose.yml'
    ];

    for (const pattern of corePatterns) {
      if (!files.has(pattern)) {
        const fullPath = this.fileSystem.join(rootPath, pattern);
        try {
          if (await this.fileSystem.exists(fullPath)) {
            const content = await this.fileSystem.readFile(fullPath);
            files.set(pattern, content);
          }
        } catch (error) {
          // Ignore errors for optional files
        }
      }
    }

    return files;
  }

  /**
   * Load configuration files
   */
  private async loadConfigFiles(
    rootPath: string,
    configFiles: string[]
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    
    // Prioritize certain config files
    const priorityConfigs = configFiles.sort((a, b) => {
      const priorities = ['package.json', 'tsconfig.json', '.env', 'config.'];
      const aPriority = priorities.findIndex(p => a.includes(p));
      const bPriority = priorities.findIndex(p => b.includes(p));
      
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });

    for (const configFile of priorityConfigs.slice(0, 10)) {
      const fullPath = this.fileSystem.join(rootPath, configFile);
      try {
        const content = await this.fileSystem.readFile(fullPath);
        files.set(configFile, content);
      } catch (error) {
        this.logger.warn('Failed to load config file', { configFile, error });
      }
    }

    return files;
  }

  /**
   * Load files relevant to the query
   */
  private async loadRelevantFiles(
    rootPath: string,
    query: string,
    tokenBudget: number,
    existingFiles: Map<string, string>
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    let tokensUsed = 0;

    // Get all source files
    const sourceFiles = await this.findSourceFiles(rootPath);
    
    // Filter out already loaded files
    const unloadedFiles = sourceFiles.filter(f => !existingFiles.has(f));

    // Score files based on query relevance
    const scoredFiles = await this.relevanceScorer.scoreFiles(unloadedFiles, {
      query,
      contextPath: rootPath,
      threshold: 40, // Minimum relevance score
      fileTypes: ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs']
    });

    // Load files in order of relevance
    for (const { path: filePath } of scoredFiles) {
      if (tokensUsed >= tokenBudget) break;

      try {
        const fullPath = this.fileSystem.join(rootPath, filePath);
        const content = await this.fileSystem.readFile(fullPath);
        const tokens = this.estimateTokens(content);

        if (tokensUsed + tokens <= tokenBudget) {
          files.set(filePath, content);
          tokensUsed += tokens;
        }
      } catch (error) {
        this.logger.warn('Failed to load relevant file', { filePath, error });
      }
    }

    return files;
  }

  /**
   * Load documentation files
   */
  private async loadDocumentation(
    rootPath: string,
    docsDirs: string[],
    tokenBudget: number
  ): Promise<Map<string, string>> {
    const files = new Map<string, string>();
    let tokensUsed = 0;

    // First, try to load main documentation files
    const mainDocs = ['README.md', 'CONTRIBUTING.md', 'API.md', 'ARCHITECTURE.md'];
    
    for (const docFile of mainDocs) {
      if (tokensUsed >= tokenBudget) break;

      const fullPath = this.fileSystem.join(rootPath, docFile);
      try {
        if (await this.fileSystem.exists(fullPath)) {
          const content = await this.fileSystem.readFile(fullPath);
          const tokens = this.estimateTokens(content);

          if (tokensUsed + tokens <= tokenBudget) {
            files.set(docFile, content);
            tokensUsed += tokens;
          }
        }
      } catch (error) {
        // Ignore errors for optional files
      }
    }

    // Then load from docs directories
    for (const docsDir of docsDirs) {
      if (tokensUsed >= tokenBudget) break;

      try {
        const docFiles = await this.findDocumentationFiles(this.fileSystem.join(rootPath, docsDir));
        
        for (const docFile of docFiles.slice(0, 5)) {
          if (tokensUsed >= tokenBudget) break;

          const content = await this.fileSystem.readFile(docFile);
          const tokens = this.estimateTokens(content);

          if (tokensUsed + tokens <= tokenBudget) {
            const relativePath = this.fileSystem.relative(rootPath, docFile);
            files.set(relativePath, content);
            tokensUsed += tokens;
          }
        }
      } catch (error) {
        this.logger.warn('Failed to load docs directory', { docsDir, error });
      }
    }

    return files;
  }

  /**
   * Find all source files in the project
   */
  private async findSourceFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    const visited = new Set<string>();

    const walk = async (dir: string, depth = 0): Promise<void> => {
      if (depth > 5 || visited.has(dir)) return;
      visited.add(dir);

      try {
        const entries = await this.fileSystem.listDirectory(dir);
        
        for (const entry of entries) {
          const fullPath = this.fileSystem.join(dir, entry);
          
          // Skip common ignore patterns
          if (this.shouldIgnore(entry)) continue;

          const isDir = await this.fileSystem.isDirectory(fullPath);
          
          if (isDir) {
            await walk(fullPath, depth + 1);
          } else if (this.isSourceFile(entry)) {
            const relativePath = this.fileSystem.relative(rootPath, fullPath);
            files.push(relativePath);
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
   * Find documentation files
   */
  private async findDocumentationFiles(docsPath: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await this.fileSystem.listDirectory(docsPath);
      
      for (const entry of entries) {
        if (entry.toLowerCase().endsWith('.md')) {
          files.push(this.fileSystem.join(docsPath, entry));
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return files;
  }

  /**
   * Check if a file should be ignored
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', '.cache',
      '.next', '.nuxt', '.turbo', 'venv',
      '__pycache__', '.pytest_cache', '.mypy_cache',
      '.DS_Store', 'Thumbs.db'
    ];
    return ignorePatterns.includes(name) || name.startsWith('.');
  }

  /**
   * Check if a file is a source file
   */
  private isSourceFile(name: string): boolean {
    const sourceExtensions = [
      '.ts', '.tsx', '.js', '.jsx',
      '.py', '.go', '.rs', '.java',
      '.cs', '.cpp', '.c', '.h',
      '.rb', '.php', '.swift', '.kt'
    ];
    return sourceExtensions.some(ext => name.endsWith(ext));
  }

  /**
   * Estimate token count for content
   */
  private estimateTokens(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }
}