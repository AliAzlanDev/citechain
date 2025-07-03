/**
 * Citation search processing functions
 */
import { Citation } from "../types";
import { normalizeDoi, normalizeOpenAlexId, normalizeText } from "../utils";
import {
  CitationSearchInput,
  CitationSearchOptions,
  CitationProcessingContext,
  CitationSearchResults,
} from "./types";
import {
  searchOpenAlexCitations,
  searchSemanticScholarCitations,
  enrichWithAbstracts,
} from "./services";

export function initializeCitationContext(
  inputs: CitationSearchInput[],
  options: CitationSearchOptions
): CitationProcessingContext {
  return {
    searchInputs: inputs,
    options,
    backwardCitations: new Map(),
    forwardCitations: new Map(),
    processedIds: new Set(),
    abstractsMap: new Map(),
    statistics: {
      sources: {
        openalex: {
          backward: 0,
          forward: 0,
        },
        semanticScholar: {
          backward: 0,
          forward: 0,
        },
      },
      backwardProviderOverlap: 0,
      forwardProviderOverlap: 0,
    },
  };
}

export async function processOpenAlexCitations(
  context: CitationProcessingContext
): Promise<void> {
  if (context.options.provider === "semantic_scholar") return;

  try {
    const { backward, forward } = await searchOpenAlexCitations(
      context.searchInputs,
      context.options.direction
    );

    // Add to context maps with deduplication and track stats
    let newBackwardCount = 0;
    let newForwardCount = 0;

    backward.forEach((citation) => {
      const key = generateCitationKey(citation);
      if (!context.backwardCitations.has(key)) {
        context.backwardCitations.set(key, citation);
        newBackwardCount++;
      }
    });

    forward.forEach((citation) => {
      const key = generateCitationKey(citation);
      if (!context.forwardCitations.has(key)) {
        context.forwardCitations.set(key, citation);
        newForwardCount++;
      }
    });

    // Update statistics
    context.statistics.sources.openalex.backward += newBackwardCount;
    context.statistics.sources.openalex.forward += newForwardCount;

    console.log(
      `OpenAlex: Found ${backward.length} citations (${newBackwardCount} new backward, ${newForwardCount} new forward)`
    );
  } catch (error) {
    console.error("Error processing OpenAlex citations:", error);
    // Continue processing with other providers
  }
}

export async function processSemanticScholarCitations(
  context: CitationProcessingContext
): Promise<void> {
  if (context.options.provider === "openalex") return;

  try {
    const { backward, forward, abstractsMap } =
      await searchSemanticScholarCitations(
        context.searchInputs,
        context.options.direction
      );

    // Store abstracts for later enrichment
    abstractsMap.forEach((abstract, key) => {
      context.abstractsMap.set(key, abstract);
    });

    // Add to context maps with deduplication and track stats
    let newBackwardCount = 0;
    let newForwardCount = 0;
    let enrichedBackwardCount = 0;
    let enrichedForwardCount = 0;

    backward.forEach((citation) => {
      const key = generateCitationKey(citation);
      if (!context.backwardCitations.has(key)) {
        context.backwardCitations.set(key, citation);
        newBackwardCount++;
      } else {
        // Enrich existing citation with S2 data (especially abstract)
        const existing = context.backwardCitations.get(key)!;
        const enriched = enrichCitationWithS2Data(existing, citation);
        context.backwardCitations.set(key, enriched);
        enrichedBackwardCount++;
        // This counts as a duplicate between providers for backward citations
        context.statistics.backwardProviderOverlap++;
      }
    });

    forward.forEach((citation) => {
      const key = generateCitationKey(citation);
      if (!context.forwardCitations.has(key)) {
        context.forwardCitations.set(key, citation);
        newForwardCount++;
      } else {
        // Enrich existing citation with S2 data
        const existing = context.forwardCitations.get(key)!;
        const enriched = enrichCitationWithS2Data(existing, citation);
        context.forwardCitations.set(key, enriched);
        enrichedForwardCount++;
        // This counts as a duplicate between providers for forward citations
        context.statistics.forwardProviderOverlap++;
      }
    });

    // Update statistics
    context.statistics.sources.semanticScholar.backward += newBackwardCount;
    context.statistics.sources.semanticScholar.forward += newForwardCount;

    console.log(
      `Semantic Scholar: Found ${
        backward.length
      } citations (${newBackwardCount} new backward, ${newForwardCount} new forward, ${
        enrichedBackwardCount + enrichedForwardCount
      } enriched)`
    );
  } catch (error) {
    console.error("Error processing Semantic Scholar citations:", error);
    // Continue processing
  }
}

export async function enrichCitationsWithAbstracts(
  context: CitationProcessingContext
): Promise<void> {
  // Only enrich if we used OpenAlex only (no S2 abstracts)
  if (
    context.options.provider === "semantic_scholar" ||
    context.abstractsMap.size > 0
  ) {
    return;
  }

  try {
    const backwardCitations = Array.from(context.backwardCitations.values());
    const forwardCitations = Array.from(context.forwardCitations.values());

    const [enrichedBackward, enrichedForward] = await Promise.all([
      enrichWithAbstracts(backwardCitations, context.abstractsMap),
      enrichWithAbstracts(forwardCitations, context.abstractsMap),
    ]);

    // Update context with enriched citations
    context.backwardCitations.clear();
    context.forwardCitations.clear();

    enrichedBackward.forEach((citation) => {
      const key = generateCitationKey(citation);
      context.backwardCitations.set(key, citation);
    });

    enrichedForward.forEach((citation) => {
      const key = generateCitationKey(citation);
      context.forwardCitations.set(key, citation);
    });

    console.log("Citations enriched with abstracts from Semantic Scholar");
  } catch (error) {
    console.error("Error enriching citations with abstracts:", error);
    // Continue without abstracts
  }
}

export function extractCitationResults(
  context: CitationProcessingContext
): CitationSearchResults {
  const backward = Array.from(context.backwardCitations.values());
  const forward = Array.from(context.forwardCitations.values());

  // Create combined list with deduplication
  const combinedMap = new Map<string, Citation>();
  const backwardKeys = new Set<string>();
  const forwardKeys = new Set<string>();

  // Add backward citations
  backward.forEach((citation) => {
    const key = generateCitationKey(citation);
    backwardKeys.add(key);
    combinedMap.set(key, citation);
  });

  // Add forward citations
  forward.forEach((citation) => {
    const key = generateCitationKey(citation);
    forwardKeys.add(key);
    combinedMap.set(key, citation);
  });

  const combined = Array.from(combinedMap.values());

  // Calculate overlap between backward and forward (citations appearing in both)
  let directionOverlap = 0;
  backwardKeys.forEach((key) => {
    if (forwardKeys.has(key)) {
      directionOverlap++;
    }
  });

  return {
    backward,
    forward,
    combined,
    deduplication: {
      backwardProviderOverlap: context.statistics.backwardProviderOverlap,
      forwardProviderOverlap: context.statistics.forwardProviderOverlap,
      directionOverlap,
    },
    statistics: {
      totalBackward: backward.length,
      totalForward: forward.length,
      totalCombined: combined.length,
      sources: context.statistics.sources,
    },
  };
}

// Helper functions
function generateCitationKey(citation: Citation): string {
  // Use DOI as primary key if available
  if (citation.doi) {
    return `doi:${normalizeDoi(citation.doi)}`;
  }

  // Use OpenAlex ID if available
  if (citation.openalex_id) {
    return `openalex:${normalizeOpenAlexId(citation.openalex_id)}`;
  }

  // Use S2 ID if available
  if (citation.s2_id) {
    return `s2:${citation.s2_id}`;
  }

  // Use PMID if available
  if (citation.pmid) {
    return `pmid:${citation.pmid}`;
  }

  // Fallback to title-based key (normalized)
  return `title:${normalizeText(citation.title)}`;
}

function enrichCitationWithS2Data(
  existing: Citation,
  s2Citation: Citation
): Citation {
  return {
    ...existing,
    // Prefer S2 ID if not already present
    s2_id: existing.s2_id || s2Citation.s2_id,
    // Prefer S2 abstract if available
    abstract: s2Citation.abstract || existing.abstract,
    // Keep other S2-specific data if not present
    authors: existing.authors?.length ? existing.authors : s2Citation.authors,
    journal: existing.journal || s2Citation.journal,
    pages: existing.pages || s2Citation.pages,
    volume: existing.volume || s2Citation.volume,
    number: existing.number || s2Citation.number,
  };
}
