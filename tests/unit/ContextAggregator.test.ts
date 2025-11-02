import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContextAggregator } from '../../src/index.js';
import type { IContextAggregator } from '../../src/index.js';

describe('ContextAggregator', () => {
  let aggregator: IContextAggregator;

  beforeEach(async () => {
    // Create context aggregator with test options
    aggregator = await createContextAggregator({
      projectRoot: '/test/project'
    });
  });

  describe('aggregateContext', () => {
    it('should aggregate context from a project', async () => {
      // For now, just verify the method exists
      expect(aggregator.aggregateContext).toBeDefined();
      expect(typeof aggregator.aggregateContext).toBe('function');
    });

    it('should support different loading strategies', async () => {
      const strategies = aggregator.getStrategies();
      expect(strategies).toContain('progressive');
      expect(strategies).toContain('focused');
      expect(strategies).toContain('breadth-first');
    });
  });

  describe('loadContext', () => {
    it('should load context with progressive strategy', async () => {
      expect(aggregator.loadContext).toBeDefined();
      // Would test actual loading with mock file system
    });
  });

  describe('optimizeContext', () => {
    it('should optimize context', async () => {
      expect(aggregator.optimizeContext).toBeDefined();
      // Would test actual optimization
    });
  });
});