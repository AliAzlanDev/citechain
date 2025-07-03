/**
 * Citation search API service functions
 */
import { nanoid } from "nanoid";
import {
  buildOpenAlexUrl,
  OPENALEX_API_URL,
  rateLimitedFetch,
} from "../openalex";
import { fetchFromSemanticScholar } from "../s2";
import {
  chunkArray,
  normalizeDoi,
  normalizePmid,
  normalizeOpenAlexId,
} from "../utils";
import { APIError } from "../error";
import { Citation } from "../types";
import {
  CITATION_CONFIG,
  CitationSearchInput,
  CitationDirection,
  OpenAlexCitationResponse,
  SemanticScholarPaper,
  SemanticScholarCitation,
} from "./types";

// OpenAlex citation search functions
export async function searchOpenAlexCitations(
  inputs: CitationSearchInput[],
  direction: CitationDirection
): Promise<{
  backward: Citation[];
  forward: Citation[];
}> {
  const backward: Citation[] = [];
  const forward: Citation[] = [];

  // Group inputs by their OpenAlex IDs
  const openAlexInputs = inputs.filter((input) => input.openalex_id);

  if (openAlexInputs.length === 0) {
    return { backward, forward };
  }

  try {
    if (direction === "backward" || direction === "both") {
      const backwardResults = await searchOpenAlexBackwardCitations(
        openAlexInputs
      );
      backward.push(...backwardResults);
    }

    if (direction === "forward" || direction === "both") {
      const forwardResults = await searchOpenAlexForwardCitations(
        openAlexInputs
      );
      forward.push(...forwardResults);
    }

    return { backward, forward };
  } catch (error) {
    console.error("Error searching OpenAlex citations:", error);
    throw new APIError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error searching citations in OpenAlex",
      cause: error,
    });
  }
}

async function searchOpenAlexBackwardCitations(
  inputs: CitationSearchInput[]
): Promise<Citation[]> {
  const citations: Citation[] = [];
  try {
    // Process in batches to avoid overwhelming the API
    const batches = chunkArray(inputs, CITATION_CONFIG.BATCH_SIZES.OPENALEX);

    for (const batch of batches) {
      // Batch fetch all papers to get their referenced_works
      const openAlexIds = batch.map((input) => input.openalex_id!);
      const paperUrl = buildOpenAlexUrl(
        OPENALEX_API_URL,
        { filter: `openalex:${openAlexIds.join("|")}` },
        ["referenced_works"],
        100
      );

      const paperResponse: OpenAlexCitationResponse = await rateLimitedFetch(
        paperUrl
      );

      // Collect all referenced works from all papers
      const allReferencedWorks = new Set<string>();

      for (const paper of paperResponse.results) {
        if (paper.referenced_works && paper.referenced_works.length > 0) {
          paper.referenced_works.forEach((workId) => {
            allReferencedWorks.add(normalizeOpenAlexId(workId));
          });
        }
      }

      if (allReferencedWorks.size > 0) {
        // Get details of all referenced works
        const referencedWorksArray = Array.from(allReferencedWorks);
        const batchCitations = await fetchOpenAlexWorkDetails(
          referencedWorksArray
        );
        citations.push(...batchCitations);
      }
    }

    return citations;
  } catch (error) {
    console.error("Error fetching backward citations:", error);
    return citations;
  }
}

async function searchOpenAlexForwardCitations(
  inputs: CitationSearchInput[]
): Promise<Citation[]> {
  const citations: Citation[] = [];
  const batchPromises = inputs.map(async (input) => {
    try {
      const allCitations: Citation[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const url = buildOpenAlexUrl(
          OPENALEX_API_URL,
          { filter: `cites:${input.openalex_id}`, page: page.toString() },
          [...CITATION_CONFIG.OPENALEX_FIELDS],
          100
        );

        const response: OpenAlexCitationResponse = await rateLimitedFetch(url);

        const pageCitations = transformOpenAlexToCitations(response.results);
        allCitations.push(...pageCitations);

        // Check if there are more pages
        hasMore =
          response.results.length === 100 && response.meta.count > page * 100;
        page++;

        // Limit to reasonable number of pages to avoid infinite loops
        if (page > 50) break;
      }

      return allCitations;
    } catch (error) {
      console.error(
        `Error fetching forward citations for ${input.openalex_id}:`,
        error
      );
      return [];
    }
  });

  const batchResults = await Promise.all(batchPromises);
  citations.push(...batchResults.flat());

  return citations;
}

async function fetchOpenAlexWorkDetails(
  openAlexIds: string[]
): Promise<Citation[]> {
  if (openAlexIds.length === 0) return [];

  try {
    // Process in chunks to avoid URL length limits
    const chunks = chunkArray(openAlexIds, 100);
    const allCitations: Citation[] = [];

    for (const chunk of chunks) {
      const url = buildOpenAlexUrl(
        OPENALEX_API_URL,
        { filter: `openalex:${chunk.join("|")}` },
        [...CITATION_CONFIG.OPENALEX_FIELDS],
        100
      );

      const response: OpenAlexCitationResponse = await rateLimitedFetch(url);
      const citations = transformOpenAlexToCitations(response.results);
      allCitations.push(...citations);
    }

    return allCitations;
  } catch (error) {
    console.error("Error fetching OpenAlex work details:", error);
    return [];
  }
}

// Semantic Scholar citation search functions
export async function searchSemanticScholarCitations(
  inputs: CitationSearchInput[],
  direction: CitationDirection
): Promise<{
  backward: Citation[];
  forward: Citation[];
  abstractsMap: Map<string, string>;
}> {
  const backward: Citation[] = [];
  const forward: Citation[] = [];
  const abstractsMap = new Map<string, string>();

  // Filter inputs that have S2 IDs
  const s2Inputs = inputs.filter((input) => input.s2_id);

  if (s2Inputs.length === 0) {
    return { backward, forward, abstractsMap };
  }

  try {
    // Process in batches
    const batches = chunkArray(
      s2Inputs,
      CITATION_CONFIG.BATCH_SIZES.SEMANTIC_SCHOLAR
    );

    for (const batch of batches) {
      const s2Ids = batch.map((input) => input.s2_id!);

      const papers: SemanticScholarPaper[] = await fetchFromSemanticScholar<
        SemanticScholarPaper[]
      >(s2Ids, [...CITATION_CONFIG.SEMANTIC_SCHOLAR_FIELDS]);

      for (const paper of papers) {
        if (direction === "backward" || direction === "both") {
          const backwardCitations = transformS2CitationsToCitations(
            paper.references || [],
            abstractsMap
          );
          backward.push(...backwardCitations);
        }

        if (direction === "forward" || direction === "both") {
          const forwardCitations = transformS2CitationsToCitations(
            paper.citations || [],
            abstractsMap
          );
          forward.push(...forwardCitations);
        }
      }
    }

    return { backward, forward, abstractsMap };
  } catch (error) {
    console.error("Error searching Semantic Scholar citations:", error);
    throw new APIError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Error searching citations in Semantic Scholar",
      cause: error,
    });
  }
}

// Enrichment functions
export async function enrichWithAbstracts(
  citations: Citation[],
  abstractsMap: Map<string, string>
): Promise<Citation[]> {
  // If we already have abstracts from S2, use them
  if (abstractsMap.size > 0) {
    return citations.map((citation) => {
      if (!citation.abstract && citation.doi) {
        const normalizedDoi = normalizeDoi(citation.doi);
        const abstract = abstractsMap.get(normalizedDoi);
        if (abstract) {
          return { ...citation, abstract };
        }
      }
      return citation;
    });
  }

  // If no abstracts from S2, fetch them separately for OpenAlex-only citations
  const citationsNeedingAbstracts = citations.filter(
    (citation) => !citation.abstract && (citation.doi || citation.s2_id)
  );

  if (citationsNeedingAbstracts.length === 0) {
    return citations;
  }

  try {
    // Group by identifier type
    const s2Ids = citationsNeedingAbstracts
      .filter((c) => c.s2_id)
      .map((c) => c.s2_id!);

    const dois = citationsNeedingAbstracts
      .filter((c) => c.doi && !c.s2_id)
      .map((c) => `DOI:${c.doi!}`);

    const allIds = [...s2Ids, ...dois];

    if (allIds.length === 0) return citations;

    // Fetch abstracts in batches
    const batches = chunkArray(allIds, 400);
    const abstractsFromS2 = new Map<string, string>();

    for (const batch of batches) {
      try {
        const papers: SemanticScholarPaper[] = await fetchFromSemanticScholar<
          SemanticScholarPaper[]
        >(batch, ["externalIds", "abstract"]);

        for (const paper of papers) {
          if (paper.abstract) {
            // Map by S2 ID
            abstractsFromS2.set(paper.paperId, paper.abstract);

            // Also map by DOI if available
            if (paper.externalIds?.DOI) {
              const normalizedDoi = normalizeDoi(paper.externalIds.DOI);
              abstractsFromS2.set(normalizedDoi, paper.abstract);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching abstracts batch:", error);
        // Continue with other batches
      }
    }

    // Enrich citations with abstracts
    return citations.map((citation) => {
      if (citation.abstract) return citation;

      // Try to find abstract by S2 ID first
      if (citation.s2_id) {
        const abstract = abstractsFromS2.get(citation.s2_id);
        if (abstract) {
          return { ...citation, abstract };
        }
      }

      // Try to find abstract by DOI
      if (citation.doi) {
        const normalizedDoi = normalizeDoi(citation.doi);
        const abstract = abstractsFromS2.get(normalizedDoi);
        if (abstract) {
          return { ...citation, abstract };
        }
      }

      return citation;
    });
  } catch (error) {
    console.error("Error enriching with abstracts:", error);
    return citations; // Return original citations if enrichment fails
  }
}

// Transformation functions
function transformOpenAlexToCitations(
  results: OpenAlexCitationResponse["results"]
): Citation[] {
  return results
    .filter((item) => item && item.title)
    .map((item) => ({
      id: nanoid(),
      doi: item.doi ? normalizeDoi(item.doi) : undefined,
      pmid: item.ids.pmid ? normalizePmid(item.ids.pmid) : undefined,
      openalex_id: item.id
        ? normalizeOpenAlexId(item.id)
        : item.ids.openalex
        ? normalizeOpenAlexId(item.ids.openalex)
        : undefined,
      title: item.title || "",
      year: item.publication_year || undefined,
      journal: item.primary_location?.source?.display_name,
      pages: `${item.biblio?.first_page || ""}-${
        item.biblio?.last_page || ""
      }`.replace(/^-$/, ""),
      volume: item.biblio?.volume || undefined,
      number: item.biblio?.issue || undefined,
      authors: item.authorships
        .map((auth) => auth.author?.display_name || "")
        .filter(Boolean),
      open_access: !!item.primary_location?.is_oa,
      open_access_url:
        item.primary_location?.pdf_url ||
        item.primary_location?.landing_page_url,
      type: item.type,
    }));
}

function transformS2CitationsToCitations(
  s2Citations: SemanticScholarCitation[],
  abstractsMap: Map<string, string>
): Citation[] {
  return s2Citations
    .filter((citation) => citation && citation.title)
    .map((citation) => {
      // Store abstract in map if available
      if (citation.abstract && citation.externalIds?.DOI) {
        const normalizedDoi = normalizeDoi(citation.externalIds.DOI);
        abstractsMap.set(normalizedDoi, citation.abstract);
      }

      return {
        id: nanoid(),
        s2_id: citation.paperId,
        doi: citation.externalIds?.DOI
          ? normalizeDoi(citation.externalIds.DOI)
          : undefined,
        pmid: citation.externalIds?.PubMed
          ? normalizePmid(citation.externalIds.PubMed)
          : undefined,
        title: citation.title,
        abstract: citation.abstract || undefined,
        year: citation.year || undefined,
        journal: citation.journal?.name,
        pages: citation.journal?.pages,
        volume: citation.journal?.volume,
        authors: citation.authors?.map((author) => author.name) || [],
        open_access: !!citation.openAccessPdf?.url,
        open_access_url: citation.openAccessPdf?.url || undefined,
        type: citation.publicationTypes?.join(", ") || undefined,
      };
    });
}
