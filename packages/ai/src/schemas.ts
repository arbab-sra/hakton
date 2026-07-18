import { z } from "zod";

import { metricNames } from "@codemri/metrics";

function plainText(maxLength = 2_000) {
  return z
    .string()
    .min(1)
    .max(maxLength)
    .refine(
      (value) => !/(^|\n)\s*(#|[-*+]\s|```)/.test(value),
      "AI text must be plain text, not Markdown."
    );
}

export const evidenceIdSchema = z.string().min(1).max(160).startsWith("fact:");

const evidenceIdsSchema = z.array(evidenceIdSchema).min(1).max(12);

export const metricExplanationSchema = z.object({
  explanation: plainText(),
  evidenceIds: evidenceIdsSchema
});

export const modelAnalysisSchema = z.object({
  metricExplanations: z.object({
    overall_health: metricExplanationSchema,
    maintainability: metricExplanationSchema,
    technical_debt: metricExplanationSchema,
    architecture_integrity: metricExplanationSchema,
    performance_risk: metricExplanationSchema,
    security_exposure: metricExplanationSchema,
    code_complexity: metricExplanationSchema,
    test_confidence: metricExplanationSchema,
    dependency_health: metricExplanationSchema,
    production_readiness: metricExplanationSchema
  }),
  architecturalRisks: z
    .array(
      z.object({
        title: plainText(160),
        description: plainText(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        evidenceIds: evidenceIdsSchema,
        affectedFileIds: z.array(evidenceIdSchema).max(12)
      })
    )
    .max(20),
  recommendations: z
    .array(
      z.object({
        title: plainText(160),
        rationale: plainText(),
        priority: z.enum(["P0", "P1", "P2", "P3"]),
        expectedImpact: plainText(500),
        effort: z.enum(["small", "medium", "large"]),
        evidenceIds: evidenceIdsSchema,
        affectedFileIds: z.array(evidenceIdSchema).max(12)
      })
    )
    .max(20)
});

export const modelQuestionAnswerSchema = z.object({
  status: z.enum(["answered", "insufficient_evidence"]),
  answer: plainText(4_000),
  confidence: z.number().int().min(0).max(100),
  evidenceIds: z.array(evidenceIdSchema).max(12),
  suggestedFollowUp: plainText(500).nullable()
});

export const repositoryQuestionSchema = z.object({
  question: z.string().trim().min(1).max(2_000)
});

export type ModelAnalysis = z.infer<typeof modelAnalysisSchema>;
export type ModelQuestionAnswer = z.infer<typeof modelQuestionAnswerSchema>;
export type MetricName = (typeof metricNames)[number];
