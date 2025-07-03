import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  searchCitations,
  CitationSearchOptions,
  CitationSearchInput,
} from "@/lib/citations";
import { APIError, getStatusCodeFromErrorCode } from "@/lib/error";

// Input validation schema
const CitationSearchSchema = z.object({
  inputs: z.array(
    z.object({
      id: z.string(),
      openalex_id: z.string().optional(),
      s2_id: z.string().optional(),
      doi: z.string().optional(),
      pmid: z.string().optional(),
      title: z.string().optional(),
    })
  ),
  options: z.object({
    provider: z.enum(["openalex", "semantic_scholar", "both"]),
    direction: z.enum(["backward", "forward", "both"]),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json();
    const validatedData = CitationSearchSchema.parse(body);

    const { inputs, options } = validatedData;

    // Validate that we have at least one input with valid identifiers
    const validInputs = inputs.filter(
      (input) =>
        input.openalex_id ||
        input.s2_id ||
        input.doi ||
        input.pmid ||
        input.title
    );

    if (validInputs.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid inputs provided. Each input must have at least one identifier (openalex_id, s2_id, doi, pmid, or title).",
        },
        { status: 400 }
      );
    }

    console.log(
      `Starting citation search for ${validInputs.length} papers with provider: ${options.provider}, direction: ${options.direction}`
    );

    // Perform citation search
    const results = await searchCitations(
      validInputs as CitationSearchInput[],
      options as CitationSearchOptions
    );

    console.log(
      `Citation search completed: ${results.statistics.totalBackward} backward, ${results.statistics.totalForward} forward, ${results.statistics.totalCombined} combined`
    );

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error("Citation search API error:", error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Invalid request data",
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof APIError) {
      const statusCode = getStatusCodeFromErrorCode(error.code);
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: statusCode }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Citation Search API",
      description: "Use POST to search for backward and forward citations",
      endpoints: {
        POST: {
          description: "Search for citations",
          body: {
            inputs: [
              {
                id: "string (required)",
                openalex_id: "string (optional)",
                s2_id: "string (optional)",
                doi: "string (optional)",
                pmid: "string (optional)",
                title: "string (optional)",
              },
            ],
            options: {
              provider: "openalex | semantic_scholar | both",
              direction: "backward | forward | both",
            },
          },
        },
      },
    },
    { status: 200 }
  );
}
