/**
 * Simplified validation types and configuration
 */
import { Identifiers } from "../types";

// Configuration constants
export const VALIDATION_CONFIG = {
  IDENTIFIER_TYPES: [
    "doi",
    "pmid",
    "pmcid",
    "openalex",
    "mag",
  ] as Identifiers[],
  BATCH_SIZES: {
    SEMANTIC_SCHOLAR: 500,
    OPENALEX: 100,
    TITLE: 10,
  },
  OPENALEX_FIELDS: [
    "id",
    "doi",
    "title",
    "ids",
    "publication_year",
    "primary_location",
  ],
  SEMANTIC_SCHOLAR_FIELDS: [
    "externalIds",
    "paperId",
    "title",
    "year",
    "journal",
  ],
} as const;

// API response types
export interface OpenAlexResponse {
  results: OpenAlexWork[];
  meta: {
    count: number;
    page: number;
    per_page: number;
  };
}

export interface OpenAlexWork {
  id: string;
  doi?: string;
  title: string;
  publication_year: number;
  ids?: {
    doi?: string;
    pmid?: string;
    pmcid?: string;
    openalex?: string;
    mag?: string;
  };
  primary_location?: {
    source?: {
      display_name?: string;
    };
  };
}

export interface SemanticScholarPaper {
  paperId: string;
  title: string;
  year?: number;
  externalIds: {
    MAG?: string;
    DOI?: string;
    PubMed?: string;
    PubMedCentral?: string;
    CorpusId?: number;
  };
  journal?: {
    name?: string;
  };
}

export interface SemanticScholarSearchResponse {
  data: SemanticScholarPaper[];
}

// Processing types
export interface ValidationCandidate {
  openalex_id?: string;
  s2_id?: string;
  doi?: string;
  title: string;
  publication_year: number;
  journal_name?: string;
  ids?: {
    doi?: string;
    pmid?: string;
    pmcid?: string;
    openalex?: string;
    mag?: string;
  };
}

export interface ProcessingContext {
  identifierRefs: Map<
    Identifiers,
    Array<{ ref: import("../types").SeedReferencesInput; value: string }>
  >;
  titleRefs: import("../types").SeedReferencesInput[];
  resultMap: Map<string, import("../types").SeedReferencesResponse>;
  deduplicationStats: Record<Identifiers, number>;
}

export interface ValidationStats {
  totalProcessed: number;
  foundByIdentifier: number;
  foundByTitle: number;
  notFound: number;
  duplicatesRemoved: Partial<Record<Identifiers, number>>;
}
