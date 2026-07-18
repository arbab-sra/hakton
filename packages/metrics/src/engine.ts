import type { ExtractedFile, RepositoryExtraction } from "@codemri/analyzer";

export const metricNames = [
  "overall_health",
  "maintainability",
  "technical_debt",
  "architecture_integrity",
  "performance_risk",
  "security_exposure",
  "code_complexity",
  "test_confidence",
  "dependency_health",
  "production_readiness"
] as const;

export type MetricName = (typeof metricNames)[number];
export type MetricSeverity = "low" | "medium" | "high" | "critical";

export interface MetricEvidence {
  code: string;
  message: string;
  filePath?: string;
}

export interface MetricResult {
  score: number;
  severity: MetricSeverity;
  explanation: string;
  evidence: MetricEvidence[];
  affectedFiles: string[];
  confidence: number;
  recommendedActions: string[];
}

export interface MetricsReport {
  version: "1.0";
  generatedAt: string;
  metrics: Record<MetricName, MetricResult>;
}

const maxAffectedFiles = 10;

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityFor(score: number): MetricSeverity {
  if (score < 40) {
    return "critical";
  }
  if (score < 60) {
    return "high";
  }
  if (score < 80) {
    return "medium";
  }
  return "low";
}

function uniquePaths(paths: Array<string | undefined>) {
  return [...new Set(paths.filter((path): path is string => Boolean(path)))].slice(
    0,
    maxAffectedFiles
  );
}

function fileEvidence(
  files: ExtractedFile[],
  code: string,
  message: (file: ExtractedFile) => string
) {
  return files
    .slice(0, maxAffectedFiles)
    .map((file) => ({ code, message: message(file), filePath: file.path }));
}

function makeMetric({
  score,
  explanation,
  evidence,
  affectedFiles,
  confidence,
  recommendedActions
}: Omit<MetricResult, "severity">): MetricResult {
  const normalizedConfidence = clamp(confidence);
  // Static analysis can only prove what it inspected. Confidence therefore limits the highest
  // score we can claim, even when no negative signal was detected.
  const confidenceCeiling = clamp(65 + normalizedConfidence * 0.35);
  const requestedScore = clamp(score);
  const normalizedScore = Math.min(requestedScore, confidenceCeiling);
  return {
    score: normalizedScore,
    severity: severityFor(normalizedScore),
    explanation,
    evidence:
      requestedScore > confidenceCeiling
        ? [
            ...evidence,
            {
              code: "evidence-confidence-ceiling",
              message: `Score is capped at ${confidenceCeiling.toString()}/100 because this metric has ${normalizedConfidence.toString()}% static-analysis confidence.`
            }
          ]
        : evidence,
    affectedFiles: uniquePaths(affectedFiles),
    confidence: normalizedConfidence,
    recommendedActions
  };
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function getCycles(extraction: RepositoryExtraction) {
  const adjacency = new Map<string, string[]>();
  for (const edge of extraction.graph.edges) {
    if (!edge.sourceKey.startsWith("file:") || !edge.targetKey.startsWith("file:")) {
      continue;
    }

    adjacency.set(edge.sourceKey, [...(adjacency.get(edge.sourceKey) ?? []), edge.targetKey]);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleStarts = new Set<string>();
  const visit = (node: string): void => {
    visited.add(node);
    inStack.add(node);
    for (const neighbour of adjacency.get(node) ?? []) {
      if (!visited.has(neighbour)) {
        visit(neighbour);
      } else if (inStack.has(neighbour)) {
        cycleStarts.add(neighbour.replace(/^file:/, ""));
      }
    }
    inStack.delete(node);
  };

  for (const node of adjacency.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return [...cycleStarts];
}

function getLargeFiles(files: ExtractedFile[]) {
  return files
    .filter((file) => file.lineCount > 500)
    .sort((left, right) => right.lineCount - left.lineCount);
}

function getComplexFiles(files: ExtractedFile[]) {
  return files
    .filter((file) => file.complexity > 10)
    .sort((left, right) => right.complexity - left.complexity);
}

function scoreMaintainability(files: ExtractedFile[]) {
  const largeFiles = getLargeFiles(files);
  const complexFiles = getComplexFiles(files);
  const parseErrors = files.filter((file) => file.treeSitterHasError || file.parseError);
  const score = 100 - largeFiles.length * 5 - complexFiles.length * 4 - parseErrors.length * 8;
  const evidence: MetricEvidence[] = [
    { code: "source-files", message: `${files.length.toString()} source files were evaluated.` },
    ...fileEvidence(
      largeFiles,
      "large-file",
      (file) => `${file.lineCount.toString()} lines; large files are harder to change safely.`
    ),
    ...fileEvidence(
      complexFiles,
      "complex-file",
      (file) => `Structural complexity is ${file.complexity.toString()}.`
    ),
    ...fileEvidence(
      parseErrors,
      "parse-error",
      () => "Static parsing reported an incomplete or invalid syntax tree."
    )
  ];
  return makeMetric({
    score,
    explanation: `Maintainability is based on source-file size, structural complexity, and parser reliability.`,
    evidence,
    affectedFiles: [...largeFiles, ...complexFiles, ...parseErrors].map((file) => file.path),
    confidence: files.length > 0 ? 85 : 20,
    recommendedActions:
      largeFiles.length + complexFiles.length + parseErrors.length > 0
        ? [
            "Split the largest or most complex modules around clear responsibilities.",
            "Resolve files with parser errors before refactoring them."
          ]
        : ["Keep modules small and preserve the current static-analysis coverage."]
  });
}

function scoreTechnicalDebt(files: ExtractedFile[]) {
  const parseErrors = files.filter((file) => file.treeSitterHasError || file.parseError);
  const complexFiles = getComplexFiles(files);
  const largeFiles = getLargeFiles(files);
  const score = 100 - parseErrors.length * 15 - complexFiles.length * 6 - largeFiles.length * 4;
  return makeMetric({
    score,
    explanation:
      "Technical debt is estimated from directly observed parser failures, oversized files, and complex control flow.",
    evidence: [
      {
        code: "debt-signals",
        message: `${(parseErrors.length + complexFiles.length + largeFiles.length).toString()} static debt signals were found.`
      },
      ...fileEvidence(
        parseErrors,
        "parse-error",
        () => "Syntax recovery was required; this file should be stabilized first."
      ),
      ...fileEvidence(
        complexFiles,
        "complexity",
        (file) => `Complexity ${file.complexity.toString()} increases change cost.`
      )
    ],
    affectedFiles: [...parseErrors, ...complexFiles, ...largeFiles].map((file) => file.path),
    confidence: files.length > 0 ? 75 : 20,
    recommendedActions:
      parseErrors.length > 0
        ? [
            "Fix syntax or parser compatibility issues before adding more behavior.",
            "Prioritize refactors in the highest-complexity modules."
          ]
        : ["Track complexity growth so current debt levels remain stable."]
  });
}

function scoreArchitecture(extraction: RepositoryExtraction) {
  const cycles = getCycles(extraction);
  const fanOut = new Map<string, number>();
  for (const edge of extraction.graph.edges) {
    if (edge.sourceKey.startsWith("file:") && edge.targetKey.startsWith("file:")) {
      fanOut.set(edge.sourceKey, (fanOut.get(edge.sourceKey) ?? 0) + 1);
    }
  }
  const highFanOut = [...fanOut.entries()]
    .filter(([, count]) => count > 10)
    .sort((left, right) => right[1] - left[1]);
  const score = 100 - cycles.length * 12 - highFanOut.length * 6;
  return makeMetric({
    score,
    explanation:
      "Architecture integrity is derived from the internal import graph, with penalties for cycles and unusually high module fan-out.",
    evidence: [
      {
        code: "internal-graph",
        message: `${extraction.graph.nodes.length.toString()} graph nodes and ${extraction.graph.edges.length.toString()} edges were analyzed.`
      },
      ...cycles.map((path) => ({
        code: "circular-dependency",
        message: "This file participates in an internal dependency cycle.",
        filePath: path
      })),
      ...highFanOut.slice(0, maxAffectedFiles).map(([key, count]) => ({
        code: "high-fan-out",
        message: `Imports ${count.toString()} internal modules.`,
        filePath: key.replace(/^file:/, "")
      }))
    ],
    affectedFiles: [...cycles, ...highFanOut.map(([key]) => key.replace(/^file:/, ""))],
    confidence: extraction.files.length > 0 ? 82 : 20,
    recommendedActions:
      cycles.length > 0
        ? [
            "Break circular imports by extracting a lower-level shared contract or dependency inversion boundary.",
            "Reduce highly connected modules into focused orchestration and domain modules."
          ]
        : ["Keep dependency directions explicit as new modules are added."]
  });
}

function scorePerformance(files: ExtractedFile[]) {
  const synchronousIo = files.filter((file) => file.performanceSignals.includes("synchronous-io"));
  const databaseInLoop = files.filter((file) =>
    file.performanceSignals.includes("database-call-in-loop")
  );
  const score = 100 - synchronousIo.length * 12 - databaseInLoop.length * 18;
  return makeMetric({
    score,
    explanation:
      "Performance risk uses static signals only: synchronous filesystem operations and database calls found inside loops.",
    evidence: [
      {
        code: "performance-scope",
        message: `${files.length.toString()} source files were checked for supported static performance signals.`
      },
      ...fileEvidence(
        synchronousIo,
        "synchronous-io",
        () => "Synchronous filesystem I/O can block the event loop."
      ),
      ...fileEvidence(
        databaseInLoop,
        "database-call-in-loop",
        () => "A database call appears inside a loop and may cause N+1 behavior."
      )
    ],
    affectedFiles: [...synchronousIo, ...databaseInLoop].map((file) => file.path),
    confidence: files.length > 0 ? 62 : 20,
    recommendedActions:
      synchronousIo.length + databaseInLoop.length > 0
        ? [
            "Replace synchronous I/O on request paths with asynchronous APIs.",
            "Batch or prefetch database work that is currently performed per loop iteration."
          ]
        : ["Add runtime profiling before treating this static check as a performance guarantee."]
  });
}

function scoreSecurity(files: ExtractedFile[]) {
  const dynamicEvaluation = files.filter((file) =>
    file.securitySignals.includes("dynamic-evaluation")
  );
  const shellExecution = files.filter((file) => file.securitySignals.includes("shell-execution"));
  const hardcodedSecrets = files.filter((file) =>
    file.securitySignals.includes("hardcoded-secret")
  );
  const score =
    100 - dynamicEvaluation.length * 30 - shellExecution.length * 15 - hardcodedSecrets.length * 25;
  return makeMetric({
    score,
    explanation:
      "Security exposure is limited to static code signals; vulnerability and secret-scanning services are not included in this result.",
    evidence: [
      {
        code: "security-scope",
        message:
          "Only dynamic evaluation, shell execution, and hard-coded secret patterns were checked."
      },
      ...fileEvidence(
        dynamicEvaluation,
        "dynamic-evaluation",
        () => "Dynamic code evaluation was detected."
      ),
      ...fileEvidence(
        shellExecution,
        "shell-execution",
        () => "A shell-process API was detected; validate arguments and avoid shell interpolation."
      ),
      ...fileEvidence(
        hardcodedSecrets,
        "hardcoded-secret",
        () => "A possible hard-coded credential pattern was detected."
      )
    ],
    affectedFiles: [...dynamicEvaluation, ...shellExecution, ...hardcodedSecrets].map(
      (file) => file.path
    ),
    confidence: files.length > 0 ? 55 : 20,
    recommendedActions:
      dynamicEvaluation.length + shellExecution.length + hardcodedSecrets.length > 0
        ? [
            "Remove dynamic evaluation and replace shell interpolation with validated argument arrays.",
            "Move possible credentials to secret-managed environment variables and rotate them if confirmed."
          ]
        : [
            "Add dependency vulnerability scanning and dedicated secret scanning for broader coverage."
          ]
  });
}

function scoreComplexity(files: ExtractedFile[]) {
  const averageComplexity = average(files.map((file) => file.complexity));
  const complexFiles = getComplexFiles(files);
  const score = 100 - Math.max(0, averageComplexity - 4) * 7 - complexFiles.length * 5;
  return makeMetric({
    score,
    explanation: `Code complexity is based on cyclomatic-style branch counts; the repository average is ${averageComplexity.toFixed(1)}.`,
    evidence: [
      {
        code: "average-complexity",
        message: `Average structural complexity is ${averageComplexity.toFixed(1)} across ${files.length.toString()} files.`
      },
      ...fileEvidence(
        complexFiles,
        "high-complexity",
        (file) => `Structural complexity is ${file.complexity.toString()}.`
      )
    ],
    affectedFiles: complexFiles.map((file) => file.path),
    confidence: files.length > 0 ? 90 : 20,
    recommendedActions:
      complexFiles.length > 0
        ? [
            "Extract decision-heavy paths into smaller functions with focused tests.",
            "Use guard clauses to reduce nested branching."
          ]
        : ["Keep complexity low by reviewing new branching paths during code review."]
  });
}

function scoreTestConfidence(files: ExtractedFile[]) {
  const testFiles = files.filter((file) => file.isTestFile);
  const productionFiles = files.filter((file) => !file.isTestFile);
  const ratio = productionFiles.length === 0 ? 0 : testFiles.length / productionFiles.length;
  const score = productionFiles.length === 0 ? 20 : Math.min(100, 20 + ratio * 240);
  return makeMetric({
    score,
    explanation: `Test confidence uses detected test-file coverage: ${testFiles.length.toString()} test files for ${productionFiles.length.toString()} non-test source files.`,
    evidence: [
      {
        code: "test-file-ratio",
        message: `${testFiles.length.toString()} test files and ${productionFiles.length.toString()} production files were identified from file paths.`
      }
    ],
    affectedFiles:
      productionFiles.length > testFiles.length
        ? productionFiles.slice(0, maxAffectedFiles).map((file) => file.path)
        : [],
    confidence: files.length > 0 ? 78 : 20,
    recommendedActions:
      testFiles.length === 0
        ? ["Add tests around critical paths before relying on refactors or releases."]
        : ["Review test depth and assertions; file-count coverage is not execution coverage."]
  });
}

function scoreDependencyHealth(extraction: RepositoryExtraction) {
  const unstable = extraction.dependencies.filter((dependency) =>
    /^(?:\*|latest|git\+|https?:|github:)/.test(dependency.version)
  );
  const score = extraction.dependencies.length === 0 ? 55 : 100 - unstable.length * 18;
  return makeMetric({
    score,
    explanation:
      "Dependency health checks manifest declarations and does not claim vulnerability or freshness coverage.",
    evidence: [
      {
        code: "manifest-dependencies",
        message: `${extraction.dependencies.length.toString()} declared dependencies were read from package manifests.`
      },
      ...unstable.slice(0, maxAffectedFiles).map((dependency) => ({
        code: "unstable-version-source",
        message: `${dependency.name} uses the non-reproducible version source '${dependency.version}'.`,
        filePath: dependency.manifestPath
      }))
    ],
    affectedFiles: unstable.map((dependency) => dependency.manifestPath),
    confidence: extraction.dependencies.length > 0 ? 45 : 25,
    recommendedActions:
      unstable.length > 0
        ? [
            "Replace floating, Git, or URL dependency sources with reviewed version ranges and a lockfile.",
            "Add a vulnerability scanner before treating dependency health as release-ready."
          ]
        : ["Add vulnerability and license scanning to extend this manifest-only assessment."]
  });
}

export function computeMetrics(extraction: RepositoryExtraction): MetricsReport {
  const maintainability = scoreMaintainability(extraction.files);
  const technicalDebt = scoreTechnicalDebt(extraction.files);
  const architectureIntegrity = scoreArchitecture(extraction);
  const performanceRisk = scorePerformance(extraction.files);
  const securityExposure = scoreSecurity(extraction.files);
  const codeComplexity = scoreComplexity(extraction.files);
  const testConfidence = scoreTestConfidence(extraction.files);
  const dependencyHealth = scoreDependencyHealth(extraction);
  const productionReadiness = makeMetric({
    score:
      maintainability.score * 0.18 +
      architectureIntegrity.score * 0.16 +
      performanceRisk.score * 0.1 +
      securityExposure.score * 0.18 +
      testConfidence.score * 0.2 +
      dependencyHealth.score * 0.08 +
      technicalDebt.score * 0.1,
    explanation:
      "Production readiness combines static maintainability, architecture, performance, security, test, dependency, and debt signals.",
    evidence: [
      {
        code: "readiness-inputs",
        message: "This score aggregates only the other static metrics in this report."
      },
      {
        code: "test-confidence",
        message: `Test confidence score: ${testConfidence.score.toString()}.`
      },
      {
        code: "security-exposure",
        message: `Security exposure score: ${securityExposure.score.toString()}.`
      }
    ],
    affectedFiles: [
      ...testConfidence.affectedFiles,
      ...securityExposure.affectedFiles,
      ...technicalDebt.affectedFiles
    ],
    confidence: average([
      maintainability.confidence,
      architectureIntegrity.confidence,
      performanceRisk.confidence,
      securityExposure.confidence,
      testConfidence.confidence,
      dependencyHealth.confidence,
      technicalDebt.confidence
    ]),
    recommendedActions: [
      "Address the lowest-scoring metric before expanding release scope.",
      "Use runtime and security tooling to validate static readiness signals."
    ]
  });
  const overallHealth = makeMetric({
    score: average([
      maintainability.score,
      technicalDebt.score,
      architectureIntegrity.score,
      performanceRisk.score,
      securityExposure.score,
      codeComplexity.score,
      testConfidence.score,
      dependencyHealth.score,
      productionReadiness.score
    ]),
    explanation:
      "Overall health is the unweighted average of the engineering dimensions in this report.",
    evidence: [
      {
        code: "metric-aggregation",
        message: "Nine independently computed static metrics contributed to this overall score."
      }
    ],
    affectedFiles: [
      ...technicalDebt.affectedFiles,
      ...architectureIntegrity.affectedFiles,
      ...securityExposure.affectedFiles,
      ...testConfidence.affectedFiles
    ],
    confidence: average([
      maintainability.confidence,
      technicalDebt.confidence,
      architectureIntegrity.confidence,
      performanceRisk.confidence,
      securityExposure.confidence,
      codeComplexity.confidence,
      testConfidence.confidence,
      dependencyHealth.confidence,
      productionReadiness.confidence
    ]),
    recommendedActions: [
      "Start with the lowest-scoring dimension and use its evidence to select the first change."
    ]
  });

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    metrics: {
      overall_health: overallHealth,
      maintainability,
      technical_debt: technicalDebt,
      architecture_integrity: architectureIntegrity,
      performance_risk: performanceRisk,
      security_exposure: securityExposure,
      code_complexity: codeComplexity,
      test_confidence: testConfidence,
      dependency_health: dependencyHealth,
      production_readiness: productionReadiness
    }
  };
}
