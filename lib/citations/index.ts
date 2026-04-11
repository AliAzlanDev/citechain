/**
 * Citation search module - main entry point
 *
 * This module provides functionality to search for backward and forward citations
 * using OpenAlex and/or Semantic Scholar APIs with deduplication and enrichment.
 */
import { APIError } from '../error'
import {
  CitationSearchInput,
  CitationSearchOptions,
  CitationSearchResults,
} from './types'
import {
  initializeCitationContext,
  processOpenAlexCitations,
  processSemanticScholarCitations,
  enrichCitationsWithAbstracts,
  extractCitationResults,
} from './processors'
import { SeedReferencesResponse } from '../types'

export { CITATION_CONFIG } from './types'
export type {
  CitationSearchOptions,
  CitationSearchInput,
  CitationSearchResults,
  CitationSearchProvider,
  CitationDirection,
} from './types'

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
  options: CitationSearchOptions,
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
    }
  }

  console.log(
    `Starting citation search for ${inputs.length} papers with provider: ${options.provider}, direction: ${options.direction}`,
  )

  // Step 1: Initialize processing context
  const context = initializeCitationContext(inputs, options)

  // Step 2: Process citations from different providers
  const errors: Array<{ provider: string; error: Error; code?: string }> = []

  // Process OpenAlex citations
  if (options.provider === 'openalex' || options.provider === 'both') {
    try {
      await processOpenAlexCitations(context)
    } catch (error) {
      console.error('Error processing OpenAlex citations:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      const errorCode = error instanceof APIError ? error.code : undefined
      errors.push({
        provider: 'OpenAlex',
        error: new Error(errorMessage),
        code: errorCode,
      })

      // If only OpenAlex was requested, throw immediately
      if (options.provider === 'openalex') {
        if (error instanceof APIError) {
          throw error
        }

        throw new APIError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `OpenAlex: ${errorMessage}`,
          cause: error,
        })
      }
    }
  }

  // Process Semantic Scholar citations
  if (options.provider === 'semantic_scholar' || options.provider === 'both') {
    try {
      await processSemanticScholarCitations(context)
    } catch (error) {
      console.error('Error processing Semantic Scholar citations:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred'
      const errorCode = error instanceof APIError ? error.code : undefined
      errors.push({
        provider: 'Semantic Scholar',
        error: new Error(errorMessage),
        code: errorCode,
      })

      // If only Semantic Scholar was requested, throw immediately
      if (options.provider === 'semantic_scholar') {
        if (error instanceof APIError) {
          throw error
        }

        throw new APIError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Semantic Scholar: ${errorMessage}`,
          cause: error,
        })
      }
    }
  }

  // Step 3: Enrich with abstracts if needed (for OpenAlex-only searches)
  await enrichCitationsWithAbstracts(context)

  // Step 4: Extract and return results
  const results = extractCitationResults(context)

  console.log(`Citation search completed:`, {
    backward: results.statistics.totalBackward,
    forward: results.statistics.totalForward,
    combined: results.statistics.totalCombined,
    deduplication: results.deduplication,
  })

  // If both providers were requested and both failed, throw error
  if (options.provider === 'both' && errors.length === 2) {
    const errorMessages = errors.map((e) => `${e.provider}: ${e.error.message}`)
    const allRateLimited = errors.every((e) => e.code === 'TOO_MANY_REQUESTS')

    throw new APIError({
      code: allRateLimited ? 'TOO_MANY_REQUESTS' : 'INTERNAL_SERVER_ERROR',
      message: allRateLimited
        ? `Rate limit exceeded for all providers. ${errorMessages.join('; ')}`
        : `All providers failed. ${errorMessages.join('; ')}`,
      cause: errors,
    })
  }

  // Return results with partial errors if any
  return {
    ...results,
    errors:
      errors.length > 0
        ? errors.map((e) => ({
            provider: e.provider,
            message: e.error.message,
          }))
        : undefined,
  }
}

/**
 * Convert validated seed references to citation search inputs
 *
 * @param seedReferences Array of validated seed references
 * @returns Array of citation search inputs
 */
export function seedReferencesToCitationInputs(
  seedReferences: SeedReferencesResponse[],
): CitationSearchInput[] {
  return seedReferences
    .filter((ref) => ref.found && ref.data)
    .map((ref) => ({
      id: ref.id,
      openalex_id: ref.data!.openalex_id,
      s2_id: ref.data!.s2_id,
      doi: ref.data!.doi,
      title: ref.data!.title,
    }))
}
