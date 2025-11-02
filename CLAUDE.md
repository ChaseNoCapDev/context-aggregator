# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the context-aggregator package.

## Decomposition Principles

**IMPORTANT**: This package follows strict decomposition principles. See `/docs/decomposition-principles.md` for the complete guide.

### Key Principles Applied to context-aggregator:
1. **Single Purpose**: Analyzes and optimizes file system contexts for AI consumption
2. **Clear Boundaries**: The name clearly indicates it aggregates context from various sources
3. **Size Limits**: Target < 1000 lines, focusing on core aggregation logic
4. **Dependency Direction**: Mid-level package depending on file-system, cache, and logger
5. **Test in Isolation**: Can be tested with mock file systems and caches

### Package-Specific Considerations:
- This package DOES analyze project structures and detect patterns
- This package DOES NOT execute code or modify files
- This package DOES NOT handle prompt construction (that's prompt-toolkit's job)
- Create a new package if you need code execution or AST analysis

## Package Identity

**Name**: context-aggregator  
**Purpose**: Intelligently analyzes and optimizes file system contexts for token-limited AI consumption  
**Status**: Development  
**Owner**: metaGOTHIC Team  
**Created**: January 2025  
**Size**: Small  
**Complexity**: Medium  

## Single Responsibility

This package is responsible for:
Analyzing project structures and loading optimized context based on relevance and token constraints

This package is NOT responsible for:
- Constructing prompts or templates
- Executing code or running analysis tools
- Managing AI model interactions
- Handling authentication or API calls

## Package Context in Monorepo

### Documentation Context

**IMPORTANT**: Before developing in this package, understand the broader context:

1. **Project Documentation Map**
   - `/CLAUDE.md` - Main project context and goals
   - `/docs/architecture-reference.md` - Overall architecture patterns
   - `/docs/decomposition-guide.md` - Package design philosophy
   - `/docs/prompt-optimization-patterns.md` - Token optimization strategies

2. **Context Boundaries**
   - This package provides context analysis and optimization
   - Works with prompt-toolkit for prompt construction
   - Uses file-system for file operations
   - Uses cache for performance optimization

3. **Key Context to Inherit**
   - TypeScript + DI patterns
   - Token optimization strategies
   - Progressive loading patterns
   - Caching best practices

4. **What NOT to Include**
   - AI model-specific logic
   - Prompt template management
   - Code execution capabilities
   - Authentication mechanisms

### Upstream Dependencies
- @chasenocap/file-system (for file operations)
- @chasenocap/cache (for caching)
- @chasenocap/logger (for logging)
- @chasenocap/di-framework (for DI)

### Downstream Consumers
- @chasenocap/prompt-toolkit (uses context for prompts)
- metaGOTHIC applications
- AI-assisted development tools

### Position in Architecture
Mid-level utility package that bridges file system analysis with AI context needs

## Technical Architecture

### Core Interfaces
```typescript
export interface IContextAggregator {
  analyzeProject(options?: IAnalysisOptions): Promise<IProjectAnalysis>;
  loadContext(options: ILoadOptions): Promise<ILoadedContext>;
  optimizeContext(options: IOptimizeOptions): Promise<IOptimizedContext>;
  chunkContext(options: IChunkOptions): Promise<IContextChunk[]>;
  getRelevantFiles(query: string, options?: IRelevanceOptions): Promise<IRelevantFile[]>;
}

export interface IProjectAnalyzer {
  analyze(projectRoot: string): Promise<IProjectAnalysis>;
  detectFrameworks(files: string[]): IFramework[];
  calculateComplexity(analysis: IProjectAnalysis): number;
}

export interface IContextOptimizer {
  optimize(content: string, maxTokens: number): Promise<string>;
  calculateTokens(content: string): number;
  chunk(content: string, chunkSize: number): string[];
}

export interface IRelevanceScorer {
  score(file: string, query: string): number;
  rank(files: string[], query: string): IScoredFile[];
}
```

### Design Patterns
- **Strategy Pattern**: Different loading strategies (progressive, focused, breadth-first)
- **Cache-Aside**: Automatic caching of analysis results
- **Factory Pattern**: Context aggregator creation with options
- **Observer Pattern**: Progress callbacks for long operations

### Key Technologies
- TypeScript (strict mode)
- Inversify (DI)
- glob (file pattern matching)
- js-yaml (configuration parsing)

## Development Guidelines

### Code Organization
```
src/
├── interfaces/
│   ├── IContextAggregator.ts
│   ├── IProjectAnalyzer.ts
│   ├── IContextOptimizer.ts
│   └── IRelevanceScorer.ts
├── implementations/
│   ├── ContextAggregator.ts
│   ├── ProjectAnalyzer.ts
│   ├── ContextOptimizer.ts
│   └── RelevanceScorer.ts
├── strategies/
│   ├── ProgressiveLoadingStrategy.ts
│   ├── FocusedLoadingStrategy.ts
│   └── BreadthFirstLoadingStrategy.ts
├── types/
│   ├── ContextTypes.ts
│   └── InjectionTokens.ts
├── utils/
│   └── ContextContainer.ts
└── index.ts
```

### Naming Conventions
- Interfaces: `IContextAggregator`, `IProjectAnalyzer`
- Implementations: `ContextAggregator`, `ProjectAnalyzer`
- Strategies: `ProgressiveLoadingStrategy`
- Types: `LoadedContext`, `ProjectAnalysis`

### Testing Requirements
- Minimum 90% coverage
- Unit tests for each strategy
- Integration tests with mock file system
- Performance tests for large projects
- Token calculation accuracy tests

## Common Tasks

### Adding a New Loading Strategy
1. Create strategy class implementing `ILoadingStrategy`
2. Add strategy to factory in `ContextAggregator`
3. Write unit tests for the strategy
4. Update README with usage examples

### Optimizing Token Usage
1. Use `IContextOptimizer` for content reduction
2. Apply relevance scoring before loading
3. Use chunking for large contexts
4. Cache optimized results

### Debugging Context Issues
1. Enable debug logging for relevance scores
2. Use `analyzeProject` to understand structure
3. Check cache hits/misses
4. Validate token calculations

## API Patterns

### Factory Creation
```typescript
export async function createContextAggregator(
  options: IContextAggregatorOptions
): Promise<IContextAggregator> {
  const container = await createContextContainer(options);
  return container.get<IContextAggregator>(TOKENS.IContextAggregator);
}
```

### Progressive Loading
```typescript
const context = await aggregator.loadContext({
  query: 'authentication middleware',
  strategy: 'progressive',
  maxTokens: 8000,
  relevanceThreshold: 0.7
});
```

### Token Optimization
```typescript
const optimized = await aggregator.optimizeContext({
  files: ['src/**/*.ts'],
  maxTokens: 4000,
  technique: 'selective',
  preserveStructure: true
});
```

## Integration Examples

### With Prompt Toolkit
```typescript
import { createContextAggregator } from '@chasenocap/context-aggregator';
import { createPromptToolkit } from '@chasenocap/prompt-toolkit';

const aggregator = await createContextAggregator({ projectRoot: '.' });
const context = await aggregator.loadContext({
  query: 'implement feature X',
  maxTokens: 6000
});

const promptKit = await createPromptToolkit();
const prompt = await promptKit.constructPrompt({
  template: 'feature-implementation',
  variables: { context: context.content }
});
```

### With Cache Package
```typescript
// Automatic caching integration
const aggregator = await createContextAggregator({
  projectRoot: '.',
  cache: { type: 'hybrid', ttl: 3600000 }
});

// Cached automatically
const analysis1 = await aggregator.analyzeProject();
const analysis2 = await aggregator.analyzeProject(); // From cache
```

## Performance Considerations
- Cache project analysis results (expensive operation)
- Use relevance scoring to limit file loading
- Chunk large contexts for streaming
- Implement progress callbacks for UI feedback
- Consider memory usage for large projects

## Security Considerations
- Never include sensitive files (.env, secrets)
- Respect .gitignore patterns
- Sanitize file paths
- Validate project boundaries
- No code execution capabilities

## Known Issues
- Large monorepos may require chunking strategies
- Binary files are automatically excluded
- Token calculations are estimates

## Future Enhancements
- AST-based relevance scoring
- Semantic code analysis
- Multi-language support improvements
- Streaming context loading
- Context diffing for updates

## Maintenance Notes
- Update token calculation as models change
- Monitor cache performance
- Keep framework detection current
- Review relevance algorithms periodically

## Questions to Ask When Developing
1. Is this about context analysis and optimization?
2. Am I keeping token limits in mind?
3. Is caching being used effectively?
4. Are relevance scores accurate?
5. Is the loading strategy appropriate?
6. Can large projects be handled?
7. Are security boundaries respected?
8. Is the API simple to use?

## Related Documentation
- Main monorepo: `/CLAUDE.md`
- Architecture: `/docs/architecture-reference.md`
- Token optimization: `/docs/prompt-optimization-patterns.md`
- Prompt toolkit: `/packages/prompt-toolkit/CLAUDE.md`