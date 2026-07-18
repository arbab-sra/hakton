import { and, desc, eq } from "drizzle-orm";
import Groq from "groq-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";

import type { Database } from "@codemri/db";
import { aiAnalysisRuns, repositoryQuestions } from "@codemri/db/schema";
import { metricNames, type MetricSeverity } from "@codemri/metrics";

import type { RepositoryContextBundle } from "./context";
import {
  AI_PROMPT_VERSION,
  repositoryQuestionSystemPrompt,
  repositoryReasoningSystemPrompt
} from "./prompts";
import {
  modelAnalysisSchema,
  modelQuestionAnswerSchema,
  repositoryQuestionSchema,
  type ModelAnalysis,
  type ModelQuestionAnswer
} from "./schemas";

type DrizzleDatabase = Database["database"];

export interface RepositoryReasoningResult {
  version: "1.0";
  scanId: string;
  contextFingerprint: string;
  model: string;
  metricExplanations: Record<
    (typeof metricNames)[number],
    {
      score: number;
      severity: MetricSeverity;
      confidence: number;
      explanation: string;
      evidenceIds: string[];
    }
  >;
  architecturalRisks: ModelAnalysis["architecturalRisks"];
  recommendations: ModelAnalysis["recommendations"];
}

export interface RepositoryQuestionAnswer {
  version: "1.0";
  scanId: string;
  contextFingerprint: string;
  model: string;
  question: string;
  status: ModelQuestionAnswer["status"];
  answer: string;
  confidence: number;
  evidenceIds: string[];
  suggestedFollowUp: string | null;
}

export class AIContextValidationError extends Error {}

function publicContext(bundle: RepositoryContextBundle) {
  return {
    scan: bundle.scan,
    facts: bundle.facts
  };
}

function assertKnownEvidenceIds(bundle: RepositoryContextBundle, evidenceIds: string[]) {
  const unknown = evidenceIds.filter((id) => !bundle.factIds.has(id));
  if (unknown.length > 0) {
    throw new AIContextValidationError(
      `AI response cited facts that were not provided: ${unknown.join(", ")}.`
    );
  }
}

function assertKnownAffectedFiles(bundle: RepositoryContextBundle, fileIds: string[]) {
  const unknown = fileIds.filter((id) => !bundle.fileFactIds.has(id));
  if (unknown.length > 0) {
    throw new AIContextValidationError(
      `AI response referenced files that were not provided: ${unknown.join(", ")}.`
    );
  }
}

function validateAnalysis(bundle: RepositoryContextBundle, analysis: ModelAnalysis) {
  for (const metric of metricNames) {
    const explanation = analysis.metricExplanations[metric];
    assertKnownEvidenceIds(bundle, explanation.evidenceIds);
    const validMetricEvidence = bundle.metricEvidenceFactIds[metric];
    if (!explanation.evidenceIds.some((id) => validMetricEvidence.has(id))) {
      throw new AIContextValidationError(
        `The ${metric} explanation must cite its corresponding computed metric evidence.`
      );
    }
  }

  for (const risk of analysis.architecturalRisks) {
    assertKnownEvidenceIds(bundle, risk.evidenceIds);
    assertKnownAffectedFiles(bundle, risk.affectedFileIds);
  }

  for (const recommendation of analysis.recommendations) {
    assertKnownEvidenceIds(bundle, recommendation.evidenceIds);
    assertKnownAffectedFiles(bundle, recommendation.affectedFileIds);
  }
}

function validateQuestionAnswer(bundle: RepositoryContextBundle, answer: ModelQuestionAnswer) {
  assertKnownEvidenceIds(bundle, answer.evidenceIds);
  if (answer.status === "answered" && answer.evidenceIds.length === 0) {
    throw new AIContextValidationError(
      "An answered repository question must cite at least one fact."
    );
  }
  if (answer.status === "insufficient_evidence") {
    if (answer.evidenceIds.length > 0 || answer.confidence > 40) {
      throw new AIContextValidationError(
        "An insufficient-evidence answer cannot cite facts or have high confidence."
      );
    }
  }
}

function combineAnalysis(
  bundle: RepositoryContextBundle,
  model: string,
  analysis: ModelAnalysis
): RepositoryReasoningResult {
  const metricExplanations = Object.fromEntries(
    bundle.metrics.map((metric) => [
      metric.metric,
      {
        score: metric.score,
        severity: metric.severity,
        confidence: metric.confidence,
        explanation: analysis.metricExplanations[metric.metric].explanation,
        evidenceIds: analysis.metricExplanations[metric.metric].evidenceIds
      }
    ])
  ) as RepositoryReasoningResult["metricExplanations"];

  return {
    version: "1.0",
    scanId: bundle.scan.id,
    contextFingerprint: bundle.fingerprint,
    model,
    metricExplanations,
    architecturalRisks: analysis.architecturalRisks,
    recommendations: analysis.recommendations
  };
}

function createClient(apiKey: string | undefined) {
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is required to run AI repository reasoning.");
  }
  return new Groq({ apiKey });
}

function outputSchema(schema: typeof modelAnalysisSchema | typeof modelQuestionAnswerSchema) {
  return zodToJsonSchema(schema, { $refStrategy: "none", target: "openApi3" });
}

async function createStructuredCompletion({
  apiKey,
  model,
  systemPrompt,
  payload,
  schema
}: {
  apiKey: string | undefined;
  model: string;
  systemPrompt: string;
  payload: Record<string, unknown>;
  schema: typeof modelAnalysisSchema | typeof modelQuestionAnswerSchema;
}) {
  const response = await createClient(apiKey).chat.completions.create({
    model,
    temperature: 0,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({ ...payload, OUTPUT_SCHEMA: outputSchema(schema) })
      }
    ],
    response_format: { type: "json_object" }
  });
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("Groq returned no structured analysis.");
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new Error("Groq returned invalid JSON.");
  }
}

export async function generateRepositoryReasoning({
  database,
  context,
  apiKey,
  model
}: {
  database: DrizzleDatabase;
  context: RepositoryContextBundle;
  apiKey: string | undefined;
  model: string;
}): Promise<RepositoryReasoningResult> {
  const [run] = await database
    .insert(aiAnalysisRuns)
    .values({
      scanId: context.scan.id,
      status: "running",
      model,
      promptVersion: AI_PROMPT_VERSION,
      contextFingerprint: context.fingerprint
    })
    .returning({ id: aiAnalysisRuns.id });

  const runId = run?.id;
  if (!runId) {
    throw new Error("Unable to create an AI analysis run.");
  }

  try {
    const response = await createStructuredCompletion({
      apiKey,
      model,
      systemPrompt: repositoryReasoningSystemPrompt,
      payload: {
        task: "explain_metrics_and_prioritize_repository_risks",
        SCAN_CONTEXT: publicContext(context)
      },
      schema: modelAnalysisSchema
    });
    const parsed = modelAnalysisSchema.parse(response);

    validateAnalysis(context, parsed);
    const result = combineAnalysis(context, model, parsed);
    await database
      .update(aiAnalysisRuns)
      .set({ status: "completed", result, completedAt: new Date() })
      .where(eq(aiAnalysisRuns.id, runId));
    return result;
  } catch (error) {
    await database
      .update(aiAnalysisRuns)
      .set({
        status: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown AI analysis failure.",
        completedAt: new Date()
      })
      .where(eq(aiAnalysisRuns.id, runId));
    throw error;
  }
}

export async function answerRepositoryQuestion({
  database,
  context,
  rawQuestion,
  apiKey,
  model
}: {
  database: DrizzleDatabase;
  context: RepositoryContextBundle;
  rawQuestion: unknown;
  apiKey: string | undefined;
  model: string;
}): Promise<RepositoryQuestionAnswer> {
  const { question } = repositoryQuestionSchema.parse(rawQuestion);
  const [latestAnalysis] = await database
    .select({ id: aiAnalysisRuns.id })
    .from(aiAnalysisRuns)
    .where(and(eq(aiAnalysisRuns.scanId, context.scan.id), eq(aiAnalysisRuns.status, "completed")))
    .orderBy(desc(aiAnalysisRuns.createdAt))
    .limit(1);
  const [storedQuestion] = await database
    .insert(repositoryQuestions)
    .values({
      scanId: context.scan.id,
      userId: context.actorUserId,
      analysisRunId: latestAnalysis?.id,
      model,
      contextFingerprint: context.fingerprint,
      question
    })
    .returning({ id: repositoryQuestions.id });

  const storedQuestionId = storedQuestion?.id;
  if (!storedQuestionId) {
    throw new Error("Unable to store the repository question.");
  }

  try {
    const response = await createStructuredCompletion({
      apiKey,
      model,
      systemPrompt: repositoryQuestionSystemPrompt,
      payload: { QUESTION: question, SCAN_CONTEXT: publicContext(context) },
      schema: modelQuestionAnswerSchema
    });
    const parsed = modelQuestionAnswerSchema.parse(response);
    validateQuestionAnswer(context, parsed);
    const answer: RepositoryQuestionAnswer = {
      version: "1.0",
      scanId: context.scan.id,
      contextFingerprint: context.fingerprint,
      model,
      question,
      ...parsed
    };
    await database
      .update(repositoryQuestions)
      .set({ answer, answeredAt: new Date() })
      .where(eq(repositoryQuestions.id, storedQuestionId));
    return answer;
  } catch (error) {
    await database
      .update(repositoryQuestions)
      .set({
        errorMessage: error instanceof Error ? error.message : "Unknown AI question failure.",
        answeredAt: new Date()
      })
      .where(eq(repositoryQuestions.id, storedQuestionId));
    throw error;
  }
}

export async function getLatestRepositoryReasoning({
  database,
  scanId,
  contextFingerprint
}: {
  database: DrizzleDatabase;
  scanId: string;
  contextFingerprint: string;
}): Promise<RepositoryReasoningResult | undefined> {
  const [run] = await database
    .select({ result: aiAnalysisRuns.result })
    .from(aiAnalysisRuns)
    .where(
      and(
        eq(aiAnalysisRuns.scanId, scanId),
        eq(aiAnalysisRuns.status, "completed"),
        eq(aiAnalysisRuns.contextFingerprint, contextFingerprint)
      )
    )
    .orderBy(desc(aiAnalysisRuns.createdAt))
    .limit(1);

  return run?.result as RepositoryReasoningResult | undefined;
}
