import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import type { IFileSystem } from '@chasenocap/file-system';
import { TYPES } from '../types/InjectionTokens.js';
import type { 
  IRelevanceScorer, 
  FileRelevance, 
  ScoringCriteria,
  RelevanceFactors 
} from '../interfaces/IRelevanceScorer.js';
import path from 'path';

/**
 * RelevanceScorer implementation
 * Scores files based on relevance to queries and context
 */
@injectable()
export class RelevanceScorer implements IRelevanceScorer {
  private readonly keywordWeights = new Map<string, number>([
    // High priority keywords
    ['main', 10], ['index', 10], ['app', 9], ['core', 9],
    ['api', 8], ['service', 8], ['controller', 8], ['model', 8],
    ['interface', 7], ['type', 7], ['schema', 7], ['config', 7],
    
    // Medium priority keywords
    ['util', 5], ['helper', 5], ['lib', 5], ['common', 5],
    ['component', 5], ['module', 5], ['route', 5], ['middleware', 5],
    
    // Low priority keywords
    ['test', 2], ['spec', 2], ['mock', 2], ['example', 2],
    ['demo', 1], ['sample', 1], ['backup', 1], ['old', 1],
    
    // Negative keywords
    ['deprecated', -5], ['legacy', -5], ['temp', -5], ['tmp', -5],
    ['node_modules', -10], ['dist', -10], ['build', -10], ['coverage', -10]
  ]);

  constructor(
    @inject(TYPES.IFileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.ILogger) private logger: ILogger
  ) {}

  /**
   * Score files based on relevance criteria
   */
  async scoreFiles(
    files: string[],
    criteria: ScoringCriteria
  ): Promise<FileRelevance[]> {
    this.logger.info('Scoring files for relevance', { 
      fileCount: files.length,
      hasQuery: !!criteria.query
    });

    const scoredFiles = await Promise.all(
      files.map(file => this.scoreFile(file, criteria))
    );

    // Sort by score descending
    scoredFiles.sort((a, b) => b.score - a.score);

    // Apply threshold filter if specified
    const filtered = criteria.threshold 
      ? scoredFiles.filter(f => f.score >= criteria.threshold!)
      : scoredFiles;

    this.logger.info('File scoring complete', {
      totalFiles: files.length,
      aboveThreshold: filtered.length,
      topScore: filtered[0]?.score || 0
    });

    return filtered;
  }

  /**
   * Calculate relevance factors for a file
   */
  async calculateRelevance(
    filePath: string,
    contextPath?: string
  ): Promise<RelevanceFactors> {
    const factors: RelevanceFactors = {
      pathScore: this.calculatePathScore(filePath),
      nameScore: this.calculateNameScore(path.basename(filePath)),
      typeScore: this.calculateTypeScore(filePath),
      depthScore: this.calculateDepthScore(filePath, contextPath),
      sizeScore: await this.calculateSizeScore(filePath),
      recencyScore: await this.calculateRecencyScore(filePath)
    };

    return factors;
  }

  /**
   * Score a single file
   */
  private async scoreFile(
    filePath: string,
    criteria: ScoringCriteria
  ): Promise<FileRelevance> {
    const factors = await this.calculateRelevance(filePath, criteria.contextPath);
    
    // Calculate weighted score
    let score = 0;
    const weights = criteria.weights || this.getDefaultWeights();

    score += factors.pathScore * weights.pathScore;
    score += factors.nameScore * weights.nameScore;
    score += factors.typeScore * weights.typeScore;
    score += factors.depthScore * weights.depthScore;
    score += factors.sizeScore * weights.sizeScore;
    score += factors.recencyScore * weights.recencyScore;

    // Apply query relevance if provided
    if (criteria.query) {
      const queryScore = await this.calculateQueryRelevance(filePath, criteria.query);
      score += queryScore * (weights.queryScore || 2.0);
    }

    // Apply file type filters
    if (criteria.fileTypes && criteria.fileTypes.length > 0) {
      const ext = path.extname(filePath).toLowerCase();
      if (!criteria.fileTypes.includes(ext)) {
        score *= 0.1; // Heavily penalize non-matching types
      }
    }

    // Apply path includes/excludes
    if (criteria.includePatterns) {
      const matches = criteria.includePatterns.some(pattern => 
        this.matchesPattern(filePath, pattern)
      );
      if (!matches) score *= 0.2;
    }

    if (criteria.excludePatterns) {
      const matches = criteria.excludePatterns.some(pattern => 
        this.matchesPattern(filePath, pattern)
      );
      if (matches) score = 0;
    }

    return {
      path: filePath,
      score: Math.max(0, Math.min(100, score)), // Clamp between 0-100
      factors,
      reason: this.generateReason(factors, score)
    };
  }

  /**
   * Calculate path-based score
   */
  private calculatePathScore(filePath: string): number {
    let score = 50; // Base score
    const parts = filePath.toLowerCase().split(path.sep);

    for (const part of parts) {
      for (const [keyword, weight] of this.keywordWeights) {
        if (part.includes(keyword)) {
          score += weight;
        }
      }
    }

    // Bonus for being in src or lib directories
    if (parts.includes('src') || parts.includes('lib')) {
      score += 10;
    }

    // Penalty for deep nesting
    score -= Math.max(0, (parts.length - 4) * 2);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate filename-based score
   */
  private calculateNameScore(filename: string): number {
    let score = 50;
    const nameLower = filename.toLowerCase();
    const nameWithoutExt = path.parse(filename).name.toLowerCase();

    // Check for important filenames
    const importantNames = ['index', 'main', 'app', 'server', 'api'];
    if (importantNames.includes(nameWithoutExt)) {
      score += 30;
    }

    // Check for keywords in filename
    for (const [keyword, weight] of this.keywordWeights) {
      if (nameLower.includes(keyword)) {
        score += weight;
      }
    }

    // Penalty for test files
    if (nameLower.includes('test') || nameLower.includes('spec')) {
      score -= 20;
    }

    // Penalty for long filenames
    if (filename.length > 50) {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate file type score
   */
  private calculateTypeScore(filePath: string): number {
    const ext = path.extname(filePath).toLowerCase();
    
    const typeScores: Record<string, number> = {
      '.ts': 90,
      '.tsx': 85,
      '.js': 80,
      '.jsx': 75,
      '.py': 80,
      '.go': 80,
      '.rs': 80,
      '.java': 75,
      '.cs': 75,
      '.cpp': 70,
      '.c': 70,
      '.h': 65,
      '.hpp': 65,
      '.json': 60,
      '.yaml': 60,
      '.yml': 60,
      '.xml': 55,
      '.md': 50,
      '.txt': 40,
      '.log': 20,
      '.lock': 10
    };

    return typeScores[ext] || 30;
  }

  /**
   * Calculate depth score (prefer files closer to root or context)
   */
  private calculateDepthScore(filePath: string, contextPath?: string): number {
    const depth = filePath.split(path.sep).length;
    
    if (contextPath) {
      const contextDepth = contextPath.split(path.sep).length;
      const relativeDepth = depth - contextDepth;
      
      // Prefer files at or near context level
      if (relativeDepth === 0) return 100;
      if (relativeDepth === 1) return 90;
      if (relativeDepth === 2) return 70;
      
      return Math.max(0, 100 - (relativeDepth * 10));
    }

    // Without context, prefer files that aren't too deep
    if (depth <= 3) return 90;
    if (depth <= 5) return 70;
    if (depth <= 7) return 50;
    
    return Math.max(0, 100 - (depth * 5));
  }

  /**
   * Calculate size score (prefer reasonably sized files)
   */
  private async calculateSizeScore(filePath: string): Promise<number> {
    try {
      const stats = await this.fileSystem.getStats(filePath);
      const sizeKB = stats.size / 1024;

      // Optimal size range: 1KB - 50KB
      if (sizeKB >= 1 && sizeKB <= 50) return 100;
      
      // Good size range: 50KB - 200KB
      if (sizeKB > 50 && sizeKB <= 200) return 80;
      
      // Too small (likely empty or trivial)
      if (sizeKB < 1) return 20;
      
      // Too large
      if (sizeKB > 200 && sizeKB <= 500) return 60;
      if (sizeKB > 500 && sizeKB <= 1000) return 40;
      
      // Very large files
      return 20;
    } catch (error) {
      // If we can't read the file, give it a neutral score
      return 50;
    }
  }

  /**
   * Calculate recency score (prefer recently modified files)
   */
  private async calculateRecencyScore(filePath: string): Promise<number> {
    try {
      const stats = await this.fileSystem.getStats(filePath);
      const now = Date.now();
      const age = now - stats.modifiedAt.getTime();
      const days = age / (1000 * 60 * 60 * 24);

      // Very recent (within 1 day)
      if (days < 1) return 100;
      
      // Recent (within 1 week)
      if (days < 7) return 90;
      
      // Somewhat recent (within 1 month)
      if (days < 30) return 70;
      
      // Older (within 3 months)
      if (days < 90) return 50;
      
      // Old (within 1 year)
      if (days < 365) return 30;
      
      // Very old
      return 10;
    } catch (error) {
      // If we can't read the file, give it a neutral score
      return 50;
    }
  }

  /**
   * Calculate query relevance score
   */
  private async calculateQueryRelevance(filePath: string, query: string): Promise<number> {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(term => term.length > 2);
    
    let score = 0;
    
    // Check filename relevance
    const filename = path.basename(filePath).toLowerCase();
    for (const term of queryTerms) {
      if (filename.includes(term)) {
        score += 20;
      }
    }
    
    // Check path relevance
    const pathLower = filePath.toLowerCase();
    for (const term of queryTerms) {
      if (pathLower.includes(term)) {
        score += 10;
      }
    }
    
    // Try to read file content for better matching (with size limit)
    try {
      const stats = await this.fileSystem.getStats(filePath);
      if (stats.size < 100 * 1024) { // Only read files under 100KB
        const content = await this.fileSystem.readFile(filePath);
        const contentLower = content.toLowerCase();
        
        for (const term of queryTerms) {
          const occurrences = (contentLower.match(new RegExp(term, 'g')) || []).length;
          score += Math.min(occurrences * 2, 30); // Cap per-term score
        }
      }
    } catch (error) {
      // Ignore read errors
    }
    
    return Math.min(score, 100);
  }

  /**
   * Get default scoring weights
   */
  private getDefaultWeights(): ScoringCriteria['weights'] {
    return {
      pathScore: 1.5,
      nameScore: 2.0,
      typeScore: 1.2,
      depthScore: 0.8,
      sizeScore: 0.5,
      recencyScore: 0.7,
      queryScore: 2.5
    };
  }

  /**
   * Check if path matches pattern
   */
  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
      .replace(/\[(!)?([^\]]+)\]/g, (match, negate, chars) => {
        return negate ? `[^${chars}]` : `[${chars}]`;
      });
    
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(filePath);
  }

  /**
   * Generate human-readable reason for score
   */
  private generateReason(factors: RelevanceFactors, totalScore: number): string {
    const reasons: string[] = [];
    
    // Find the most significant factors
    const factorEntries = Object.entries(factors).sort((a, b) => b[1] - a[1]);
    
    for (const [factor, score] of factorEntries.slice(0, 3)) {
      if (score >= 80) {
        switch (factor) {
          case 'pathScore':
            reasons.push('important path location');
            break;
          case 'nameScore':
            reasons.push('significant filename');
            break;
          case 'typeScore':
            reasons.push('relevant file type');
            break;
          case 'depthScore':
            reasons.push('good file depth');
            break;
          case 'sizeScore':
            reasons.push('optimal file size');
            break;
          case 'recencyScore':
            reasons.push('recently modified');
            break;
        }
      }
    }
    
    if (reasons.length === 0) {
      if (totalScore >= 70) reasons.push('generally relevant');
      else if (totalScore >= 40) reasons.push('moderately relevant');
      else reasons.push('low relevance');
    }
    
    return reasons.join(', ');
  }
}