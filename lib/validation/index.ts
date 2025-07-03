/**
 * Simplified validation module - main entry point
 *
 * This module provides a streamlined approach to validating seed references
 * using OpenAlex as the primary source with Semantic Scholar as enrichment and fallback.
 */
import { APIError } from "../error";
import {
  SeedReferencesInput,
  SeedReferencesResponse,
  Identifiers,
} from "../types";
import {
  initializeProcessingContext,
  processIdentifierBasedReferences,
  processTitleBasedReferences,
  extractResults,
} from "./processors";

export { VALIDATION_CONFIG } from "./types";

/**
 * Main validation function - validates seed references using a multi-API approach
 *
 * @param references Array of seed references to validate
 * @returns Promise containing validation results and deduplication statistics
 *
 * @example
 * ```typescript
 * const references = [
 *   { id: "ref1", doi: "10.1234/example.doi", title: "Example Paper" },
 *   { id: "ref2", pmid: "12345678" },
 *   { id: "ref3", title: "Title-only Reference" }
 * ];
 *
 * const result = await validateSeedReferences(references);
 * console.log(`Found ${result.results.filter(r => r.found).length} out of ${references.length} references`);
 * ```
 */
export async function validateSeedReferences(
  references: SeedReferencesInput[]
): Promise<{
  results: SeedReferencesResponse[];
  deduplication: { [key in Identifiers]?: number };
}> {
  // Handle empty input
  if (references.length === 0) {
    return {
      results: [],
      deduplication: {},
    };
  }

  try {
    // Step 1: Initialize processing context and group references
    const context = initializeProcessingContext(references);

    // Step 2: Process identifier-based references (DOI, PMID, etc.)
    await processIdentifierBasedReferences(context);

    // Step 3: Process title-only references
    await processTitleBasedReferences(context);

    // Step 4: Extract and return results
    const { results, deduplication } = extractResults(context);

    return {
      results,
      deduplication,
    };
  } catch (error) {
    console.error("Error validating seed references:", error);
    throw new APIError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error validating seed references",
      cause: error,
    });
  }
}

/**
 * Validates seed references and returns detailed statistics
 *
 * @param references Array of seed references to validate
 * @returns Promise containing results, deduplication stats, and detailed statistics
 */
export async function validateSeedReferencesWithStats(
  references: SeedReferencesInput[]
): Promise<{
  results: SeedReferencesResponse[];
  deduplication: { [key in Identifiers]?: number };
  statistics: {
    totalProcessed: number;
    foundByIdentifier: number;
    foundByTitle: number;
    notFound: number;
    successRate: number;
    duplicatesRemoved: { [key in Identifiers]?: number };
  };
}> {
  const result = await validateSeedReferences(references);

  const foundByIdentifier = result.results.filter(
    (r) => r.found && !r.searched_by_title
  ).length;
  const foundByTitle = result.results.filter(
    (r) => r.found && r.searched_by_title
  ).length;
  const notFound = result.results.filter((r) => !r.found).length;
  const totalFound = foundByIdentifier + foundByTitle;

  return {
    ...result,
    statistics: {
      totalProcessed: references.length,
      foundByIdentifier,
      foundByTitle,
      notFound,
      successRate:
        references.length > 0 ? (totalFound / references.length) * 100 : 0,
      duplicatesRemoved: result.deduplication,
    },
  };
}
