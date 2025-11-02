import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '../../src/types/InjectionTokens.js';
import { ProjectAnalyzer } from '../../src/services/ProjectAnalyzer.js';
import type { IProjectAnalyzer } from '../../src/interfaces/IProjectAnalyzer.js';
import type { IFileSystem } from '@chasenocap/file-system';
import { createLogger } from '@chasenocap/logger';

describe('ProjectAnalyzer', () => {
  let analyzer: IProjectAnalyzer;
  let mockFileSystem: IFileSystem;
  let container: Container;

  beforeEach(() => {
    container = new Container();
    
    // Create mock file system
    mockFileSystem = {
      readFile: vi.fn().mockResolvedValue('{}'),
      writeFile: vi.fn().mockResolvedValue(undefined),
      deleteFile: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
      createDirectory: vi.fn().mockResolvedValue(undefined),
      removeDirectory: vi.fn().mockResolvedValue(undefined),
      listDirectory: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
        isFile: true,
        isDirectory: false
      }),
      isFile: vi.fn().mockResolvedValue(true),
      isDirectory: vi.fn().mockResolvedValue(false),
      join: (...paths: string[]) => paths.join('/'),
      resolve: (...paths: string[]) => paths.join('/'),
      dirname: (path: string) => path.substring(0, path.lastIndexOf('/')),
      basename: (path: string) => path.substring(path.lastIndexOf('/') + 1),
      relative: (from: string, to: string) => to,
      normalize: (path: string) => path
    };

    const logger = createLogger('test');
    
    container.bind(TYPES.IFileSystem).toConstantValue(mockFileSystem);
    container.bind(TYPES.ILogger).toConstantValue(logger);
    container.bind(TYPES.IProjectAnalyzer).to(ProjectAnalyzer);
    
    analyzer = container.get(TYPES.IProjectAnalyzer);
  });

  describe('analyzeProject', () => {
    it('should analyze a project directory', async () => {
      const result = await analyzer.analyzeProject('/test/project');
      
      expect(result).toBeDefined();
      expect(result.type).toBeDefined();
      expect(result.languages).toBeInstanceOf(Array);
      expect(result.structure).toBeDefined();
      expect(result.dependencies).toBeInstanceOf(Array);
    });
  });

  describe('detectProjectType', () => {
    it('should detect Node.js projects', async () => {
      vi.mocked(mockFileSystem.exists).mockImplementation(async (path) => {
        return path.includes('package.json');
      });
      
      const type = await analyzer.detectProjectType('/test/project');
      expect(type).toBe('library');
    });

    it('should detect unknown project type', async () => {
      vi.mocked(mockFileSystem.exists).mockResolvedValue(false);
      
      const type = await analyzer.detectProjectType('/test/project');
      expect(type).toBe('unknown');
    });
  });
});