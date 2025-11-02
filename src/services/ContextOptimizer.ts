import { injectable, inject } from 'inversify';
import type { ILogger } from '@chasenocap/logger';
import { TYPES } from '../types/InjectionTokens.js';
import type { 
  IContextOptimizer, 
  OptimizationStrategy, 
  OptimizationResult,
  TokenInfo,
  ContextChunk
} from '../interfaces/IContextOptimizer.js';

/**
 * ContextOptimizer implementation
 * Optimizes context for token limits and relevance
 */
@injectable()
export class ContextOptimizer implements IContextOptimizer {
  private readonly AVERAGE_CHARS_PER_TOKEN = 4;
  private readonly DEFAULT_MAX_TOKENS = 8000;
  private readonly CHUNK_OVERLAP = 200; // tokens

  constructor(
    @inject(TYPES.ILogger) private logger: ILogger
  ) {}

  /**
   * Optimize context content based on strategy
   */
  async optimizeContext(
    content: string,
    strategy: OptimizationStrategy,
    maxTokens?: number
  ): Promise<OptimizationResult> {
    const startTime = Date.now();
    this.logger.info('Optimizing context', { strategy, maxTokens });

    const originalTokens = this.estimateTokenCount(content);
    const targetTokens = maxTokens || this.DEFAULT_MAX_TOKENS;

    let optimizedContent: string;
    let tokensReduced = 0;

    try {
      switch (strategy) {
        case 'summarize':
          optimizedContent = await this.summarizeContent(content, targetTokens);
          break;
        case 'selective':
          optimizedContent = await this.selectiveOptimization(content, targetTokens);
          break;
        case 'compress':
          optimizedContent = await this.compressContent(content);
          break;
        default:
          optimizedContent = content;
      }

      const finalTokens = this.estimateTokenCount(optimizedContent);
      tokensReduced = originalTokens - finalTokens;

      const result: OptimizationResult = {
        originalContent: content,
        optimizedContent,
        originalTokens,
        optimizedTokens: finalTokens,
        reduction: tokensReduced > 0 ? (tokensReduced / originalTokens) * 100 : 0,
        strategy
      };

      this.logger.info('Context optimization complete', {
        originalTokens,
        optimizedTokens: finalTokens,
        reduction: `${result.reduction.toFixed(2)}%`,
        duration: Date.now() - startTime
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to optimize context', error as Error);
      throw error;
    }
  }

  /**
   * Chunk context into smaller pieces
   */
  async chunkContext(
    content: string,
    maxChunkSize?: number
  ): Promise<ContextChunk[]> {
    const chunkSize = maxChunkSize || 2000; // tokens
    const chunks: ContextChunk[] = [];
    
    // Split by sections first (markdown headers, code blocks, etc.)
    const sections = this.splitIntoSections(content);
    
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;

    for (const section of sections) {
      const sectionTokens = this.estimateTokenCount(section);

      // If section is too large, split it further
      if (sectionTokens > chunkSize) {
        // Finish current chunk
        if (currentChunk) {
          chunks.push(this.createChunk(currentChunk, chunkIndex++));
          currentChunk = '';
          currentTokens = 0;
        }

        // Split large section
        const subChunks = this.splitLargeSection(section, chunkSize);
        chunks.push(...subChunks.map(chunk => this.createChunk(chunk, chunkIndex++)));
      } else if (currentTokens + sectionTokens > chunkSize) {
        // Start new chunk
        chunks.push(this.createChunk(currentChunk, chunkIndex++));
        currentChunk = section;
        currentTokens = sectionTokens;
      } else {
        // Add to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + section;
        currentTokens += sectionTokens;
      }
    }

    // Add final chunk
    if (currentChunk) {
      chunks.push(this.createChunk(currentChunk, chunkIndex));
    }

    // Add overlap between chunks
    this.addChunkOverlap(chunks);

    this.logger.info('Context chunked', { 
      totalChunks: chunks.length,
      avgChunkSize: Math.round(chunks.reduce((sum, c) => sum + c.tokenCount, 0) / chunks.length)
    });

    return chunks;
  }

  /**
   * Estimate token count for content
   */
  estimateTokenCount(content: string): number {
    // More accurate estimation based on different content types
    let tokenCount = 0;

    // Split by whitespace and punctuation
    const words = content.split(/[\s\n]+/);
    
    for (const word of words) {
      if (!word) continue;

      // Code tokens often have more characters
      if (this.isCodeToken(word)) {
        tokenCount += Math.ceil(word.length / 3);
      }
      // Regular words
      else if (word.length <= 4) {
        tokenCount += 1;
      } else {
        tokenCount += Math.ceil(word.length / this.AVERAGE_CHARS_PER_TOKEN);
      }
    }

    // Account for punctuation and special characters
    const punctuationCount = (content.match(/[.,;:!?()[\]{}"'`]/g) || []).length;
    tokenCount += Math.ceil(punctuationCount * 0.3);

    return tokenCount;
  }

  /**
   * Get detailed token information
   */
  async getTokenInfo(content: string): Promise<TokenInfo> {
    const tokens = this.estimateTokenCount(content);
    const sections = this.splitIntoSections(content);
    
    const distribution: Record<string, number> = {
      code: 0,
      documentation: 0,
      comments: 0,
      whitespace: 0,
      other: 0
    };

    // Analyze content distribution
    for (const section of sections) {
      const sectionTokens = this.estimateTokenCount(section);
      
      if (this.isCodeBlock(section)) {
        distribution.code += sectionTokens;
      } else if (this.isComment(section)) {
        distribution.comments += sectionTokens;
      } else if (this.isDocumentation(section)) {
        distribution.documentation += sectionTokens;
      } else if (section.trim().length === 0) {
        distribution.whitespace += sectionTokens;
      } else {
        distribution.other += sectionTokens;
      }
    }

    // Calculate percentages
    const breakdown = Object.entries(distribution).reduce((acc, [key, value]) => {
      acc[key] = (value / tokens) * 100;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTokens: tokens,
      breakdown,
      estimatedCost: this.estimateCost(tokens),
      withinLimit: tokens <= this.DEFAULT_MAX_TOKENS
    };
  }

  /**
   * Summarize content to fit within token limit
   */
  private async summarizeContent(content: string, maxTokens: number): Promise<string> {
    const sections = this.splitIntoSections(content);
    const prioritizedSections = this.prioritizeSections(sections);
    
    let result = '';
    let currentTokens = 0;

    for (const section of prioritizedSections) {
      const summary = this.summarizeSection(section);
      const summaryTokens = this.estimateTokenCount(summary);

      if (currentTokens + summaryTokens > maxTokens) {
        // Try to fit a shorter summary
        const shorterSummary = this.summarizeSection(section, true);
        const shorterTokens = this.estimateTokenCount(shorterSummary);
        
        if (currentTokens + shorterTokens <= maxTokens) {
          result += (result ? '\n\n' : '') + shorterSummary;
          currentTokens += shorterTokens;
        }
        break;
      }

      result += (result ? '\n\n' : '') + summary;
      currentTokens += summaryTokens;
    }

    return result;
  }

  /**
   * Selective optimization - keep most relevant parts
   */
  private async selectiveOptimization(content: string, maxTokens: number): Promise<string> {
    const sections = this.splitIntoSections(content);
    const scored = sections.map(section => ({
      content: section,
      score: this.calculateRelevanceScore(section),
      tokens: this.estimateTokenCount(section)
    }));

    // Sort by relevance score
    scored.sort((a, b) => b.score - a.score);

    let result = '';
    let currentTokens = 0;

    for (const { content: section, tokens } of scored) {
      if (currentTokens + tokens > maxTokens) {
        continue;
      }
      result += (result ? '\n\n' : '') + section;
      currentTokens += tokens;
    }

    return result;
  }

  /**
   * Compress content by removing redundancy
   */
  private async compressContent(content: string): Promise<string> {
    let compressed = content;

    // Remove excessive whitespace
    compressed = compressed.replace(/\n{3,}/g, '\n\n');
    compressed = compressed.replace(/[ \t]+/g, ' ');

    // Remove duplicate lines
    const lines = compressed.split('\n');
    const uniqueLines = Array.from(new Set(lines));
    compressed = uniqueLines.join('\n');

    // Compress code blocks
    compressed = compressed.replace(/```[\s\S]*?```/g, (match) => {
      // Keep only essential parts of code blocks
      const lines = match.split('\n');
      if (lines.length > 20) {
        return lines.slice(0, 10).join('\n') + '\n// ... truncated ...\n' + lines.slice(-5).join('\n');
      }
      return match;
    });

    // Remove verbose comments
    compressed = compressed.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      if (match.length > 200) {
        return '/* ... detailed comment removed ... */';
      }
      return match;
    });

    return compressed;
  }

  /**
   * Split content into logical sections
   */
  private splitIntoSections(content: string): string[] {
    const sections: string[] = [];
    const lines = content.split('\n');
    let currentSection = '';
    let inCodeBlock = false;

    for (const line of lines) {
      // Check for code block markers
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }

      // Check for section markers (headers, etc.)
      if (!inCodeBlock && this.isSectionMarker(line)) {
        if (currentSection.trim()) {
          sections.push(currentSection.trim());
        }
        currentSection = line;
      } else {
        currentSection += (currentSection ? '\n' : '') + line;
      }
    }

    // Add final section
    if (currentSection.trim()) {
      sections.push(currentSection.trim());
    }

    return sections;
  }

  /**
   * Split a large section into smaller chunks
   */
  private splitLargeSection(section: string, maxTokens: number): string[] {
    const chunks: string[] = [];
    const lines = section.split('\n');
    let currentChunk = '';
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.estimateTokenCount(line);
      
      if (currentTokens + lineTokens > maxTokens && currentChunk) {
        chunks.push(currentChunk);
        currentChunk = line;
        currentTokens = lineTokens;
      } else {
        currentChunk += (currentChunk ? '\n' : '') + line;
        currentTokens += lineTokens;
      }
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Create a context chunk
   */
  private createChunk(content: string, index: number): ContextChunk {
    return {
      content,
      index,
      tokenCount: this.estimateTokenCount(content),
      metadata: {
        hasCode: this.containsCode(content),
        hasDocumentation: this.containsDocumentation(content),
        language: this.detectLanguage(content)
      }
    };
  }

  /**
   * Add overlap between chunks for context continuity
   */
  private addChunkOverlap(chunks: ContextChunk[]): void {
    for (let i = 0; i < chunks.length - 1; i++) {
      const currentChunk = chunks[i];
      const nextChunk = chunks[i + 1];

      // Extract overlap from end of current chunk
      const currentLines = currentChunk.content.split('\n');
      const overlapLines = Math.min(5, Math.floor(currentLines.length * 0.1));
      const overlap = currentLines.slice(-overlapLines).join('\n');

      // Prepend to next chunk
      nextChunk.content = overlap + '\n\n' + nextChunk.content;
      nextChunk.tokenCount = this.estimateTokenCount(nextChunk.content);
    }
  }

  /**
   * Prioritize sections by importance
   */
  private prioritizeSections(sections: string[]): string[] {
    return sections.sort((a, b) => {
      const scoreA = this.calculateSectionImportance(a);
      const scoreB = this.calculateSectionImportance(b);
      return scoreB - scoreA;
    });
  }

  /**
   * Calculate section importance score
   */
  private calculateSectionImportance(section: string): number {
    let score = 0;

    // Headers are important
    if (/^#{1,3}\s/.test(section)) score += 10;

    // Code blocks are important
    if (this.isCodeBlock(section)) score += 8;

    // Exports and interfaces are important
    if (/export\s+(interface|class|function|const)/i.test(section)) score += 7;

    // Error handling is important
    if (/error|exception|throw|catch/i.test(section)) score += 5;

    // Documentation is moderately important
    if (this.isDocumentation(section)) score += 3;

    // Length penalty for very long sections
    const tokens = this.estimateTokenCount(section);
    if (tokens > 500) score -= 2;

    return score;
  }

  /**
   * Calculate relevance score for selective optimization
   */
  private calculateRelevanceScore(section: string): number {
    let score = this.calculateSectionImportance(section);

    // Boost for main functionality
    if (/main|primary|core|key/i.test(section)) score += 5;

    // Boost for public API
    if (/public|export|api/i.test(section)) score += 4;

    // Reduce for test code
    if (/test|spec|mock/i.test(section)) score -= 3;

    // Reduce for examples
    if (/example|sample|demo/i.test(section)) score -= 2;

    return Math.max(0, score);
  }

  /**
   * Summarize a section of content
   */
  private summarizeSection(section: string, veryShort = false): string {
    // Extract key information
    const lines = section.split('\n').filter(line => line.trim());
    
    if (veryShort) {
      // Ultra-short summary
      if (this.isCodeBlock(section)) {
        const firstLine = lines.find(line => !line.startsWith('```')) || '';
        return `[Code block: ${firstLine.substring(0, 50)}...]`;
      }
      return lines[0]?.substring(0, 100) + '...';
    }

    // Regular summary
    if (this.isCodeBlock(section)) {
      const language = this.detectLanguage(section);
      const functionName = this.extractFunctionName(section);
      return `[${language} code${functionName ? `: ${functionName}` : ''}]`;
    }

    // Keep headers and first few lines
    const summary: string[] = [];
    let lineCount = 0;
    
    for (const line of lines) {
      if (this.isSectionMarker(line) || lineCount < 3) {
        summary.push(line);
        lineCount++;
      }
    }

    return summary.join('\n');
  }

  /**
   * Helper methods for content analysis
   */
  private isCodeToken(word: string): boolean {
    return /[_${}()[\]<>]/.test(word) || /^[A-Z_]+$/.test(word);
  }

  private isCodeBlock(content: string): boolean {
    return content.includes('```') || /^\s{4,}/.test(content);
  }

  private isComment(content: string): boolean {
    return /^(\s*\/\/|\s*\/\*|\s*#)/.test(content);
  }

  private isDocumentation(content: string): boolean {
    return /^(\s*\*\s|#{1,6}\s|>\s)/.test(content);
  }

  private isSectionMarker(line: string): boolean {
    return /^#{1,6}\s/.test(line) || /^={3,}$/.test(line) || /^-{3,}$/.test(line);
  }

  private containsCode(content: string): boolean {
    return /```|^\s{4,}|export\s|import\s|function\s|class\s|const\s|let\s|var\s/.test(content);
  }

  private containsDocumentation(content: string): boolean {
    return /^#{1,6}\s|^\*\s|^>\s|@param|@returns|@throws/.test(content);
  }

  private detectLanguage(content: string): string {
    if (/```(\w+)/.test(content)) {
      const match = content.match(/```(\w+)/);
      return match ? match[1] : 'unknown';
    }
    
    if (/\bimport\s.*from\s|export\s|const\s.*=\s.*require/.test(content)) return 'javascript';
    if (/\binterface\s|type\s.*=|:\s*(string|number|boolean)/.test(content)) return 'typescript';
    if (/\bdef\s|import\s.*\n|from\s.*import/.test(content)) return 'python';
    if (/\bpackage\s|func\s|var\s.*string/.test(content)) return 'go';
    
    return 'unknown';
  }

  private extractFunctionName(content: string): string | null {
    const patterns = [
      /function\s+(\w+)/,
      /const\s+(\w+)\s*=/,
      /class\s+(\w+)/,
      /def\s+(\w+)/,
      /func\s+(\w+)/
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  private estimateCost(tokens: number): number {
    // Rough cost estimation (adjust based on actual pricing)
    const costPer1kTokens = 0.01; // $0.01 per 1k tokens
    return (tokens / 1000) * costPer1kTokens;
  }
}