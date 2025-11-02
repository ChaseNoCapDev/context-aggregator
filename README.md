# @chasenocap/context-aggregator

[![npm version](https://img.shields.io/npm/v/@chasenocap/context-aggregator.svg)](https://www.npmjs.com/package/@chasenocap/context-aggregator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Test Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](./coverage)

Intelligent context management utilities for the metaGOTHIC framework. This package provides sophisticated context analysis, loading strategies, and token optimization for large-scale AI-assisted development workflows.

## Features

- **File System Context Analysis**: Analyze project structures to understand codebases
- **Project Type Detection**: Automatically detect frameworks, languages, and project patterns
- **Progressive Context Loading**: Load context incrementally based on relevance scoring
- **Token Optimization**: Chunk and summarize large contexts to fit within token limits
- **Context Caching**: Memory and disk-based caching for improved performance
- **Relevance Scoring**: Intelligent scoring algorithms to prioritize important context
- **Context Persistence**: Save and restore context states across sessions

## Installation

```bash
npm install @chasenocap/context-aggregator
```

## Usage

### Basic Context Analysis

```typescript
import { createContextAggregator } from '@chasenocap/context-aggregator';

const aggregator = await createContextAggregator({
  projectRoot: '/path/to/project',
  cacheDir: '.context-cache'
});

// Analyze project structure
const projectAnalysis = await aggregator.analyzeProject();
console.log('Project type:', projectAnalysis.type);
console.log('Detected frameworks:', projectAnalysis.frameworks);
console.log('Primary language:', projectAnalysis.primaryLanguage);
```

### Progressive Context Loading

```typescript
// Load context progressively based on relevance
const context = await aggregator.loadContext({
  query: 'implement authentication middleware',
  maxTokens: 8000,
  strategy: 'progressive'
});

console.log('Loaded files:', context.files.length);
console.log('Token count:', context.tokenCount);
console.log('Relevance score:', context.relevanceScore);
```

### Token Optimization

```typescript
// Optimize context to fit within token limits
const optimized = await aggregator.optimizeContext({
  files: ['src/auth/**/*.ts', 'src/middleware/**/*.ts'],
  maxTokens: 4000,
  preserveStructure: true
});

// Get chunked context for processing
const chunks = await aggregator.chunkContext({
  content: largeFileContent,
  chunkSize: 2000,
  overlap: 200
});
```

### Context Caching

```typescript
// Enable persistent caching
const aggregator = await createContextAggregator({
  projectRoot: '/path/to/project',
  cache: {
    type: 'hybrid', // memory + disk
    ttl: 3600000,   // 1 hour
    maxSize: 100    // MB
  }
});

// Cache will be used automatically
const context1 = await aggregator.loadContext({ query: 'database models' });
const context2 = await aggregator.loadContext({ query: 'database models' }); // From cache
```

### Advanced Project Analysis

```typescript
// Deep project analysis with dependency detection
const analysis = await aggregator.analyzeProject({
  deep: true,
  includeDependencies: true,
  includeTests: false
});

console.log('Dependencies:', analysis.dependencies);
console.log('File structure:', analysis.structure);
console.log('Complexity score:', analysis.complexity);
```

## API Reference

### `createContextAggregator(options)`

Creates a new context aggregator instance.

#### Options

- `projectRoot` (string): Root directory of the project to analyze
- `cacheDir` (string, optional): Directory for persistent cache
- `cache` (CacheOptions, optional): Cache configuration
  - `type`: 'memory' | 'disk' | 'hybrid'
  - `ttl`: Time to live in milliseconds
  - `maxSize`: Maximum cache size in MB
- `logger` (ILogger, optional): Custom logger instance

### `IContextAggregator`

Main interface for context aggregation operations.

#### Methods

##### `analyzeProject(options?): Promise<IProjectAnalysis>`

Analyzes the project structure and detects project type, frameworks, and patterns.

##### `loadContext(options): Promise<ILoadedContext>`

Loads context based on query and strategy.

##### `optimizeContext(options): Promise<IOptimizedContext>`

Optimizes context to fit within token limits.

##### `chunkContext(options): Promise<IContextChunk[]>`

Splits large context into manageable chunks.

##### `getRelevantFiles(query, options?): Promise<IRelevantFile[]>`

Gets files relevant to a specific query.

##### `calculateTokens(content): number`

Calculates token count for given content.

## Context Loading Strategies

### Progressive Loading

Loads context incrementally based on relevance scores:

```typescript
const context = await aggregator.loadContext({
  query: 'authentication flow',
  strategy: 'progressive',
  maxTokens: 8000,
  relevanceThreshold: 0.7
});
```

### Focused Loading

Loads context from specific paths:

```typescript
const context = await aggregator.loadContext({
  paths: ['src/auth', 'src/middleware'],
  strategy: 'focused',
  maxTokens: 6000
});
```

### Breadth-First Loading

Loads overview context from across the project:

```typescript
const context = await aggregator.loadContext({
  strategy: 'breadth-first',
  maxTokens: 10000,
  maxDepth: 3
});
```

## Token Optimization Techniques

### Summarization

```typescript
const optimized = await aggregator.optimizeContext({
  files: ['src/**/*.ts'],
  maxTokens: 4000,
  technique: 'summarize',
  preserveImports: true
});
```

### Selective Loading

```typescript
const optimized = await aggregator.optimizeContext({
  files: ['src/**/*.ts'],
  maxTokens: 4000,
  technique: 'selective',
  includePattern: /export|interface|class/
});
```

### Compression

```typescript
const optimized = await aggregator.optimizeContext({
  files: ['src/**/*.ts'],
  maxTokens: 4000,
  technique: 'compress',
  removeComments: true,
  removeWhitespace: true
});
```

## Integration with Other Packages

### With @chasenocap/prompt-toolkit

```typescript
import { createContextAggregator } from '@chasenocap/context-aggregator';
import { createPromptToolkit } from '@chasenocap/prompt-toolkit';

const aggregator = await createContextAggregator({ projectRoot: '.' });
const promptKit = await createPromptToolkit();

// Load relevant context
const context = await aggregator.loadContext({
  query: 'implement user authentication',
  maxTokens: 6000
});

// Construct prompt with context
const prompt = await promptKit.constructPrompt({
  template: 'feature-implementation',
  variables: {
    context: context.content,
    files: context.files.map(f => f.path),
    objective: 'implement user authentication'
  }
});
```

### With @chasenocap/cache

The context aggregator automatically uses the cache package for performance:

```typescript
// Context queries are automatically cached
const context1 = await aggregator.loadContext({ query: 'auth' }); // Cache miss
const context2 = await aggregator.loadContext({ query: 'auth' }); // Cache hit
```

## Configuration

### Environment Variables

- `CONTEXT_CACHE_DIR`: Default cache directory
- `CONTEXT_MAX_TOKENS`: Default maximum tokens
- `CONTEXT_CACHE_TTL`: Cache time-to-live in ms

### Configuration File

Create `.context-aggregator.json` in project root:

```json
{
  "cache": {
    "type": "hybrid",
    "ttl": 3600000,
    "maxSize": 100
  },
  "analysis": {
    "excludePatterns": ["node_modules", "dist", "coverage"],
    "includeHidden": false
  },
  "optimization": {
    "defaultTechnique": "selective",
    "preserveStructure": true
  }
}
```

## Contributing

See [CONTRIBUTING.md](https://github.com/ChaseNoCap/context-aggregator/blob/main/CONTRIBUTING.md) for contribution guidelines.

## License

MIT