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

## Loading Strategies

### Focused Loading Strategy

The **Focused Loading Strategy** is optimized for cloud/hosted environments where token limits and API costs are critical concerns. Unlike progressive loading (which loads incrementally) or breadth-first (which scans broadly), focused loading uses intelligent relevance scoring to load only the most pertinent context.

#### When to Use Focused Loading

**Cloud/Hosted Environments**:
- Working with Claude API (token limits: 200K input, cost per token)
- GitHub Copilot integration (context window constraints)
- CI/CD pipelines (minimize processing time and costs)
- Serverless functions (execution time limits)

**Use Cases**:
- Specific bug fix or feature implementation
- Code review with targeted scope
- Security audit of specific modules
- Performance optimization of particular code paths

**NOT Recommended For**:
- Full codebase exploration (use breadth-first)
- Learning new codebase structure (use progressive)
- Comprehensive refactoring (use progressive with chunking)

#### How Focused Loading Works

```typescript
const context = await aggregator.loadContext({
  query: 'authentication middleware JWT validation',
  strategy: 'focused',
  maxTokens: 8000,
  relevanceThreshold: 0.8, // Higher threshold = more focused
  options: {
    includeTests: false,    // Exclude tests for production code review
    includeDocs: true,      // Include relevant documentation
    maxDepth: 3            // Limit dependency traversal depth
  }
});
```

**Algorithm**:
1. **Parse Query**: Extract keywords and intent from query string
2. **Initial Scoring**: Score all files based on:
   - Filename/path relevance to query keywords
   - File type (prioritize source over tests/docs)
   - Recent modification (prioritize recently changed files)
   - Import/dependency relationships
3. **Top-N Selection**: Select top N files above relevance threshold
4. **Dependency Analysis**: Load direct dependencies of selected files (bounded by maxDepth)
5. **Token Budget**: Fill remaining token budget with next-highest scored files
6. **Optimization**: Apply content optimization if over budget

#### Relevance Scoring Details

Scores are calculated using weighted factors:

```typescript
interface IRelevanceFactors {
  keywordMatch: number;      // 40% weight - matches in filename/path
  contentMatch: number;      // 30% weight - matches in file content
  importanceScore: number;   // 20% weight - centrality in dep graph
  recencyScore: number;      // 10% weight - modification timestamp
}

// Final score: 0.0 (irrelevant) to 1.0 (highly relevant)
```

**Example Scores**:
- `src/auth/middleware/jwt-validator.ts` for query "JWT validation" → 0.95
- `src/auth/types.ts` (imported by jwt-validator) → 0.75
- `tests/auth/jwt.test.ts` → 0.60 (lower due to file type)
- `src/database/users.ts` → 0.35 (tangentially related)
- `src/ui/components/Button.tsx` → 0.05 (irrelevant)

#### Cloud Environment Optimization

**Token Budget Management**:
```typescript
const context = await aggregator.loadContext({
  query: 'fix authentication bug in JWT refresh',
  strategy: 'focused',
  maxTokens: 8000,           // Claude API: leave room for response
  strictMode: true,          // Throw error if budget exceeded
  options: {
    optimizationTechnique: 'aggressive', // More aggressive minification
    stripComments: true,                 // Remove comments
    stripWhitespace: true,               // Normalize whitespace
    collapseImports: true                // Consolidate import statements
  }
});
```

**Cost Optimization**:
- **Cache Aggressively**: Cache relevance scores and analysis (TTL: 1 hour)
- **Incremental Loading**: Load additional context only if needed
- **Batch Operations**: Group multiple queries to amortize analysis costs

```typescript
const aggregator = await createContextAggregator({
  projectRoot: '.',
  cache: {
    type: 'hybrid',           // In-memory + disk cache
    ttl: 3600000,            // 1 hour TTL
    persistToDisk: true      // Survive restarts
  }
});
```

**Performance Benchmarks** (1000-file TypeScript project):
- Progressive loading: ~2.5s, 45K tokens
- Breadth-first loading: ~3.2s, 78K tokens
- Focused loading: ~0.8s, 12K tokens (with query)

#### Best Practices for Cloud/Hosted Usage

1. **Start Focused, Expand if Needed**:
```typescript
// Initial focused load
let context = await aggregator.loadContext({
  query: initialQuery,
  strategy: 'focused',
  maxTokens: 8000
});

// If insufficient, expand with progressive
if (context.confidence < 0.7) {
  context = await aggregator.loadContext({
    query: initialQuery,
    strategy: 'progressive',
    maxTokens: 20000,
    seedFiles: context.files // Start from focused results
  });
}
```

2. **Use Relevance Threshold Wisely**:
   - High threshold (0.8-1.0): Very specific queries, known codebase
   - Medium threshold (0.6-0.8): General feature work
   - Low threshold (0.4-0.6): Exploratory work (better to use progressive)

3. **Monitor Token Usage**:
```typescript
const context = await aggregator.loadContext({
  query: 'implement user settings',
  strategy: 'focused',
  maxTokens: 8000,
  onProgress: (progress) => {
    console.log(`Loaded ${progress.tokensUsed}/${progress.maxTokens} tokens`);
    console.log(`Files: ${progress.filesLoaded}/${progress.filesScored}`);
  }
});
```

4. **Combine with Chunking for Large Codebases**:
```typescript
const chunks = await aggregator.chunkContext({
  query: 'API refactoring',
  strategy: 'focused',
  chunkSize: 6000,        // Leave room for system prompts
  overlapTokens: 500      // Context continuity between chunks
});

// Process chunks sequentially or in parallel
for (const chunk of chunks) {
  await processWithClaude(chunk);
}
```

#### Common Pitfalls

- **Query Too Vague**: "fix bug" → scores poorly, use "fix JWT refresh token bug"
- **Threshold Too High**: Missing important files, reduce to 0.6-0.7
- **Ignoring Dependencies**: Set `maxDepth: 0` → missing crucial context
- **Cache Disabled**: Repeated analysis is expensive, always enable caching

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