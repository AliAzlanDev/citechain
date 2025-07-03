import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const normalizeText = (title: string | undefined) => {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
};

export function chunkArray<T>(array: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Parses a string of identifiers separated by commas or new lines
 * @param value String containing identifiers
 * @returns Array of trimmed, non-empty identifiers with quotes and extra whitespace removed
 */
export function parseIdentifiers(value: string): string[] {
  if (!value || !value.trim()) return [];

  return value
    .split(/[\n,]/) // Split by newlines or commas
    .map((id) => id.trim())
    .map((id) => {
      // Remove surrounding quotes (both single and double)
      if (
        (id.startsWith('"') && id.endsWith('"')) ||
        (id.startsWith("'") && id.endsWith("'"))
      ) {
        return id.slice(1, -1);
      }
      return id;
    })
    .map((id) => id.trim()) // Trim again after removing quotes
    .filter((id) => id.length > 0);
}

export function normalizeDoi(doi: string) {
  if (!doi) return "";

  return (
    doi
      .trim()
      // Remove surrounding quotes (both single and double)
      .replace(/^["']|["']$/g, "")
      .trim()
      .toLowerCase()
      .replace(/^(?:https?:\/\/)?(?:dx\.)?doi\.org\//i, "") // Remove URL prefixes if present
      .replace(/^doi:/i, "") // Remove 'doi:' prefix if present
      .replace(/^\s*10\./i, "10.")
  ); // Clean up spacing before the '10.' prefix
}

/**
 * Normalizes a PMID by removing URL prefixes, "PMID:" prefixes, quotes, and other non-numeric characters
 * @param pmid The PMID string to normalize
 * @returns The normalized PMID
 */
export function normalizePmid(pmid: string): string {
  if (!pmid) return "";

  return (
    pmid
      .trim()
      // Remove surrounding quotes (both single and double)
      .replace(/^["']|["']$/g, "")
      .trim()
      .replace(/^(?:https?:\/\/)?(?:pubmed\.ncbi\.nlm\.nih\.gov\/)/i, "") // Remove URL prefixes
      .replace(/^pmid:?\s*/i, "") // Remove "PMID:" or "PMID" prefix
      .replace(/\/.*$/, "") // Remove trailing slash and anything after
      .replace(/[^\d]/g, "")
  ); // Keep only numeric characters
}

/**
 * Normalizes a PMCID by removing URL prefixes, "PMC" prefix, quotes, returning only the numeric ID
 * @param pmcid The PMCID string to normalize
 * @returns The normalized PMCID as a numeric string without "PMC" prefix
 */
export function normalizePmcid(pmcid: string): string {
  if (!pmcid) return "";

  // Remove URL prefixes and extract the main ID part
  return (
    pmcid
      .trim()
      // Remove surrounding quotes (both single and double)
      .replace(/^["']|["']$/g, "")
      .trim()
      .replace(
        /^(?:https?:\/\/)?(?:www\.)?(?:ncbi\.nlm\.nih\.gov\/pmc\/articles\/)/i,
        ""
      )
      .replace(/^pmcid:?\s*/i, "") // Remove "PMCID:" or "PMCID" prefix
      .replace(/^pmc/i, "") // Remove "PMC" prefix
      .replace(/\/.*$/, "") // Remove trailing slash and anything after
      .replace(/[^\d]/g, "")
  ); // Keep only numeric characters
}

/**
 * Normalizes an OpenAlex ID by removing URL prefixes, quotes, and ensuring consistent format
 * @param openalexId The OpenAlex ID string to normalize
 * @returns The normalized OpenAlex ID
 */
export function normalizeOpenAlexId(openalexId: string): string {
  if (!openalexId) return "";

  return (
    openalexId
      .trim()
      // Remove surrounding quotes (both single and double)
      .replace(/^["']|["']$/g, "")
      .trim()
      .replace(/^(?:https?:\/\/)?(?:openalex\.org\/)/i, "") // Remove URL prefix
      .toLowerCase()
  ); // Ensure lowercase
}

/**
 * Normalizes a MAG ID by ensuring it's a clean numeric string with quotes removed
 * @param magId The MAG ID string to normalize
 * @returns The normalized MAG ID
 */
export function normalizeMagId(magId: string): string {
  if (!magId) return "";

  return (
    magId
      .trim()
      // Remove surrounding quotes (both single and double)
      .replace(/^["']|["']$/g, "")
      .trim()
      .replace(/[^\d]/g, "")
  ); // Keep only numeric characters
}
