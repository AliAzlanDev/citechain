/**
 * API service functions for validation
 */
import {
  buildOpenAlexUrl,
  OPENALEX_API_URL,
  rateLimitedFetch,
} from "../openalex";
import { fetchFromSemanticScholar, searchSemanticScholar } from "../s2";
import { chunkArray } from "../utils";
import { APIError } from "../error";
import { Identifiers } from "../types";
import {
  VALIDATION_CONFIG,
  OpenAlexResponse,
  OpenAlexWork,
  SemanticScholarPaper,
  SemanticScholarSearchResponse,
  ValidationCandidate,
} from "./types";

// Import normalization functions for API response processing
import {
  normalizeDoi,
  normalizePmid,
  normalizePmcid,
  normalizeOpenAlexId,
  normalizeMagId,
} from "../utils";

// OpenAlex API functions
export async function searchOpenAlexByIdentifiers(
  identifierType: Identifiers,
  identifiers: string[]
): Promise<ValidationCandidate[]> {
  if (!identifiers.length) return [];

  try {
    const filterParam = buildOpenAlexFilter(identifierType, identifiers);
    const url = buildOpenAlexUrl(
      OPENALEX_API_URL,
      { filter: filterParam },
      [...VALIDATION_CONFIG.OPENALEX_FIELDS],
      100
    );

    const response: OpenAlexResponse = await rateLimitedFetch(url);
    return transformOpenAlexResults(response.results);
  } catch (error) {
    handleOpenAlexError(error, `searching by ${identifierType}`);
  }
}

export async function searchOpenAlexByTitle(
  title: string
): Promise<ValidationCandidate[]> {
  if (!title.trim()) return [];

  try {
    const url = buildOpenAlexUrl(
      OPENALEX_API_URL,
      { search: title.trim() },
      [...VALIDATION_CONFIG.OPENALEX_FIELDS],
      20 // Limit to 20 results for 10 title searches
    );

    const response: OpenAlexResponse = await rateLimitedFetch(url);
    return transformOpenAlexResults(response.results);
  } catch (error) {
    console.error("OpenAlex title search error:", error);
    return []; // Return empty for title searches to allow fallback
  }
}

// Semantic Scholar API functions
export async function searchSemanticScholarByIdentifiers(
  identifierType: Identifiers,
  identifiers: string[]
): Promise<ValidationCandidate[]> {
  if (!identifiers.length) return [];

  try {
    const formattedIds = identifiers
      .map((value) => formatSemanticScholarIdentifier(identifierType, value))
      .filter(Boolean) as string[];

    if (!formattedIds.length) return [];

    const batches = chunkArray(
      formattedIds,
      VALIDATION_CONFIG.BATCH_SIZES.SEMANTIC_SCHOLAR
    );
    const results: ValidationCandidate[] = [];

    for (const batch of batches) {
      const papers: SemanticScholarPaper[] = await fetchFromSemanticScholar<
        SemanticScholarPaper[]
      >(batch, [...VALIDATION_CONFIG.SEMANTIC_SCHOLAR_FIELDS]);
      results.push(...transformSemanticScholarResults(papers));
    }

    return results;
  } catch (error) {
    handleSemanticScholarError(error, `searching by ${identifierType}`);
  }
}

export async function searchSemanticScholarByTitle(
  title: string
): Promise<ValidationCandidate[]> {
  if (!title.trim()) return [];

  try {
    const response: SemanticScholarSearchResponse =
      await searchSemanticScholar<SemanticScholarSearchResponse>(
        title.trim(),
        [...VALIDATION_CONFIG.SEMANTIC_SCHOLAR_FIELDS],
        20
      );

    return transformSemanticScholarResults(response.data || []);
  } catch (error) {
    console.error("Semantic Scholar title search error:", error);
    return []; // Return empty for title searches to allow fallback
  }
}

export async function enrichWithSemanticScholarIds(
  candidates: ValidationCandidate[],
  identifierType: Identifiers
): Promise<void> {
  if (!candidates.length) return;

  try {
    // Extract identifiers from candidates for S2 lookup
    const identifiers = extractIdentifiersFromCandidates(
      candidates,
      identifierType
    );
    if (!identifiers.length) return;

    const s2Results = await searchSemanticScholarByIdentifiers(
      identifierType,
      identifiers
    );

    console.log(
      `Found ${s2Results.length} Semantic Scholar results for ${identifierType}`
    );
    console.log(
      `S2 IDs: ${s2Results
        .map((r) => r.s2_id)
        .filter(Boolean)
        .join(", ")}`
    );
    console.log("first", s2Results[0]);
    const s2IdMap = createS2IdMap(s2Results, identifierType);

    // Enrich candidates with S2 IDs
    for (const candidate of candidates) {
      if (candidate.s2_id) continue; // Already has S2 ID

      const identifierValue = getIdentifierValue(candidate, identifierType);
      if (identifierValue) {
        const s2Id = s2IdMap.get(identifierValue);
        if (s2Id) {
          candidate.s2_id = s2Id;
        }
      }
    }
  } catch (error) {
    console.error("Error enriching with S2 IDs:", error);
    // Continue without throwing to not break validation
  }
}

// Helper functions
function buildOpenAlexFilter(
  identifierType: Identifiers,
  identifiers: string[]
): string {
  // Identifiers are already normalized when they reach this function
  switch (identifierType) {
    case "doi":
      return `doi:${identifiers.map(normalizeDoi).join("|")}`;
    case "pmid":
      return `pmid:${identifiers.map(normalizePmid).join("|")}`;
    case "pmcid":
      return `pmcid:${identifiers.map(normalizePmcid).join("|")}`;
    case "openalex":
      return `openalex:${identifiers.map(normalizeOpenAlexId).join("|")}`;
    case "mag":
      return `mag:${identifiers.map(normalizeMagId).join("|")}`;
    default:
      throw new APIError({
        code: "BAD_REQUEST",
        message: `Unsupported identifier type: ${identifierType}`,
      });
  }
}

function formatSemanticScholarIdentifier(
  type: Identifiers,
  value: string
): string | null {
  // Identifiers are already normalized when they reach this function
  switch (type) {
    case "doi":
      return `DOI:${normalizeDoi(value)}`;
    case "pmid":
      return `PMID:${normalizePmid(value)}`;
    case "pmcid":
      return `PMCID:${normalizePmcid(value)}`;
    case "mag":
      return `MAG:${normalizeMagId(value)}`;
    default:
      return null;
  }
}

function transformOpenAlexResults(
  results: OpenAlexWork[]
): ValidationCandidate[] {
  return results
    .filter((result) => result && result.title)
    .map((result) => ({
      openalex_id: result.id ? normalizeOpenAlexId(result.id) : undefined,
      doi: result.doi ? normalizeDoi(result.doi) : undefined,
      title: result.title,
      publication_year: result.publication_year || 0,
      journal_name: result.primary_location?.source?.display_name,
      ids: result.ids
        ? {
            doi: result.ids.doi ? normalizeDoi(result.ids.doi) : undefined,
            pmid: result.ids.pmid ? normalizePmid(result.ids.pmid) : undefined,
            pmcid: result.ids.pmcid
              ? normalizePmcid(result.ids.pmcid)
              : undefined,
            openalex: result.ids.openalex
              ? normalizeOpenAlexId(result.ids.openalex)
              : undefined,
            mag: result.ids.mag ? normalizeMagId(result.ids.mag) : undefined,
          }
        : undefined,
    }));
}

function transformSemanticScholarResults(
  papers: SemanticScholarPaper[]
): ValidationCandidate[] {
  return papers
    .filter((paper) => paper && paper.title)
    .map((paper) => ({
      s2_id: paper.paperId,
      doi: paper.externalIds?.DOI
        ? normalizeDoi(paper.externalIds.DOI)
        : undefined,
      title: paper.title,
      publication_year: paper.year || 0,
      journal_name: paper.journal?.name,
      ids: {
        doi: paper.externalIds?.DOI
          ? normalizeDoi(paper.externalIds.DOI)
          : undefined,
        pmid: paper.externalIds?.PubMed
          ? normalizePmid(paper.externalIds.PubMed)
          : undefined,
        pmcid: paper.externalIds?.PubMedCentral
          ? normalizePmcid(paper.externalIds.PubMedCentral)
          : undefined,
        mag: paper.externalIds?.MAG
          ? normalizeMagId(paper.externalIds.MAG)
          : undefined,
      },
    }));
}

function extractIdentifiersFromCandidates(
  candidates: ValidationCandidate[],
  identifierType: Identifiers
): string[] {
  const identifiers: string[] = [];

  for (const candidate of candidates) {
    const value = getIdentifierValue(candidate, identifierType);
    if (value) {
      identifiers.push(value);
    }
  }

  return identifiers;
}

function getIdentifierValue(
  candidate: ValidationCandidate,
  identifierType: Identifiers
): string | undefined {
  // Return already normalized identifiers from our transformed candidates
  switch (identifierType) {
    case "doi":
      return candidate.doi || candidate.ids?.doi;
    case "pmid":
      return candidate.ids?.pmid;
    case "pmcid":
      return candidate.ids?.pmcid;
    case "openalex":
      return candidate.ids?.openalex || candidate.openalex_id;
    case "mag":
      return candidate.ids?.mag;
    default:
      return undefined;
  }
}

function createS2IdMap(
  s2Results: ValidationCandidate[],
  identifierType: Identifiers
): Map<string, string> {
  const s2IdMap = new Map<string, string>();

  for (const result of s2Results) {
    if (!result.s2_id) continue;

    const identifierValue = getIdentifierValue(result, identifierType);
    if (identifierValue) {
      // Store using the normalized identifier as key (no need to lowercase since already normalized)
      s2IdMap.set(identifierValue, result.s2_id);
    }
  }

  return s2IdMap;
}

function handleOpenAlexError(error: unknown, operation: string): never {
  console.error(`OpenAlex API error during ${operation}:`, error);

  if (error instanceof APIError) {
    throw error;
  }

  throw new APIError({
    code: "INTERNAL_SERVER_ERROR",
    message: `OpenAlex API: Service unavailable during ${operation}`,
    cause: error,
  });
}

function handleSemanticScholarError(error: unknown, operation: string): never {
  console.error(`Semantic Scholar API error during ${operation}:`, error);

  if (error instanceof APIError) {
    throw error;
  }

  throw new APIError({
    code: "INTERNAL_SERVER_ERROR",
    message: `Semantic Scholar API: Service unavailable during ${operation}`,
    cause: error,
  });
}
