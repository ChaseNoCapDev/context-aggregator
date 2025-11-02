/**
 * @fileoverview Relevance scorer interface
 */

/**
 * Relevance scorer interface
 */
export interface IRelevanceScorer {
  /**
   * Score files based on relevance criteria
   */
  scoreFiles(
    files: string[],
    criteria: ScoringCriteria
  ): Promise<FileRelevance[]>;
  
  /**
   * Calculate relevance factors for a file
   */
  calculateRelevance(
    filePath: string,
    contextPath?: string
  ): Promise<RelevanceFactors>;
}

/**
 * File relevance information
 */
export interface FileRelevance {
  path: string;
  score: number;
  factors: RelevanceFactors;
  reason: string;
}

/**
 * Scoring criteria
 */
export interface ScoringCriteria {
  query?: string;
  contextPath?: string;
  fileTypes?: string[];
  includePatterns?: string[];
  excludePatterns?: string[];
  threshold?: number;
  weights?: {
    pathScore: number;
    nameScore: number;
    typeScore: number;
    depthScore: number;
    sizeScore: number;
    recencyScore: number;
    queryScore?: number;
  };
}

/**
 * Relevance factors
 */
export interface RelevanceFactors {
  pathScore: number;
  nameScore: number;
  typeScore: number;
  depthScore: number;
  sizeScore: number;
  recencyScore: number;
}