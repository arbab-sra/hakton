import { createHash } from "node:crypto";

import { and, asc, eq } from "drizzle-orm";

import type { Database } from "@codemri/db";
import {
  apiRoutes,
  codeSymbols,
  databaseCalls,
  dependencyGraphEdges,
  dependencyGraphNodes,
  fileImports,
  repositories,
  repositoryDependencies,
  repositoryFiles,
  scanMetrics,
  scans,
  users
} from "@codemri/db/schema";
import { metricNames, type MetricName } from "@codemri/metrics";

type DrizzleDatabase = Database["database"];

const perKindLimit = 500;

export interface ContextFact {
  id: string;
  kind:
    | "metric"
    | "metric_evidence"
    | "file"
    | "symbol"
    | "import"
    | "dependency"
    | "api_route"
    | "database_call"
    | "graph_node"
    | "graph_edge";
  data: Record<string, unknown>;
}

export interface RepositoryContextBundle {
  scan: {
    id: string;
    repositoryId: string;
    repositoryFullName: string;
    branch: string;
    scanStatus: string;
  };
  facts: ContextFact[];
  factIds: Set<string>;
  fileFactIds: Set<string>;
  metricEvidenceFactIds: Record<MetricName, Set<string>>;
  metrics: Array<{
    metric: MetricName;
    score: number;
    severity: "low" | "medium" | "high" | "critical";
    confidence: number;
  }>;
  actorUserId: string;
  fingerprint: string;
}

function fact(id: string, kind: ContextFact["kind"], data: Record<string, unknown>): ContextFact {
  return { id, kind, data };
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function trimContext(facts: ContextFact[], maxChars: number) {
  const selected: ContextFact[] = [];
  let usedChars = 0;

  for (const entry of facts) {
    const size = JSON.stringify(entry).length;
    if (selected.length > 0 && usedChars + size > maxChars) {
      continue;
    }
    selected.push(entry);
    usedChars += size;
  }

  return selected;
}

function assertCompleteMetrics(
  metrics: Array<{ metric: string }>
): asserts metrics is Array<{ metric: MetricName }> {
  const names = new Set(metrics.map((metric) => metric.metric));
  const missing = metricNames.filter((metric) => !names.has(metric));
  if (missing.length > 0) {
    throw new Error(`AI analysis requires all metrics. Missing: ${missing.join(", ")}.`);
  }
}

export async function buildRepositoryContext({
  database,
  scanId,
  actorEmail,
  maxChars
}: {
  database: DrizzleDatabase;
  scanId: string;
  actorEmail: string;
  maxChars: number;
}): Promise<RepositoryContextBundle | undefined> {
  const [owner] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, actorEmail.toLowerCase()))
    .limit(1);

  if (!owner) {
    return undefined;
  }

  const [scan] = await database
    .select({
      id: scans.id,
      repositoryId: scans.repositoryId,
      repositoryFullName: repositories.fullName,
      branch: repositories.defaultBranch,
      status: scans.status
    })
    .from(scans)
    .innerJoin(repositories, eq(scans.repositoryId, repositories.id))
    .where(and(eq(scans.id, scanId), eq(repositories.userId, owner.id)))
    .limit(1);

  if (!scan) {
    return undefined;
  }

  const [metrics, files, symbols, imports, dependencies, routes, calls, nodes, edges] =
    await Promise.all([
      database
        .select()
        .from(scanMetrics)
        .where(eq(scanMetrics.scanId, scanId))
        .orderBy(asc(scanMetrics.metric)),
      database
        .select()
        .from(repositoryFiles)
        .where(eq(repositoryFiles.scanId, scanId))
        .orderBy(asc(repositoryFiles.path))
        .limit(perKindLimit),
      database
        .select()
        .from(codeSymbols)
        .innerJoin(repositoryFiles, eq(codeSymbols.fileId, repositoryFiles.id))
        .where(eq(repositoryFiles.scanId, scanId))
        .orderBy(asc(repositoryFiles.path), asc(codeSymbols.startLine))
        .limit(perKindLimit),
      database
        .select()
        .from(fileImports)
        .innerJoin(repositoryFiles, eq(fileImports.fileId, repositoryFiles.id))
        .where(eq(repositoryFiles.scanId, scanId))
        .orderBy(asc(repositoryFiles.path), asc(fileImports.startLine))
        .limit(perKindLimit),
      database
        .select()
        .from(repositoryDependencies)
        .where(eq(repositoryDependencies.scanId, scanId))
        .orderBy(asc(repositoryDependencies.name))
        .limit(perKindLimit),
      database
        .select()
        .from(apiRoutes)
        .innerJoin(repositoryFiles, eq(apiRoutes.fileId, repositoryFiles.id))
        .where(eq(apiRoutes.scanId, scanId))
        .orderBy(asc(repositoryFiles.path), asc(apiRoutes.startLine))
        .limit(perKindLimit),
      database
        .select()
        .from(databaseCalls)
        .innerJoin(repositoryFiles, eq(databaseCalls.fileId, repositoryFiles.id))
        .where(eq(databaseCalls.scanId, scanId))
        .orderBy(asc(repositoryFiles.path), asc(databaseCalls.startLine))
        .limit(perKindLimit),
      database
        .select()
        .from(dependencyGraphNodes)
        .where(eq(dependencyGraphNodes.scanId, scanId))
        .orderBy(asc(dependencyGraphNodes.nodeKey))
        .limit(perKindLimit),
      database
        .select()
        .from(dependencyGraphEdges)
        .where(eq(dependencyGraphEdges.scanId, scanId))
        .orderBy(asc(dependencyGraphEdges.id))
        .limit(perKindLimit)
    ]);

  assertCompleteMetrics(metrics);

  const facts: ContextFact[] = [];
  const metricEvidenceFactIds = Object.fromEntries(
    metricNames.map((metric) => [metric, new Set<string>()])
  ) as Record<MetricName, Set<string>>;

  for (const metric of metrics) {
    const summaryId = `fact:metric:${metric.metric}:summary`;
    metricEvidenceFactIds[metric.metric].add(summaryId);
    facts.push(
      fact(summaryId, "metric", {
        metric: metric.metric,
        score: metric.score,
        severity: metric.severity,
        staticExplanation: metric.explanation,
        confidence: metric.confidence,
        recommendedActions: metric.recommendedActions,
        affectedFileIds: metric.affectedFileIds
      })
    );
  }

  for (const metric of metrics) {
    metric.evidence.forEach((evidence, index) => {
      const evidenceId = `fact:metric:${metric.metric}:evidence:${index.toString()}`;
      metricEvidenceFactIds[metric.metric].add(evidenceId);
      facts.push(fact(evidenceId, "metric_evidence", evidence));
    });
  }

  const fileFactIds = new Set<string>();
  for (const file of files) {
    const id = `fact:file:${file.id}`;
    fileFactIds.add(id);
    facts.push(
      fact(id, "file", {
        path: file.path,
        language: file.language,
        sizeBytes: file.sizeBytes,
        lineCount: file.lineCount,
        treeSitterHasError: Boolean(file.treeSitterHasError),
        parseError: file.parseError
      })
    );
  }

  for (const { code_symbols: symbol, repository_files: file } of symbols) {
    facts.push(
      fact(`fact:symbol:${symbol.id}`, "symbol", {
        fileId: `fact:file:${file.id}`,
        path: file.path,
        name: symbol.name,
        kind: symbol.kind,
        exported: Boolean(symbol.exported),
        signature: symbol.signature,
        startLine: symbol.startLine,
        endLine: symbol.endLine
      })
    );
  }

  for (const { file_imports: imported, repository_files: file } of imports) {
    facts.push(
      fact(`fact:import:${imported.id}`, "import", {
        fileId: `fact:file:${file.id}`,
        path: file.path,
        moduleSpecifier: imported.moduleSpecifier,
        isRelative: Boolean(imported.isRelative),
        importedNames: imported.importedNames,
        startLine: imported.startLine,
        endLine: imported.endLine,
        targetFileId: imported.targetFileId ? `fact:file:${imported.targetFileId}` : null
      })
    );
  }

  for (const dependency of dependencies) {
    facts.push(
      fact(`fact:dependency:${dependency.id}`, "dependency", {
        manifestPath: dependency.manifestPath,
        name: dependency.name,
        version: dependency.version,
        dependencyType: dependency.dependencyType
      })
    );
  }

  for (const { api_routes: route, repository_files: file } of routes) {
    facts.push(
      fact(`fact:api-route:${route.id}`, "api_route", {
        fileId: `fact:file:${file.id}`,
        path: file.path,
        method: route.method,
        routePath: route.path,
        handlerName: route.handlerName,
        startLine: route.startLine
      })
    );
  }

  for (const { database_calls: call, repository_files: file } of calls) {
    facts.push(
      fact(`fact:database-call:${call.id}`, "database_call", {
        fileId: `fact:file:${file.id}`,
        path: file.path,
        clientName: call.clientName,
        operation: call.operation,
        expression: call.expression,
        startLine: call.startLine
      })
    );
  }

  const nodeFactIdByDatabaseId = new Map<string, string>();
  for (const node of nodes) {
    const id = `fact:graph-node:${node.id}`;
    nodeFactIdByDatabaseId.set(node.id, id);
    facts.push(
      fact(id, "graph_node", {
        nodeKey: node.nodeKey,
        nodeType: node.nodeType,
        label: node.label,
        fileId: node.fileId ? `fact:file:${node.fileId}` : null
      })
    );
  }

  for (const edge of edges) {
    facts.push(
      fact(`fact:graph-edge:${edge.id}`, "graph_edge", {
        sourceNodeId: nodeFactIdByDatabaseId.get(edge.sourceNodeId) ?? null,
        targetNodeId: nodeFactIdByDatabaseId.get(edge.targetNodeId) ?? null,
        edgeType: edge.edgeType,
        importFileId: edge.importFileId ? `fact:file:${edge.importFileId}` : null
      })
    );
  }

  const selectedFacts = trimContext(facts, maxChars);
  const factIds = new Set(selectedFacts.map((entry) => entry.id));
  const selectedMetricEvidenceFactIds = Object.fromEntries(
    metricNames.map((metric) => [
      metric,
      new Set([...metricEvidenceFactIds[metric]].filter((id) => factIds.has(id)))
    ])
  ) as Record<MetricName, Set<string>>;

  return {
    scan: {
      id: scan.id,
      repositoryId: scan.repositoryId,
      repositoryFullName: scan.repositoryFullName,
      branch: scan.branch,
      scanStatus: scan.status
    },
    facts: selectedFacts,
    factIds,
    fileFactIds: new Set([...fileFactIds].filter((id) => factIds.has(id))),
    metricEvidenceFactIds: selectedMetricEvidenceFactIds,
    metrics: metrics.map((metric) => ({
      metric: metric.metric,
      score: metric.score,
      severity: metric.severity,
      confidence: metric.confidence
    })),
    actorUserId: owner.id,
    fingerprint: fingerprint({ scanId: scan.id, facts: selectedFacts })
  };
}
