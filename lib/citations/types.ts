/**
 * Citation search types and configuration
 */
import { Citation } from "../types";

// Configuration constants
export const CITATION_CONFIG = {
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
} as const;

// Search options
export type CitationSearchProvider = "openalex" | "semantic_scholar" | "both";
export type CitationDirection = "backward" | "forward" | "both";

export interface CitationSearchOptions {
  provider: CitationSearchProvider;
  direction: CitationDirection;
}

// Input types
export interface CitationSearchInput {
  id: string;
  openalex_id?: string;
  s2_id?: string;
  doi?: string;
  pmid?: string;
  title?: string;
}

// API response types for OpenAlex
export interface OpenAlexCitationResponse {
  meta: {
    count: number;
    page: number;
    per_page: number;
  };
  results: {
    id: string;
    doi?: string;
    ids: {
      openalex: string;
      doi?: string;
      pmid?: string;
      pmcid: string | null;
      mag: string | null;
    };
    title: string | null;
    publication_year: number | null;
    type?: string;
    authorships: {
      author?: {
        display_name: string | null;
      };
    }[];
    primary_location?: {
      source?: {
        display_name?: string;
      };
      is_oa: boolean;
      pdf_url?: string;
      landing_page_url?: string;
    };
    biblio?: {
      volume: string | null;
      issue: string | null;
      first_page: string | null;
      last_page: string | null;
    };
    referenced_works?: string[];
  }[];
}

// API response types for Semantic Scholar
export interface SemanticScholarCitation {
  paperId: string;
  externalIds: {
    DOI?: string;
    PubMed?: string;
    PubMedCentral?: string;
  };
  title: string;
  abstract: string | null;
  year: number;
  openAccessPdf?: {
    url?: string | null;
    status?: string | null;
  };
  authors: {
    name: string;
    authorId: string;
  }[];
  publicationTypes: string[];
  journal?: {
    volume?: string;
    pages?: string;
    name?: string;
  };
}

export interface SemanticScholarPaper {
  paperId: string;
  externalIds: {
    DOI?: string;
    PubMed?: string;
    PubMedCentral?: string;
  };
  abstract?: string | null;
  citations: SemanticScholarCitation[];
  references: SemanticScholarCitation[];
}

// Result types
export interface CitationSearchResults {
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
      openalex: {
        backward: number;
        forward: number;
      };
      semanticScholar: {
        backward: number;
        forward: number;
      };
    };
  };
}

// Processing context
export interface CitationProcessingContext {
  searchInputs: CitationSearchInput[];
  options: CitationSearchOptions;
  backwardCitations: Map<string, Citation>;
  forwardCitations: Map<string, Citation>;
  processedIds: Set<string>;
  abstractsMap: Map<string, string>; // DOI -> abstract mapping from S2
  statistics: {
    sources: {
      openalex: {
        backward: number;
        forward: number;
      };
      semanticScholar: {
        backward: number;
        forward: number;
      };
    };
    backwardProviderOverlap: number; // Track provider duplicates for backward
    forwardProviderOverlap: number; // Track provider duplicates for forward
  };
}
