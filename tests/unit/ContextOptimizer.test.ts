import { describe, it, expect, beforeEach } from 'vitest';
import { Container } from 'inversify';
import { TYPES } from '../../src/types/InjectionTokens.js';
import { ContextOptimizer } from '../../src/services/ContextOptimizer.js';
import type { IContextOptimizer } from '../../src/interfaces/IContextOptimizer.js';
import { createLogger } from '@chasenocap/logger';

describe('ContextOptimizer', () => {
  let optimizer: IContextOptimizer;
  let container: Container;

  beforeEach(() => {
    container = new Container();
    
    const logger = createLogger('test');
    container.bind(TYPES.ILogger).toConstantValue(logger);
    container.bind(TYPES.IContextOptimizer).to(ContextOptimizer);
    
    optimizer = container.get(TYPES.IContextOptimizer);
  });

  describe('estimateTokenCount', () => {
    it('should estimate token count for content', () => {
      const content = 'This is a test content for token estimation';
      const tokens = optimizer.estimateTokenCount(content);
      
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(content.length); // Should be roughly 1/4 of characters
    });

    it('should handle empty content', () => {
      const tokens = optimizer.estimateTokenCount('');
      expect(tokens).toBe(0);
    });
  });

  describe('optimizeContext', () => {
    it('should optimize content with summarize strategy', async () => {
      const content = 'This is a long content that needs to be optimized for token limits';
      const result = await optimizer.optimizeContext(content, 'summarize', 50);
      
      expect(result).toBeDefined();
      expect(result.originalContent).toBe(content);
      expect(result.optimizedContent).toBeDefined();
      expect(result.optimizedTokens).toBeLessThanOrEqual(50);
      expect(result.strategy).toBe('summarize');
    });

    it('should optimize content with selective strategy', async () => {
      const content = 'Important content. Less important content. Critical content.';
      const result = await optimizer.optimizeContext(content, 'selective', 30);
      
      expect(result).toBeDefined();
      expect(result.strategy).toBe('selective');
      expect(result.reduction).toBeGreaterThanOrEqual(0);
    });

    it('should optimize content with compress strategy', async () => {
      const content = '  This   has   extra   spaces   \n\n\n   and   newlines   ';
      const result = await optimizer.optimizeContext(content, 'compress');
      
      expect(result).toBeDefined();
      expect(result.optimizedContent.length).toBeLessThan(content.length);
      expect(result.strategy).toBe('compress');
    });
  });

  describe('chunkContext', () => {
    it('should chunk content into smaller pieces', async () => {
      // Create a longer content that will definitely need multiple chunks
      const lines = Array.from({ length: 50 }, (_, i) => `This is line ${i + 1} with some content to make it longer`);
      const content = lines.join('\n');
      
      const chunks = await optimizer.chunkContext(content, 100); // Small chunk size to force multiple chunks
      
      expect(chunks).toBeInstanceOf(Array);
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.index).toBeDefined();
        expect(chunk.tokenCount).toBeGreaterThan(0);
        expect(chunk.metadata).toBeDefined();
      });
    });
  });

  describe('getTokenInfo', () => {
    it('should provide detailed token information', async () => {
      const content = `
        // This is a code comment
        function test() {
          return "hello";
        }
        
        # Documentation
        This is some documentation text.
      `;
      
      const info = await optimizer.getTokenInfo(content);
      
      expect(info.totalTokens).toBeGreaterThan(0);
      expect(info.breakdown).toBeDefined();
      expect(info.estimatedCost).toBeGreaterThanOrEqual(0);
      expect(info.withinLimit).toBeDefined();
    });
  });
});