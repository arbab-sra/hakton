import { NextResponse } from "next/server";
import { z, ZodError } from "zod";

import {
  AIContextValidationError,
  buildRepositoryContext,
  generateRepositoryReasoning,
  getLatestRepositoryReasoning
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

async function getContext(scanId: string) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return { error: NextResponse.json({ error: "Authentication is required." }, { status: 401 }) };
  }

  const environment = getServerEnvironment();
  const context = await buildRepositoryContext({
    database: getDatabase(environment.DATABASE_URL).database,
    scanId,
    actorEmail: actor.email,
    maxChars: environment.AI_CONTEXT_MAX_CHARS
  });
  if (!context) {
    return { error: NextResponse.json({ error: "Scan not found." }, { status: 404 }) };
  }

  return { context, environment };
}

export async function GET(_: Request, { params }: { params: Promise<{ scanId: string }> }) {
  try {
    const { scanId } = await params;
    const resolved = await getContext(scanId);
    if ("error" in resolved) {
      return resolved.error;
    }

    const analysis = await getLatestRepositoryReasoning({
      database: getDatabase(resolved.environment.DATABASE_URL).database,
      scanId,
      contextFingerprint: resolved.context.fingerprint
    });
    if (!analysis) {
      return NextResponse.json(
        { error: "No current AI analysis exists for this scan." },
        { status: 404 }
      );
    }

    return NextResponse.json({ analysis });
  } catch (error) {
    return analysisErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ scanId: string }> }) {
  try {
    const { scanId } = await params;
    const requestConfiguration = groqRequestSchema.parse(await request.json().catch(() => ({})));
    const resolved = await getContext(scanId);
    if ("error" in resolved) {
      return resolved.error;
    }

    const analysis = await generateRepositoryReasoning({
      database: getDatabase(resolved.environment.DATABASE_URL).database,
      context: resolved.context,
      apiKey: requestConfiguration.apiKey ?? resolved.environment.GROQ_API_KEY,
      model: requestConfiguration.model ?? resolved.environment.GROQ_MODEL
    });
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    return analysisErrorResponse(error);
  }
}

function analysisErrorResponse(error: unknown) {
  if (error instanceof ZodError || error instanceof AIContextValidationError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof Error && error.message.includes("GROQ_API_KEY")) {
    return NextResponse.json({ error: "AI analysis is not configured." }, { status: 503 });
  }

  console.error("AI analysis failed", error);
  return NextResponse.json(
    { error: "Unable to generate AI repository analysis." },
    { status: 500 }
  );
}
