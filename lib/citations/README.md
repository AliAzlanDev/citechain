# Citation Search Module

This module provides functionality to search for backward and forward citations using OpenAlex and Semantic Scholar APIs with advanced deduplication and enrichment capabilities.

## Features

- **Multi-API Support**: Search citations using OpenAlex, Semantic Scholar, or both
- **Bidirectional Search**: Find backward citations (references) and forward citations (citing papers)
- **Smart Deduplication**: Remove duplicates based on DOI, OpenAlex ID, S2 ID, PMID, or title
- **Abstract Enrichment**: Automatically enrich OpenAlex citations with abstracts from Semantic Scholar
- **Batch Processing**: Efficient handling of large citation sets with rate limiting
- **Comprehensive Results**: Detailed statistics and source information

## Module Architecture

The citation search module is organized into several focused files:

- **`index.ts`**: Main entry point with the `searchCitations()` function and utilities
- **`types.ts`**: Type definitions, interfaces, and configuration constants
- **`processors.ts`**: Core processing logic for deduplication and enrichment
- **`services.ts`**: API service functions for OpenAlex and Semantic Scholar
- **`README.md`**: This documentation file

The module follows a clean separation of concerns with proper error handling and logging throughout.

## Exports

The module exports the following functions and types:

### Functions

```typescript
// Main citation search function
export async function searchCitations(
  inputs: CitationSearchInput[],
  options: CitationSearchOptions
): Promise<CitationSearchResults>;

// Utility function to convert validation results to citation inputs
export function seedReferencesToCitationInputs(
  seedReferences: SeedReferencesResponse[]
): CitationSearchInput[];
```

### Types

```typescript
export type {
  CitationSearchOptions,
  CitationSearchInput,
  CitationSearchResults,
  CitationSearchProvider,
  CitationDirection,
};

// Configuration constant
export { CITATION_CONFIG };
```

### Usage Import

```typescript
import {
  searchCitations,
  seedReferencesToCitationInputs,
  CITATION_CONFIG,
  type CitationSearchOptions,
  type CitationSearchResults,
} from "./lib/citations";
```

## Usage

### Basic Citation Search

```typescript
import { searchCitations } from "./lib/citations";

const inputs = [
  {
    id: "paper1",
    openalex_id: "W2963487017",
    s2_id: "2963487017",
    doi: "10.1038/nature12373",
    title: "Example Paper Title",
  },
];

const results = await searchCitations(inputs, {
  provider: "both", // "openalex" | "semantic_scholar" | "both"
  direction: "both", // "backward" | "forward" | "both"
});

console.log(`Found ${results.backward.length} backward citations`);
console.log(`Found ${results.forward.length} forward citations`);
console.log(`Total unique citations: ${results.combined.length}`);
```

### Converting from Seed References

```typescript
import { seedReferencesToCitationInputs } from "./lib/citations";
import { validateSeedReferences } from "./lib/validation";

// First validate your references
const validatedRefs = await validateSeedReferences(seedReferences);

// Convert to citation search inputs
const citationInputs = seedReferencesToCitationInputs(validatedRefs.results);

// Search for citations
const citationResults = await searchCitations(citationInputs, {
  provider: "both",
  direction: "both",
});
```

## Data Structures

### Citation Object

```typescript
interface Citation {
  id: string;
  openalex_id?: string;
  s2_id?: string;
  doi?: string;
  pmid?: string;
  title: string;
  abstract?: string;
  year?: number;
  journal?: string;
  pages?: string;
  volume?: string;
  number?: string;
  authors?: string[];
  type?: string;
  open_access?: boolean;
  open_access_url?: string;
}
```

### Search Results

```typescript
interface CitationSearchResults {
  backward: Citation[];
  forward: Citation[];
  combined: Citation[];
  deduplication: {
    backwardProviderOverlap: number; // Citations found by both providers (backward)
    forwardProviderOverlap: number; // Citations found by both providers (forward)
    directionOverlap: number; // Citations appearing in both backward and forward
  };
  statistics: {
    totalBackward: number;
    totalForward: number;
    totalCombined: number;
    sources: {
      openalex: { backward: number; forward: number };
      semanticScholar: { backward: number; forward: number };
    };
  };
}
```

## API Provider Details

### OpenAlex

- **Backward Citations**: Uses `referenced_works` field to get referenced papers
- **Forward Citations**: Uses `cites:` filter to find papers that cite the input
- **Fields Retrieved**: ID, DOI, title, authors, year, journal, volume, pages, open access info
- **Pagination**: Automatically handles pagination for large result sets
- **Rate Limiting**: 10 requests per second with proper error handling

### Semantic Scholar

- **Backward Citations**: Uses `references` field from paper data
- **Forward Citations**: Uses `citations` field from paper data
- **Fields Retrieved**: All citation fields including abstracts
- **Abstract Enrichment**: Provides abstracts that OpenAlex lacks
- **Rate Limiting**: 1 request per second with batch processing

## Abstract Enrichment Process

The module includes sophisticated abstract enrichment capabilities:

### Automatic Enrichment

- When using "both" providers, Semantic Scholar abstracts automatically enrich OpenAlex citations
- Cross-referencing is done using DOI, S2 ID, and PMID matching
- Abstracts are stored in a map for efficient lookup and reuse

### Fallback Enrichment

- For OpenAlex-only searches, abstracts are fetched separately from Semantic Scholar
- Citations are grouped by identifier type (S2 ID, DOI) for batch processing
- Up to 400 citations are processed per batch to respect API limits

### Enrichment Strategy

```typescript
// 1. Try S2 ID first (most direct)
if (citation.s2_id) {
  const abstract = abstractsMap.get(citation.s2_id);
  if (abstract) return { ...citation, abstract };
}

// 2. Fall back to DOI matching
if (citation.doi) {
  const normalizedDoi = normalizeDoi(citation.doi);
  const abstract = abstractsMap.get(normalizedDoi);
  if (abstract) return { ...citation, abstract };
}
```

## Deduplication Strategy

The module uses a sophisticated deduplication strategy:

1. **Primary Key**: DOI (if available)
2. **Secondary Key**: OpenAlex ID
3. **Tertiary Key**: Semantic Scholar ID
4. **Quaternary Key**: PMID
5. **Fallback Key**: Normalized title

Duplicates are detected both within each direction (backward/forward) and between directions for the combined result.

## Processing Workflow

The citation search follows a structured processing workflow:

1. **Initialization**: Create processing context with input validation and configuration
2. **Provider Processing**:
   - Process OpenAlex citations (if selected)
   - Process Semantic Scholar citations (if selected)
   - Run providers in parallel for efficiency
3. **Deduplication**: Use sophisticated key generation to identify and merge duplicates
4. **Enrichment**: Enhance OpenAlex citations with abstracts from Semantic Scholar
5. **Result Extraction**: Generate final results with statistics and deduplication metrics

### Key Generation Strategy

Citations are deduplicated using a hierarchical key generation approach:

```typescript
function generateCitationKey(citation: Citation): string {
  // Primary: DOI (most reliable)
  if (citation.doi) return `doi:${normalizeDoi(citation.doi)}`;

  // Secondary: OpenAlex ID
  if (citation.openalex_id)
    return `openalex:${normalizeOpenAlexId(citation.openalex_id)}`;

  // Tertiary: Semantic Scholar ID
  if (citation.s2_id) return `s2:${citation.s2_id}`;

  // Quaternary: PMID
  if (citation.pmid) return `pmid:${citation.pmid}`;

  // Fallback: Normalized title
  return `title:${normalizeText(citation.title)}`;
}
```

## Error Handling

- **Network Errors**: Automatic retry with exponential backoff
- **Rate Limiting**: Built-in rate limiting with proper delays
- **API Failures**: Graceful degradation - continues with available providers
- **Data Validation**: Filters out incomplete or invalid citation records

## Configuration

```typescript
const CITATION_CONFIG = {
  BATCH_SIZES: {
    SEMANTIC_SCHOLAR: 20, // Smaller batch for 9999 citations limit
    OPENALEX: 50, // Smaller batch for citations
  },
  OPENALEX_FIELDS: [
    "id",
    "doi",
    "ids",
    "title",
    "publication_year",
    "type",
    "authorships",
    "primary_location",
    "biblio",
  ],
  SEMANTIC_SCHOLAR_FIELDS: [
    "externalIds",
    "citations.externalIds",
    "citations.abstract",
    "citations.title",
    "citations.year",
    "citations.authors",
    "citations.journal",
    "citations.publicationTypes",
    "citations.openAccessPdf",
    "references.externalIds",
    "references.abstract",
    "references.title",
    "references.year",
    "references.authors",
    "references.journal",
    "references.publicationTypes",
    "references.openAccessPdf",
  ],
};
```

## Performance Considerations

- **Optimized Batch Sizes**:
  - Semantic Scholar: 20 citations per batch (respects 9999 citation limit)
  - OpenAlex: 50 citations per batch for optimal throughput
- **Parallel Processing**: Multiple API calls are made in parallel where possible
- **Memory Efficient**: Uses Maps for deduplication to handle large citation sets efficiently
- **Smart Pagination**: OpenAlex forward citation search automatically handles pagination (up to 50 pages)
- **Rate Limiting**: Built-in rate limiting respects API constraints
- **Batch Enrichment**: Abstract enrichment processes up to 400 citations per batch
- **Graceful Failure**: Individual batch failures don't stop overall processing

## API Limitations and Considerations

### OpenAlex

- **Rate Limit**: 10 requests per second (handled automatically)
- **Pagination Limit**: Forward citation search limited to 50 pages to prevent infinite loops
- **Field Availability**: Some papers may lack certain fields (abstracts, authors, etc.)
- **ID Requirements**: Requires OpenAlex ID for citation search

### Semantic Scholar

- **Rate Limit**: 1 request per second (handled automatically)
- **Citation Limit**: Maximum 9999 citations per paper (hence smaller batch sizes)
- **Field Richness**: Generally provides more complete metadata including abstracts
- **ID Requirements**: Requires Semantic Scholar paper ID for citation search

### General Considerations

- **Network Failures**: Individual API failures don't stop the entire process
- **Data Quality**: Results are filtered to remove incomplete records
- **Memory Usage**: Large citation sets are processed efficiently using Maps
- **Processing Time**: Large input sets may take several minutes to process completely

## Data Transformation

The module includes robust data transformation functions to convert API responses to standardized Citation objects:

### OpenAlex Transformation

- Extracts and normalizes DOI, PMID, and OpenAlex IDs
- Combines first_page and last_page into page ranges
- Maps authorships to author names
- Determines open access status and URLs
- Handles missing or null fields gracefully

### Semantic Scholar Transformation

- Maps external IDs (DOI, PubMed, etc.) to citation fields
- Extracts journal information (name, volume, pages)
- Processes author arrays into name lists
- Handles publication types and open access PDFs
- Stores abstracts in the abstracts map for enrichment

### Data Normalization

All identifiers are normalized using utility functions:

- DOIs are cleaned and standardized
- OpenAlex IDs are normalized to consistent format
- PMIDs are properly formatted
- Titles are normalized for deduplication matching

## Integration with Validation Module

The citation search module is designed to work seamlessly with the validation module:

```typescript
// Complete workflow
const validatedRefs = await validateSeedReferences(seedReferences);
const citationInputs = seedReferencesToCitationInputs(validatedRefs.results);
const citationResults = await searchCitations(citationInputs, {
  provider: "both",
  direction: "both",
});

// Store results using the store's setCitationResults method
setCitationResults(citationResults);

// Or set individual components
setBackward(citationResults.backward);
setForward(citationResults.forward);
setCombined(citationResults.combined);
setDeduplication(citationResults.deduplication);
```
