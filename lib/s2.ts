import Bottleneck from "bottleneck";
import { APIError } from "./error";

// Constants
const SEMANTIC_SCHOLAR_API_URL =
  "https://api.semanticscholar.org/graph/v1/paper/batch";
const SEMANTIC_SCHOLAR_SEARCH_URL =
  "https://api.semanticscholar.org/graph/v1/paper/search";

// Create a rate limiter with Bottleneck
// 1 request per second (1000ms)
const limiter = new Bottleneck({
  minTime: 1000, // Minimum time between requests (1 second)
  maxConcurrent: 1, // Allow only 1 request at a time
});

/**
 * Performs a fetch request to Semantic Scholar API with rate limiting
 * @param url URL to fetch
 * @param options Fetch options
 * @returns Promise with the fetch response
 */
async function rateLimitedFetchS2<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  // Use the limiter to schedule and execute the fetch operation
  return limiter.schedule(async () => {
    try {
      // Make the API request
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = (await response.json()) as {
          error: string;
        };
        throw new Error(
          `Semantic Scholar API returned status ${response.status}: ${errorText.error}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error("Error fetching from Semantic Scholar API:", error);
      throw new APIError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Error fetching from Semantic Scholar API",
        cause: error,
      });
    }
  });
}

/**
 * Makes a POST request to Semantic Scholar API with rate limiting
 * @param ids Array of Semantic Scholar identifiers
 * @param fields Fields to include in the response
 * @returns Promise with the fetch response
 */
export async function fetchFromSemanticScholar<T>(
  ids: string[],
  fields: string[]
): Promise<T> {
  const url = new URL(SEMANTIC_SCHOLAR_API_URL);
  url.searchParams.append("fields", fields.join(","));

  return rateLimitedFetchS2<T>(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ids: ids,
    }),
  });
}

/**
 * Searches Semantic Scholar by title
 * @param query Search query (title)
 * @param fields Fields to include in the response
 * @param limit Maximum number of results to return
 * @returns Promise with the search response
 */
export async function searchSemanticScholar<T>(
  query: string,
  fields: string[],
  limit: number
): Promise<T> {
  const url = new URL(SEMANTIC_SCHOLAR_SEARCH_URL);
  url.searchParams.append("query", query);
  url.searchParams.append("fields", fields.join(","));
  url.searchParams.append("limit", limit.toString());

  return rateLimitedFetchS2<T>(url.toString(), {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
}
