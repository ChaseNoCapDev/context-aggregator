/**
 * @fileoverview Dependency injection container setup for context-aggregator
 */

import 'reflect-metadata';
import { Container } from 'inversify';
import { createLogger, type ILogger } from '@chasenocap/logger';
import { MemoryCache, type ICache } from '@chasenocap/cache';
import type { IFileSystem } from '@chasenocap/file-system';

import type { IContextAggregator } from '../interfaces/IContextAggregator.js';
import type { IProjectAnalyzer } from '../interfaces/IProjectAnalyzer.js';
import type { IContextOptimizer } from '../interfaces/IContextOptimizer.js';
import type { IRelevanceScorer } from '../interfaces/IRelevanceScorer.js';
import type { IContextAggregatorOptions } from '../types/ContextTypes.js';
import { TYPES } from '../types/InjectionTokens.js';

import { ContextAggregator } from '../services/ContextAggregator.js';
import { ProjectAnalyzer } from '../services/ProjectAnalyzer.js';
import { ContextOptimizer } from '../services/ContextOptimizer.js';
import { RelevanceScorer } from '../services/RelevanceScorer.js';
import { ProgressiveLoadingStrategy } from '../strategies/ProgressiveLoadingStrategy.js';
import { FocusedLoadingStrategy } from '../strategies/FocusedLoadingStrategy.js';
import { BreadthFirstLoadingStrategy } from '../strategies/BreadthFirstLoadingStrategy.js';

/**
 * Create and configure DI container
 */
export async function createContextContainer(
  options: IContextAggregatorOptions
): Promise<Container> {
  const container = new Container();

  // Bind external dependencies
  const logger = options.logger || createLogger('context-aggregator');
  container.bind<ILogger>(TYPES.ILogger).toConstantValue(logger);

  // For now, create a stub file system until we can import properly
  const fileSystem: IFileSystem = {
    readFile: async () => '',
    writeFile: async () => {},
    deleteFile: async () => {},
    exists: async () => false,
    createDirectory: async () => {},
    removeDirectory: async () => {},
    listDirectory: async () => [],
    getStats: async () => ({ size: 0, createdAt: new Date(), modifiedAt: new Date(), isFile: true, isDirectory: false }),
    isFile: async () => true,
    isDirectory: async () => false,
    join: (...paths) => paths.join('/'),
    resolve: (...paths) => paths.join('/'),
    dirname: (path) => path.substring(0, path.lastIndexOf('/')),
    basename: (path) => path.substring(path.lastIndexOf('/') + 1),
    relative: (from, to) => to,
    normalize: (path) => path
  };
  container.bind<IFileSystem>(TYPES.IFileSystem).toConstantValue(fileSystem);

  const cache = new MemoryCache();
  container.bind<ICache>(TYPES.ICache).toConstantValue(cache);

  // Bind configuration
  container.bind<string>(TYPES.IProjectRoot).toConstantValue(options.projectRoot);
  container.bind<IContextAggregatorOptions>(TYPES.IContextAggregatorOptions).toConstantValue(options);

  // Bind service implementations
  container.bind<IProjectAnalyzer>(TYPES.IProjectAnalyzer).to(ProjectAnalyzer).inSingletonScope();
  container.bind<IContextOptimizer>(TYPES.IContextOptimizer).to(ContextOptimizer).inSingletonScope();
  container.bind<IRelevanceScorer>(TYPES.IRelevanceScorer).to(RelevanceScorer).inSingletonScope();

  // Bind loading strategies
  container.bind<ProgressiveLoadingStrategy>(TYPES.ProgressiveLoadingStrategy)
    .to(ProgressiveLoadingStrategy).inSingletonScope();
  container.bind<FocusedLoadingStrategy>(TYPES.FocusedLoadingStrategy)
    .to(FocusedLoadingStrategy).inSingletonScope();
  container.bind<BreadthFirstLoadingStrategy>(TYPES.BreadthFirstLoadingStrategy)
    .to(BreadthFirstLoadingStrategy).inSingletonScope();

  // Bind main aggregator
  container.bind<IContextAggregator>(TYPES.IContextAggregator).to(ContextAggregator).inSingletonScope();

  return container;
}

/**
 * Factory function to create context aggregator
 */
export async function createContextAggregator(
  options: IContextAggregatorOptions
): Promise<IContextAggregator> {
  const container = await createContextContainer(options);
  return container.get<IContextAggregator>(TYPES.IContextAggregator);
}