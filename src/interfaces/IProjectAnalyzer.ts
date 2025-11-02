/**
 * @fileoverview Project analyzer interface
 */

/**
 * Project analyzer interface
 */
export interface IProjectAnalyzer {
  /**
   * Analyze a project directory
   */
  analyzeProject(projectPath: string): Promise<ProjectInfo>;
  
  /**
   * Detect project type
   */
  detectProjectType(projectPath: string): Promise<ProjectType>;
  
  /**
   * Detect framework
   */
  detectFramework(projectPath: string): Promise<FrameworkInfo | null>;
  
  /**
   * Detect languages
   */
  detectLanguages(projectPath: string): Promise<string[]>;
  
  /**
   * Analyze project structure
   */
  analyzeStructure(projectPath: string): Promise<Record<string, string[]>>;
  
  /**
   * Extract dependencies
   */
  extractDependencies(projectPath: string): Promise<string[]>;
  
  /**
   * Detect test framework
   */
  detectTestFramework(projectPath: string): Promise<string | null>;
  
  /**
   * Detect build tool
   */
  detectBuildTool(projectPath: string): Promise<string | null>;
  
  /**
   * Find entry points
   */
  findEntryPoints(
    projectPath: string,
    projectType: ProjectType,
    framework: FrameworkInfo | null
  ): Promise<string[]>;
}

/**
 * Project types
 */
export type ProjectType = 
  | 'library'
  | 'web'
  | 'api'
  | 'cli'
  | 'monorepo'
  | 'unknown';

/**
 * Framework information
 */
export interface FrameworkInfo {
  name: string;
  files: string[];
  patterns: string[];
  configFiles: string[];
}

/**
 * Project information
 */
export interface ProjectInfo {
  type: ProjectType;
  framework: FrameworkInfo | null;
  languages: string[];
  structure: Record<string, string[]>;
  dependencies: string[];
  testFramework: string | null;
  buildTool: string | null;
  entryPoints: string[];
}