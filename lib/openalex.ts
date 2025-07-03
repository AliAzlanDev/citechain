import { APIError } from "./error";
import Bottleneck from "bottleneck";

export const OPENALEX_API_URL = "https://api.openalex.org/works";

// Create a rate limiter: max 10 requests per second
const limiter = new Bottleneck({
  maxConcurrent: 9,
  minTime: 110, // Minimum time between requests (in ms) = 10 requests per second
});

// Generic rate-limited fetch with better error handling
export const rateLimitedFetch = limiter.wrap(async (url: string) => {
  try {
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(url, {
      headers: {
        "User-Agent": "mailto:aliazlanreal@gmail.com",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 429) {
        console.error("OpenAlex API rate limit exceeded:", response.statusText);
        throw new APIError({
          code: "TOO_MANY_REQUESTS",
          message: "OpenAlex API rate limit exceeded, please try again later",
        });
      }

      if (response.status === 404) {
        console.error("OpenAlex resource not found:", url);
        throw new APIError({
          code: "NOT_FOUND",
          message: "The requested resource could not be found in OpenAlex",
        });
      }

      if (response.status >= 500) {
        console.error(
          `OpenAlex server error (${response.status}):`,
          response.statusText
        );
        throw new APIError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "OpenAlex service is currently experiencing issues, please try again later",
        });
      }

      console.error(
        `OpenAlex API error (${response.status}):`,
        response.statusText
      );
      throw new APIError({
        code: "BAD_REQUEST",
        message: `OpenAlex API error: ${
          response.statusText || "Unknown error"
        }`,
      });
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error(
        "Failed to parse OpenAlex API response as JSON:",
        text.substring(0, 200)
      );
      throw new APIError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Invalid response format from OpenAlex API",
        cause: e,
      });
    }
  } catch (error) {
    if (error instanceof APIError) {
      throw error; // Re-throw TRPC errors that we've already created
    }

    if (error instanceof DOMException && error.name === "AbortError") {
      console.error("OpenAlex API request timed out");
      throw new APIError({
        code: "TIMEOUT",
        message: "OpenAlex API request timed out, please try again later",
      });
    }

    console.error("Error fetching from OpenAlex API:", error);
    throw new APIError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch data from OpenAlex API",
      cause: error,
    });
  }
});

// Helper function to build the URL with common parameters
export function buildOpenAlexUrl(
  baseUrl: string,
  params: Record<string, string>,
  fields: string[],
  perPage: number
): string {
  const queryParams = new URLSearchParams({
    ...params,
    select: fields.join(","),
    "per-page": perPage.toString(),
  });

  return `${baseUrl}?${queryParams.toString()}`;
}
