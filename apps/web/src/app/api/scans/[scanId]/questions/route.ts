import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  AIContextValidationError,
  answerRepositoryQuestion,
  buildRepositoryContext
} from "@codemri/ai";
import { getServerEnvironment } from "@codemri/config/env";
import { getDatabase } from "@codemri/db";

import { getAuthenticatedActor } from "@/lib/actor";

export const runtime = "nodejs";

const groqRequestSchema = z.object({
  provider: z.literal("groq").optional(),
  model: z
    .enum(["openai/gpt-oss-20b", "openai/gpt-oss-120b", "llama-3.3-70b-versatile"])
    .optional(),
  apiKey: z.string().trim().min(1).max(1_024).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const { scanId } = await params;
    const body: unknown = await request.json();
    const requestConfiguration = groqRequestSchema.parse(body);
    const environment = getServerEnvironment();
    const database = getDatabase(environment.DATABASE_URL).database;
    const context = await buildRepositoryContext({
      database,
      scanId,
      actorEmail: actor.email,
      maxChars: environment.AI_CONTEXT_MAX_CHARS
    });
    if (!context) {
      return NextResponse.json({ error: "Scan not found." }, { status: 404 });
    }

    const answer = await answerRepositoryQuestion({
      database,
      context,
      rawQuestion: body,
      apiKey: requestConfiguration.apiKey ?? environment.GROQ_API_KEY,
      model: requestConfiguration.model ?? environment.GROQ_MODEL
    });
    return NextResponse.json({ answer }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError || error instanceof AIContextValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message.includes("GROQ_API_KEY")) {
      return NextResponse.json(
        { error: "AI repository questions are not configured." },
        { status: 503 }
      );
    }

    console.error("Repository question failed", error);
    return NextResponse.json(
      { error: "Unable to answer the repository question." },
      { status: 500 }
    );
  }
}
