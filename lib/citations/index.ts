/**
 * Citation search module - main entry point
 *
 * This module provides functionality to search for backward and forward citations
 * using OpenAlex and/or Semantic Scholar APIs with deduplication and enrichment.
 */
import { APIError } from "../error";
import {
  CitationSearchInput,
  CitationSearchOptions,
  CitationSearchResults,
} from "./types";
import {
  initializeCitationContext,
  processOpenAlexCitations,
  processSemanticScholarCitations,
  enrichCitationsWithAbstracts,
  extractCitationResults,
} from "./processors";
import { SeedReferencesResponse } from "../types";

export { CITATION_CONFIG } from "./types";
export type {
  CitationSearchOptions,
  CitationSearchInput,
  CitationSearchResults,
  CitationSearchProvider,
  CitationDirection,
} from "./types";

/**
 * Main citation search function
 *
 * @param inputs Array of papers to search citations for
 * @param options Search configuration (provider and direction)
 * @returns Promise containing citation search results with deduplication statistics
 *
 * @example
 * ```typescript
 * const inputs = [
 *   {
 *     id: "paper1",
 *     openalex_id: "W2963487017",
 *     s2_id: "2963487017",
 *     doi: "10.1038/nature12373"
 *   }
 * ];
 *
 * const result = await searchCitations(inputs, {
 *   provider: "both",
 *   direction: "both"
 * });
 *
 * console.log(`Found ${result.backward.length} backward and ${result.forward.length} forward citations`);
 * console.log(`Combined: ${result.combined.length} unique citations`);
 * ```
 */
export async function searchCitations(
  inputs: CitationSearchInput[],
  options: CitationSearchOptions
): Promise<CitationSearchResults> {
  // Handle empty input
  if (inputs.length === 0) {
    return {
      backward: [],
      forward: [],
      combined: [],
      deduplication: {
        backwardProviderOverlap: 0,
        forwardProviderOverlap: 0,
        directionOverlap: 0,
      },
      statistics: {
        totalBackward: 0,
        totalForward: 0,
        totalCombined: 0,
        sources: {
          openalex: { backward: 0, forward: 0 },
          semanticScholar: { backward: 0, forward: 0 },
        },
      },
    };
  }

  try {
    console.log(
      `Starting citation search for ${inputs.length} papers with provider: ${options.provider}, direction: ${options.direction}`
    );

    // Step 1: Initialize processing context
    const context = initializeCitationContext(inputs, options);

    // Step 2: Process citations from different providers
    const processingPromises = [];

    // Process OpenAlex citations
    if (options.provider === "openalex" || options.provider === "both") {
      processingPromises.push(processOpenAlexCitations(context));
    }

    // Process Semantic Scholar citations
    if (
      options.provider === "semantic_scholar" ||
      options.provider === "both"
    ) {
      processingPromises.push(processSemanticScholarCitations(context));
    }

    // Wait for all processing to complete
    await Promise.all(processingPromises);

    // Step 3: Enrich with abstracts if needed (for OpenAlex-only searches)
    await enrichCitationsWithAbstracts(context);

    // Step 4: Extract and return results
    const results = extractCitationResults(context);

    console.log(`Citation search completed:`, {
      backward: results.statistics.totalBackward,
      forward: results.statistics.totalForward,
      combined: results.statistics.totalCombined,
      deduplication: results.deduplication,
    });

    return results;
  } catch (error) {
    console.error("Error searching citations:", error);
    throw new APIError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error searching citations",
      cause: error,
    });
  }
}

/**
 * Convert validated seed references to citation search inputs
 *
 * @param seedReferences Array of validated seed references
 * @returns Array of citation search inputs
 */
export function seedReferencesToCitationInputs(
  seedReferences: SeedReferencesResponse[]
): CitationSearchInput[] {
  return seedReferences
    .filter((ref) => ref.found && ref.data)
    .map((ref) => ({
      id: ref.id,
      openalex_id: ref.data!.openalex_id,
      s2_id: ref.data!.s2_id,
      doi: ref.data!.doi,
      title: ref.data!.title,
    }));
}
