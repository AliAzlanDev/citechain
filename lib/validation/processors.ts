/**
 * Simplified processing functions for validation
 */
import {
  normalizeDoi,
  normalizePmid,
  normalizePmcid,
  normalizeOpenAlexId,
  normalizeMagId,
  normalizeText,
  chunkArray,
} from "../utils";
import {
  Identifiers,
  SeedReferencesInput,
  SeedReferencesResponse,
} from "../types";
import {
  searchOpenAlexByIdentifiers,
  searchOpenAlexByTitle,
  searchSemanticScholarByIdentifiers,
  searchSemanticScholarByTitle,
  enrichWithSemanticScholarIds,
} from "./services";
import {
  VALIDATION_CONFIG,
  ValidationCandidate,
  ProcessingContext,
  ValidationStats,
} from "./types";

// Main processing functions
export function initializeProcessingContext(
  references: SeedReferencesInput[]
): ProcessingContext {
  const context: ProcessingContext = {
    identifierRefs: new Map(),
    titleRefs: [],
    resultMap: new Map(),
    deduplicationStats: {
      doi: 0,
      pmid: 0,
      pmcid: 0,
      openalex: 0,
      mag: 0,
    },
  };

  // Initialize identifier maps
  for (const type of VALIDATION_CONFIG.IDENTIFIER_TYPES) {
    context.identifierRefs.set(type, []);
  }

  const processedRefs = new Set<string>();
  const uniqueIdentifiers: Record<Identifiers, Set<string>> = {
    doi: new Set(),
    pmid: new Set(),
    pmcid: new Set(),
    openalex: new Set(),
    mag: new Set(),
  };

  // Group references by identifier type and detect duplicates
  for (const ref of references) {
    if (processedRefs.has(ref.id)) continue;

    let assigned = false;

    // Process identifiers in priority order - normalize once here
    if (ref.doi && !assigned) {
      const normalizedDoi = normalizeDoi(ref.doi);
      assigned = processIdentifierReference(
        "doi",
        ref,
        normalizedDoi,
        uniqueIdentifiers,
        context,
        processedRefs
      );
    }

    if (ref.pmid && !assigned) {
      const normalizedPmid = normalizePmid(ref.pmid);
      assigned = processIdentifierReference(
        "pmid",
        ref,
        normalizedPmid,
        uniqueIdentifiers,
        context,
        processedRefs
      );
    }

    if (ref.pmcid && !assigned) {
      const normalizedPmcid = normalizePmcid(ref.pmcid);
      assigned = processIdentifierReference(
        "pmcid",
        ref,
        normalizedPmcid,
        uniqueIdentifiers,
        context,
        processedRefs
      );
    }

    if (ref.openalex && !assigned) {
      // Normalize OpenAlex IDs for consistency
      const normalizedOpenAlex = normalizeOpenAlexId(ref.openalex);
      assigned = processIdentifierReference(
        "openalex",
        ref,
        normalizedOpenAlex,
        uniqueIdentifiers,
        context,
        processedRefs
      );
    }

    if (ref.mag && !assigned) {
      // Normalize MAG IDs for consistency
      const normalizedMag = normalizeMagId(ref.mag);
      assigned = processIdentifierReference(
        "mag",
        ref,
        normalizedMag,
        uniqueIdentifiers,
        context,
        processedRefs
      );
    }

    // If no identifier, add to title-only refs
    if (!assigned && ref.title) {
      context.titleRefs.push(ref);
      context.resultMap.set(ref.id, createEmptyResult(ref.id, true));
      processedRefs.add(ref.id);
    }
  }

  return context;
}

export async function processIdentifierBasedReferences(
  context: ProcessingContext
): Promise<void> {
  for (const identifierType of VALIDATION_CONFIG.IDENTIFIER_TYPES) {
    const refs = context.identifierRefs.get(identifierType) || [];
    if (refs.length === 0) continue;

    await processIdentifierType(identifierType, refs, context);
  }
}

export async function processTitleBasedReferences(
  context: ProcessingContext
): Promise<void> {
  if (context.titleRefs.length === 0) return;

  const batches = chunkArray(
    context.titleRefs,
    VALIDATION_CONFIG.BATCH_SIZES.TITLE
  );

  for (const batch of batches) {
    await processTitleBatch(batch, context);
  }
}

export function extractResults(context: ProcessingContext): {
  results: SeedReferencesResponse[];
  deduplication: Partial<Record<Identifiers, number>>;
  stats: ValidationStats;
} {
  const results = Array.from(context.resultMap.values());

  const stats: ValidationStats = {
    totalProcessed: results.length,
    foundByIdentifier: results.filter((r) => r.found && !r.searched_by_title)
      .length,
    foundByTitle: results.filter((r) => r.found && r.searched_by_title).length,
    notFound: results.filter((r) => !r.found).length,
    duplicatesRemoved: { ...context.deduplicationStats },
  };

  // Clean deduplication stats (remove zero entries)
  const cleanedDeduplication: Partial<Record<Identifiers, number>> = {};
  for (const [key, value] of Object.entries(context.deduplicationStats)) {
    if (value > 0) {
      cleanedDeduplication[key as Identifiers] = value;
    }
  }

  return {
    results,
    deduplication: cleanedDeduplication,
    stats,
  };
}

// Helper functions
function processIdentifierReference(
  type: Identifiers,
  ref: SeedReferencesInput,
  normalizedValue: string,
  uniqueIdentifiers: Record<Identifiers, Set<string>>,
  context: ProcessingContext,
  processedRefs: Set<string>
): boolean {
  if (!uniqueIdentifiers[type].has(normalizedValue)) {
    uniqueIdentifiers[type].add(normalizedValue);
    context.identifierRefs.get(type)?.push({ ref, value: normalizedValue });
    context.resultMap.set(ref.id, createEmptyResult(ref.id, false));
    processedRefs.add(ref.id);
    return true;
  } else {
    context.deduplicationStats[type]++;
    processedRefs.add(ref.id);
    return true; // Still considered assigned even if duplicate
  }
}

async function processIdentifierType(
  identifierType: Identifiers,
  refs: Array<{ ref: SeedReferencesInput; value: string }>,
  context: ProcessingContext
): Promise<void> {
  const batches = chunkArray(refs, VALIDATION_CONFIG.BATCH_SIZES.OPENALEX);

  for (const batch of batches) {
    const identifierValues = batch.map((item) => item.value);

    // Step 1: Search OpenAlex
    const openAlexCandidates = await searchOpenAlexByIdentifiers(
      identifierType,
      identifierValues
    );

    // Step 2: Enrich OpenAlex results with S2 IDs
    if (openAlexCandidates.length > 0) {
      await enrichWithSemanticScholarIds(openAlexCandidates, identifierType);
    }

    // Step 3: Update results with OpenAlex matches
    updateResultsWithCandidates(
      batch,
      openAlexCandidates,
      identifierType,
      context,
      false
    );

    // Step 4: Find references not found in OpenAlex
    const notFoundRefs = batch.filter(({ ref }) => {
      const result = context.resultMap.get(ref.id);
      return result && !result.found;
    });

    // Step 5: Fallback to Semantic Scholar for not found references
    if (notFoundRefs.length > 0) {
      await processSemanticScholarFallback(
        identifierType,
        notFoundRefs,
        context
      );
    }
  }
}

async function processSemanticScholarFallback(
  identifierType: Identifiers,
  notFoundRefs: Array<{ ref: SeedReferencesInput; value: string }>,
  context: ProcessingContext
): Promise<void> {
  try {
    const identifierValues = notFoundRefs.map((item) => item.value);
    const s2Candidates = await searchSemanticScholarByIdentifiers(
      identifierType,
      identifierValues
    );

    updateResultsWithCandidates(
      notFoundRefs,
      s2Candidates,
      identifierType,
      context,
      false
    );

    // For still unfound references with titles, try title search
    const stillNotFound = notFoundRefs.filter(({ ref }) => {
      const result = context.resultMap.get(ref.id);
      return result && !result.found && ref.title;
    });

    if (stillNotFound.length > 0) {
      await processTitleFallbackForIdentifierRefs(stillNotFound, context);
    }
  } catch (error) {
    console.error(
      `Semantic Scholar fallback error for ${identifierType}:`,
      error
    );
  }
}

async function processTitleFallbackForIdentifierRefs(
  notFoundRefs: Array<{ ref: SeedReferencesInput; value: string }>,
  context: ProcessingContext
): Promise<void> {
  try {
    for (const { ref } of notFoundRefs) {
      if (!ref.title?.trim()) continue;

      const s2TitleCandidates = await searchSemanticScholarByTitle(
        ref.title.trim()
      );
      if (s2TitleCandidates.length > 0) {
        const bestMatch = findBestTitleMatch(ref.title, s2TitleCandidates);
        if (bestMatch) {
          updateSingleResult(ref.id, bestMatch, context, true);
        }
      }
    }
  } catch (error) {
    console.error("Title fallback error:", error);
  }
}

async function processTitleBatch(
  batch: SeedReferencesInput[],
  context: ProcessingContext
): Promise<void> {
  // Step 1: Try OpenAlex title search
  const titleQuery = batch.map((ref) => ref.title || "").join(" OR ");
  const openAlexCandidates = await searchOpenAlexByTitle(titleQuery);

  // Step 2: Find matches first and store the mappings
  const refToCandidateMap = new Map<string, ValidationCandidate>();
  const matchedCandidates: ValidationCandidate[] = [];

  if (openAlexCandidates.length > 0) {
    for (const ref of batch) {
      if (!ref.title) continue;
      const bestMatch = findBestTitleMatch(ref.title, openAlexCandidates);
      if (bestMatch) {
        refToCandidateMap.set(ref.id, bestMatch);
        if (!matchedCandidates.includes(bestMatch)) {
          matchedCandidates.push(bestMatch);
        }
      }
    }
  }

  // Step 3: Enrich only the matched candidates with S2 IDs
  if (matchedCandidates.length > 0) {
    await enrichOpenAlexTitleResultsWithS2Ids(matchedCandidates);
  }

  // Step 4: Update results using the stored mappings
  for (const ref of batch) {
    const matchedCandidate = refToCandidateMap.get(ref.id);
    if (matchedCandidate) {
      updateSingleResult(ref.id, matchedCandidate, context, true);
    }
  }

  // Step 5: Find references not found in OpenAlex
  const notFoundRefs = batch.filter((ref) => {
    const result = context.resultMap.get(ref.id);
    return result && !result.found;
  });

  // Step 6: Fallback to Semantic Scholar for not found references
  if (notFoundRefs.length > 0) {
    await processSemanticScholarTitleFallback(notFoundRefs, context);
  }
}

async function enrichOpenAlexTitleResultsWithS2Ids(
  candidates: ValidationCandidate[]
): Promise<void> {
  try {
    // Priority order for identifier types
    const identifierPriority: Identifiers[] = ["doi", "pmid", "pmcid", "mag"];

    // Track which candidates already have S2 IDs to avoid duplicate enrichment
    const candidatesNeedingEnrichment = candidates.filter(
      (candidate) => !candidate.s2_id
    );

    if (candidatesNeedingEnrichment.length === 0) return;

    // Process identifiers by priority, stopping when we find one for each candidate
    for (const identifierType of identifierPriority) {
      const identifierGroups: Record<Identifiers, string[]> = {
        doi: [],
        pmid: [],
        pmcid: [],
        openalex: [],
        mag: [],
      };

      // Extract identifiers only for candidates that still need enrichment
      const remainingCandidates = candidatesNeedingEnrichment.filter(
        (candidate) => !candidate.s2_id
      );

      if (remainingCandidates.length === 0) break;

      remainingCandidates.forEach((candidate) => {
        switch (identifierType) {
          case "doi":
            if (candidate.doi) {
              identifierGroups.doi.push(candidate.doi);
            }
            break;
          case "pmid":
            if (candidate.ids?.pmid) {
              identifierGroups.pmid.push(candidate.ids.pmid);
            }
            break;
          case "pmcid":
            if (candidate.ids?.pmcid) {
              identifierGroups.pmcid.push(candidate.ids.pmcid);
            }
            break;
          case "mag":
            if (candidate.ids?.mag) {
              identifierGroups.mag.push(candidate.ids.mag);
            }
            break;
        }
      });

      // Enrich with S2 IDs for this identifier type
      if (identifierGroups[identifierType].length > 0) {
        await enrichWithSemanticScholarIds(remainingCandidates, identifierType);
      }
    }
  } catch (error) {
    console.error("Error enriching OpenAlex title results with S2 IDs:", error);
  }
}

async function processSemanticScholarTitleFallback(
  notFoundRefs: SeedReferencesInput[],
  context: ProcessingContext
): Promise<void> {
  try {
    for (const ref of notFoundRefs) {
      if (!ref.title?.trim()) continue;

      const s2Candidates = await searchSemanticScholarByTitle(ref.title.trim());
      if (s2Candidates.length > 0) {
        const bestMatch = findBestTitleMatch(ref.title, s2Candidates);
        if (bestMatch) {
          updateSingleResult(ref.id, bestMatch, context, true);
        }
      }
    }
  } catch (error) {
    console.error("Semantic Scholar title fallback error:", error);
  }
}

function updateResultsWithCandidates(
  refs: Array<{ ref: SeedReferencesInput; value: string }>,
  candidates: ValidationCandidate[],
  identifierType: Identifiers,
  context: ProcessingContext,
  searchedByTitle: boolean
): void {
  const candidateMap = createCandidateMap(candidates, identifierType);

  for (const { ref, value } of refs) {
    const candidate = candidateMap.get(value);
    if (candidate) {
      updateSingleResult(ref.id, candidate, context, searchedByTitle);
    }
  }
}

function updateSingleResult(
  refId: string,
  candidate: ValidationCandidate,
  context: ProcessingContext,
  searchedByTitle: boolean
): void {
  context.resultMap.set(
    refId,
    transformCandidateToResult(refId, candidate, searchedByTitle)
  );
}

function createCandidateMap(
  candidates: ValidationCandidate[],
  identifierType: Identifiers
): Map<string, ValidationCandidate> {
  const candidateMap = new Map<string, ValidationCandidate>();

  candidates.forEach((candidate) => {
    let key: string | null = null;

    switch (identifierType) {
      case "doi":
        // API responses are already normalized in transform functions
        key = candidate.doi || candidate.ids?.doi || null;
        break;
      case "pmid":
        // API responses are already normalized in transform functions
        key = candidate.ids?.pmid || null;
        break;
      case "pmcid":
        // API responses are already normalized in transform functions
        key = candidate.ids?.pmcid || null;
        break;
      case "openalex":
        // API responses are already normalized in transform functions
        key = candidate.openalex_id || candidate.ids?.openalex || null;
        break;
      case "mag":
        // API responses are already normalized in transform functions
        key = candidate.ids?.mag || null;
        break;
    }

    if (key) {
      candidateMap.set(key, candidate);
    }
  });

  return candidateMap;
}

function findBestTitleMatch(
  targetTitle: string,
  candidates: ValidationCandidate[]
): ValidationCandidate | null {
  const normalizedTarget = normalizeText(targetTitle);

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate.title);
    if (normalizedTarget === normalizedCandidate) {
      return candidate;
    }
  }

  return null;
}

function createEmptyResult(
  id: string,
  searchedByTitle: boolean
): SeedReferencesResponse {
  return {
    id,
    found: false,
    searched_by_title: searchedByTitle,
    data: null,
  };
}

function transformCandidateToResult(
  id: string,
  candidate: ValidationCandidate,
  searchedByTitle: boolean
): SeedReferencesResponse {
  return {
    id,
    found: true,
    searched_by_title: searchedByTitle,
    data: {
      title: candidate.title,
      doi: candidate.doi,
      journal: candidate.journal_name,
      openalex_id: candidate.ids?.openalex || candidate.openalex_id,
      s2_id: candidate.s2_id,
      year: candidate.publication_year,
    },
  };
}
