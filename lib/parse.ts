import {
  parseRIS,
  parseEndnoteXML,
  parseMedline,
  type BibLibRef as BibLibRefOriginal,
} from "biblib";
import { toast } from "sonner";
import { nanoid } from "nanoid";
import { BibLibRef } from "./types";

export async function parseRefs(file: File): Promise<BibLibRef[]> {
  const content = await file.text();
  const extension = file.name.split(".").pop()?.toLowerCase();
  let refs: BibLibRefOriginal[] = [];

  // Try to identify format based on extension and content
  if (extension === "ris" || content.includes("TY  -")) {
    refs = await parseRIS(content, {
      delimeter: "",
    });
  } else if (
    extension === "xml" ||
    content.includes("<?xml") ||
    content.includes("<xml")
  ) {
    refs = await parseEndnoteXML(content);
  } else if (extension === "nbib" || content.includes("PMID-")) {
    refs = await parseMedline(content, {
      delimeter: "",
    });
  } else {
    toast.error("Only RIS, NBIB, or Endnote XML is supported.");
  }

  return refs.map((ref: BibLibRefOriginal) => ({
    ...ref,
    id: nanoid(),
    _source: file.name,
  }));
}
