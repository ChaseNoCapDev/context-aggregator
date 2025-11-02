import { injectable, inject } from 'inversify';
import type { IFileSystem } from '@chasenocap/file-system';
import type { ILogger } from '@chasenocap/logger';
import { TYPES } from '../types/InjectionTokens.js';
import type { IProjectAnalyzer, ProjectType, ProjectInfo, FrameworkInfo } from '../interfaces/IProjectAnalyzer.js';
import path from 'path';

/**
 * ProjectAnalyzer implementation
 * Analyzes project structure and detects frameworks, languages, and patterns
 */
@injectable()
export class ProjectAnalyzer implements IProjectAnalyzer {
  private readonly frameworkPatterns: Map<string, FrameworkInfo>;

  constructor(
    @inject(TYPES.IFileSystem) private fileSystem: IFileSystem,
    @inject(TYPES.ILogger) private logger: ILogger
  ) {
    this.frameworkPatterns = this.initializeFrameworkPatterns();
  }

  /**
   * Analyze a project directory and return comprehensive information
   */
  async analyzeProject(projectPath: string): Promise<ProjectInfo> {
    this.logger.info('Analyzing project', { projectPath });

    try {
      const [
        projectType,
        framework,
        languages,
        structure,
        dependencies,
        testFramework,
        buildTool
      ] = await Promise.all([
        this.detectProjectType(projectPath),
        this.detectFramework(projectPath),
        this.detectLanguages(projectPath),
        this.analyzeStructure(projectPath),
        this.extractDependencies(projectPath),
        this.detectTestFramework(projectPath),
        this.detectBuildTool(projectPath)
      ]);

      const entryPoints = await this.findEntryPoints(projectPath, projectType, framework);

      const projectInfo: ProjectInfo = {
        type: projectType,
        framework,
        languages,
        structure,
        dependencies,
        testFramework,
        buildTool,
        entryPoints
      };

      this.logger.info('Project analysis complete', {
        type: projectType,
        framework: framework?.name,
        languages: languages.length
      });

      return projectInfo;
    } catch (error) {
      this.logger.error('Failed to analyze project', error as Error);
      throw error;
    }
  }

  /**
   * Detect the primary project type
   */
  async detectProjectType(projectPath: string): Promise<ProjectType> {
    // Check for package.json (Node.js)
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'package.json'))) {
      const packageJson = await this.readJsonFile(this.fileSystem.join(projectPath, 'package.json'));
      
      // Check if it's a monorepo
      if (packageJson.workspaces || await this.fileSystem.exists(this.fileSystem.join(projectPath, 'lerna.json'))) {
        return 'monorepo';
      }
      
      // Check for specific project types
      if (packageJson.dependencies?.['react'] || packageJson.dependencies?.['react-dom']) {
        return 'web';
      }
      
      if (packageJson.dependencies?.['express'] || packageJson.dependencies?.['fastify']) {
        return 'api';
      }
      
      return 'library';
    }

    // Check for Python projects
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'setup.py')) ||
        await this.fileSystem.exists(this.fileSystem.join(projectPath, 'pyproject.toml'))) {
      return 'library';
    }

    // Check for Go projects
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'go.mod'))) {
      return 'library';
    }

    // Check for Rust projects
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'Cargo.toml'))) {
      return 'library';
    }

    return 'unknown';
  }

  /**
   * Detect the framework being used
   */
  async detectFramework(projectPath: string): Promise<FrameworkInfo | null> {
    for (const [name, info] of this.frameworkPatterns) {
      const isMatch = await this.checkFrameworkPattern(projectPath, info);
      if (isMatch) {
        return { name, ...info };
      }
    }
    return null;
  }

  /**
   * Detect programming languages used in the project
   */
  async detectLanguages(projectPath: string): Promise<string[]> {
    const languages = new Set<string>();
    const extensions = new Map<string, string>([
      ['.ts', 'TypeScript'],
      ['.tsx', 'TypeScript'],
      ['.js', 'JavaScript'],
      ['.jsx', 'JavaScript'],
      ['.py', 'Python'],
      ['.go', 'Go'],
      ['.rs', 'Rust'],
      ['.java', 'Java'],
      ['.cpp', 'C++'],
      ['.c', 'C'],
      ['.cs', 'C#'],
      ['.rb', 'Ruby'],
      ['.php', 'PHP'],
      ['.swift', 'Swift'],
      ['.kt', 'Kotlin']
    ]);

    await this.walkDirectory(projectPath, async (filePath: string) => {
      const ext = path.extname(filePath);
      const language = extensions.get(ext);
      if (language) {
        languages.add(language);
      }
    });

    return Array.from(languages);
  }

  /**
   * Analyze the project structure
   */
  async analyzeStructure(projectPath: string): Promise<Record<string, string[]>> {
    const structure: Record<string, string[]> = {
      srcDirs: [],
      testDirs: [],
      configFiles: [],
      docsDirs: [],
      staticDirs: []
    };

    const entries = await this.fileSystem.listDirectory(projectPath);

    for (const entry of entries) {
      const fullPath = this.fileSystem.join(projectPath, entry);
      const isDir = await this.fileSystem.isDirectory(fullPath);

      if (isDir) {
        // Source directories
        if (/^(src|lib|app|source)$/i.test(entry)) {
          structure.srcDirs.push(entry);
        }
        // Test directories
        else if (/^(test|tests|spec|specs|__tests__)$/i.test(entry)) {
          structure.testDirs.push(entry);
        }
        // Documentation directories
        else if (/^(docs|documentation)$/i.test(entry)) {
          structure.docsDirs.push(entry);
        }
        // Static asset directories
        else if (/^(static|public|assets|dist|build)$/i.test(entry)) {
          structure.staticDirs.push(entry);
        }
      } else {
        // Configuration files
        if (/\.(json|yaml|yml|toml|ini|conf|config\.(js|ts))$/.test(entry)) {
          structure.configFiles.push(entry);
        }
      }
    }

    return structure;
  }

  /**
   * Extract project dependencies
   */
  async extractDependencies(projectPath: string): Promise<string[]> {
    const dependencies: string[] = [];

    // Node.js dependencies
    const packageJsonPath = this.fileSystem.join(projectPath, 'package.json');
    if (await this.fileSystem.exists(packageJsonPath)) {
      const packageJson = await this.readJsonFile(packageJsonPath);
      if (packageJson.dependencies) {
        dependencies.push(...Object.keys(packageJson.dependencies));
      }
      if (packageJson.devDependencies) {
        dependencies.push(...Object.keys(packageJson.devDependencies));
      }
    }

    // Python dependencies
    const requirementsPath = this.fileSystem.join(projectPath, 'requirements.txt');
    if (await this.fileSystem.exists(requirementsPath)) {
      const content = await this.fileSystem.readFile(requirementsPath);
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      dependencies.push(...lines.map(line => line.split(/[<>=]/)[0].trim()));
    }

    // Go dependencies
    const goModPath = this.fileSystem.join(projectPath, 'go.mod');
    if (await this.fileSystem.exists(goModPath)) {
      const content = await this.fileSystem.readFile(goModPath);
      const requireRegex = /require\s+\(([\s\S]*?)\)/g;
      const match = requireRegex.exec(content);
      if (match) {
        const deps = match[1].split('\n')
          .filter(line => line.trim())
          .map(line => line.trim().split(/\s+/)[0]);
        dependencies.push(...deps);
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Detect test framework
   */
  async detectTestFramework(projectPath: string): Promise<string | null> {
    const packageJsonPath = this.fileSystem.join(projectPath, 'package.json');
    if (await this.fileSystem.exists(packageJsonPath)) {
      const packageJson = await this.readJsonFile(packageJsonPath);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      // Check for common test frameworks
      if (allDeps['jest']) return 'jest';
      if (allDeps['mocha']) return 'mocha';
      if (allDeps['vitest']) return 'vitest';
      if (allDeps['jasmine']) return 'jasmine';
      if (allDeps['ava']) return 'ava';
      if (allDeps['tape']) return 'tape';
      if (allDeps['@playwright/test']) return 'playwright';
      if (allDeps['cypress']) return 'cypress';
    }

    // Python test frameworks
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'pytest.ini')) ||
        await this.fileSystem.exists(this.fileSystem.join(projectPath, 'conftest.py'))) {
      return 'pytest';
    }

    return null;
  }

  /**
   * Detect build tool
   */
  async detectBuildTool(projectPath: string): Promise<string | null> {
    // JavaScript/TypeScript build tools
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'webpack.config.js'))) return 'webpack';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'rollup.config.js'))) return 'rollup';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'vite.config.js')) ||
        await this.fileSystem.exists(this.fileSystem.join(projectPath, 'vite.config.ts'))) return 'vite';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'esbuild.config.js'))) return 'esbuild';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'parcel.json'))) return 'parcel';

    // Other build tools
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'Makefile'))) return 'make';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'build.gradle'))) return 'gradle';
    if (await this.fileSystem.exists(this.fileSystem.join(projectPath, 'pom.xml'))) return 'maven';

    return null;
  }

  /**
   * Find project entry points
   */
  async findEntryPoints(
    projectPath: string,
    projectType: ProjectType,
    framework: FrameworkInfo | null
  ): Promise<string[]> {
    const entryPoints: string[] = [];

    // Common entry point patterns
    const patterns = [
      'index.js', 'index.ts', 'main.js', 'main.ts',
      'app.js', 'app.ts', 'server.js', 'server.ts',
      'src/index.js', 'src/index.ts', 'src/main.js', 'src/main.ts',
      'src/app.js', 'src/app.ts', 'src/server.js', 'src/server.ts'
    ];

    // Framework-specific entry points
    if (framework?.name === 'Next.js') {
      patterns.push('pages/_app.js', 'pages/_app.tsx', 'app/layout.tsx');
    } else if (framework?.name === 'Gatsby') {
      patterns.push('gatsby-node.js', 'gatsby-config.js');
    }

    for (const pattern of patterns) {
      const fullPath = this.fileSystem.join(projectPath, pattern);
      if (await this.fileSystem.exists(fullPath)) {
        entryPoints.push(pattern);
      }
    }

    // Check package.json main field
    const packageJsonPath = this.fileSystem.join(projectPath, 'package.json');
    if (await this.fileSystem.exists(packageJsonPath)) {
      const packageJson = await this.readJsonFile(packageJsonPath);
      if (packageJson.main) {
        entryPoints.push(packageJson.main);
      }
    }

    return [...new Set(entryPoints)];
  }

  /**
   * Initialize framework detection patterns
   */
  private initializeFrameworkPatterns(): Map<string, FrameworkInfo> {
    const patterns = new Map<string, FrameworkInfo>();

    patterns.set('React', {
      name: 'React',
      files: ['package.json'],
      patterns: ['react'],
      configFiles: []
    });

    patterns.set('Next.js', {
      name: 'Next.js',
      files: ['next.config.js', 'next.config.ts'],
      patterns: ['next'],
      configFiles: ['next.config.js', 'next.config.ts']
    });

    patterns.set('Vue', {
      name: 'Vue',
      files: ['vue.config.js'],
      patterns: ['vue'],
      configFiles: ['vue.config.js']
    });

    patterns.set('Angular', {
      name: 'Angular',
      files: ['angular.json'],
      patterns: ['@angular/core'],
      configFiles: ['angular.json']
    });

    patterns.set('Express', {
      name: 'Express',
      files: ['package.json'],
      patterns: ['express'],
      configFiles: []
    });

    patterns.set('Fastify', {
      name: 'Fastify',
      files: ['package.json'],
      patterns: ['fastify'],
      configFiles: []
    });

    patterns.set('NestJS', {
      name: 'NestJS',
      files: ['nest-cli.json'],
      patterns: ['@nestjs/core'],
      configFiles: ['nest-cli.json']
    });

    return patterns;
  }

  /**
   * Check if a framework pattern matches
   */
  private async checkFrameworkPattern(projectPath: string, info: FrameworkInfo): Promise<boolean> {
    // Check for config files
    for (const file of info.files) {
      if (await this.fileSystem.exists(this.fileSystem.join(projectPath, file))) {
        return true;
      }
    }

    // Check package.json for patterns
    const packageJsonPath = this.fileSystem.join(projectPath, 'package.json');
    if (await this.fileSystem.exists(packageJsonPath)) {
      const packageJson = await this.readJsonFile(packageJsonPath);
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };

      for (const pattern of info.patterns) {
        if (Object.keys(allDeps).some(dep => dep.includes(pattern))) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Walk a directory recursively
   */
  private async walkDirectory(
    dir: string,
    callback: (filePath: string) => Promise<void>,
    depth = 0,
    maxDepth = 5
  ): Promise<void> {
    if (depth > maxDepth) return;

    try {
      const entries = await this.fileSystem.listDirectory(dir);

      for (const entry of entries) {
        // Skip common ignore patterns
        if (this.shouldIgnore(entry)) continue;

        const fullPath = this.fileSystem.join(dir, entry);
        const isDir = await this.fileSystem.isDirectory(fullPath);

        if (isDir) {
          await this.walkDirectory(fullPath, callback, depth + 1, maxDepth);
        } else {
          await callback(fullPath);
        }
      }
    } catch (error) {
      // Ignore permission errors
      if ((error as any).code !== 'EACCES') {
        throw error;
      }
    }
  }

  /**
   * Check if a file/directory should be ignored
   */
  private shouldIgnore(name: string): boolean {
    const ignorePatterns = [
      'node_modules', '.git', '.svn', '.hg',
      'dist', 'build', 'coverage', '.cache',
      '.next', '.nuxt', '.turbo', 'venv',
      '__pycache__', '.pytest_cache', '.mypy_cache'
    ];
    return ignorePatterns.includes(name);
  }

  /**
   * Read and parse a JSON file
   */
  private async readJsonFile(filePath: string): Promise<any> {
    try {
      const content = await this.fileSystem.readFile(filePath);
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}