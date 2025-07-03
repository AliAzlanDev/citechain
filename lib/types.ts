import { z } from "zod";

export type SeedReferencesResponse = {
  id: string;
  found: boolean;
  searched_by_title: boolean;
  data: {
    title: string;
    doi?: string;
    journal?: string;
    openalex_id?: string;
    s2_id?: string;
    year: number;
  } | null;
};

export const SeedReferencesInputSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  doi: z.string().optional(),
  pmid: z.string().optional(),
  pmcid: z.string().optional(),
  openalex: z.string().optional(),
  mag: z.string().optional(),
});

export type SeedReferencesInput = z.infer<typeof SeedReferencesInputSchema>;

export type Identifiers = "doi" | "pmid" | "pmcid" | "openalex" | "mag";

export interface BibLibRef {
  id: string;
  type?: string;
  title?: string;
  authors?: string[];
  journal?: string;
  year?: string;
  volume?: string;
  number?: string;
  pages?: string;
  doi?: string;
  urls?: string[];
  abstract?: string;
  keywords?: string[];
  date?: string;
  isbn?: string;
  language?: string;
  notes?: string;
  label?: string;
  _source?: string;
  medlinePMID?: string;
  medlinePubMedCentralID?: string;
  identifiers?: Partial<Record<Identifiers, string[]>>;
}

export interface Citation {
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

// File metadata to store (we can't store File objects directly)
interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

// Identifier form data
interface IdentifierFormData {
  doi?: string;
  pmid?: string;
  pmcid?: string;
  mag?: string;
  openalex?: string;
}

interface Deduplication {
  backwardProviderOverlap?: number;
  forwardProviderOverlap?: number;
  directionOverlap?: number;
  seedDuplicates?: Partial<Record<Identifiers, number>>;
  totalSeedDuplicates?: number;
}

import {
  CitationSearchResults,
  CitationSearchProvider,
  CitationDirection,
} from "./citations";

export interface StoreState {
  uploadedFilesMeta: FileMetadata[];
  identifierFormData: IdentifierFormData;
  seedReferences: SeedReferencesResponse[];
  originalSeedInputs: SeedReferencesInput[];
  backward: Citation[];
  forward: Citation[];
  combined: Citation[];
  deduplication?: Deduplication;
  hasCitationData: boolean;
  citationSearchLoading: boolean;
  citationSearchError: string | null;
  // Citation search configuration
  selectedProvider: CitationSearchProvider;
  selectedDirections: CitationDirection[];
  setUploadedFilesMeta: (files: FileMetadata[]) => void;
  setIdentifierFormData: (data: IdentifierFormData) => void;
  setSeedReferences: (references: SeedReferencesResponse[]) => void;
  setOriginalSeedInputs: (inputs: SeedReferencesInput[]) => void;
  setForward: (forward: Citation[]) => void;
  setCombined: (combined: Citation[]) => void;
  setBackward: (backward: Citation[]) => void;
  setDeduplication: (
    deduplication:
      | Deduplication
      | ((prev: Deduplication | undefined) => Deduplication)
  ) => void;
  setCitationResults: (results: CitationSearchResults) => void;
  setCitationSearchLoading: (loading: boolean) => void;
  setCitationSearchError: (error: string | null) => void;
  clearCitationData: () => void;
  clearStore: () => void;
  // Citation search configuration actions
  setSelectedProvider: (provider: CitationSearchProvider) => void;
  setSelectedDirections: (directions: CitationDirection[]) => void;
}
