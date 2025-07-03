import { NextRequest, NextResponse } from "next/server";
import { SeedReferencesInputSchema } from "@/lib/types";
import { validateSeedReferences } from "@/lib/validation";
import { APIError, getStatusCodeFromErrorCode } from "@/lib/error";
import { z } from "zod";

const RequestSchema = z.object({
  references: z.array(SeedReferencesInputSchema),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate the request body
    const validatedBody = RequestSchema.parse(body);

    // Process the seed references
    const result = await validateSeedReferences(validatedBody.references);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in validate-seed-references API:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.errors },
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
