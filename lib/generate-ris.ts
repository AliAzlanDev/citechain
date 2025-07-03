import { Citation } from "./types";

/**
 * Converts a reference to RIS format
 */
export function generateRIS(references: Citation[]): string {
  let risContent = "";

  for (const ref of references) {
    // Start reference
    risContent += "TY  - JOUR\n"; // Default to journal article

    // Title
    if (ref.title) {
      risContent += `TI  - ${ref.title}\n`;
    }

    // Authors
    if (ref.authors && ref.authors.length > 0) {
      for (const author of ref.authors) {
        risContent += `AU  - ${author}\n`;
      }
    }

    // Journal
    if (ref.journal) {
      risContent += `JO  - ${ref.journal}\n`;
    }

    // Year
    if (ref.year) {
      risContent += `PY  - ${ref.year}\n`;
    }

    // Volume, issue, pages
    if (ref.volume) {
      risContent += `VL  - ${ref.volume}\n`;
    }
    if (ref.number) {
      risContent += `IS  - ${ref.number}\n`;
    }
    if (ref.pages) {
      risContent += `SP  - ${ref.pages.split("-")[0].trim()}\n`;
      const endPage = ref.pages.split("-")[1];
      if (endPage) {
        risContent += `EP  - ${endPage.trim()}\n`;
      }
    }

    // DOI
    if (ref.doi) {
      risContent += `DO  - ${ref.doi}\n`;
    }

    // PMID
    if (ref.pmid) {
      risContent += `AN  - ${ref.pmid}\n`;
    }

    // Abstract
    if (ref.abstract) {
      const cleanAbstract = ref.abstract.replace(/\r?\n/g, "\\n").trim();
      risContent += `AB  - ${cleanAbstract}\n`;
    }

    // End reference
    risContent += "ER  - \n\n";
  }

  return risContent;
}
