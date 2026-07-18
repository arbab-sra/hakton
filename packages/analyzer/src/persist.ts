import { eq } from "drizzle-orm";

import type { Database } from "@codemri/db";
import {
  apiRoutes,
  codeSymbols,
  databaseCalls,
  dependencyGraphEdges,
  dependencyGraphNodes,
  fileImports,
  repositoryDependencies,
  repositoryFiles
} from "@codemri/db/schema";

import type { RepositoryExtraction } from "./analyze";

type DrizzleDatabase = Database["database"];

function chunk<T>(values: T[], size = 250) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

function requireId(map: Map<string, string>, key: string, resource: string) {
  const id = map.get(key);
  if (!id) {
    throw new Error(`Could not resolve ${resource}: ${key}.`);
  }

  return id;
}

export async function persistRepositoryExtraction({
  database,
  scanId,
  repositoryId,
  extraction
}: {
  database: DrizzleDatabase;
  scanId: string;
  repositoryId: string;
  extraction: RepositoryExtraction;
}) {
  return database.transaction(async (transaction) => {
    await transaction.delete(dependencyGraphEdges).where(eq(dependencyGraphEdges.scanId, scanId));
    await transaction.delete(dependencyGraphNodes).where(eq(dependencyGraphNodes.scanId, scanId));
    await transaction.delete(apiRoutes).where(eq(apiRoutes.scanId, scanId));
    await transaction.delete(databaseCalls).where(eq(databaseCalls.scanId, scanId));
    await transaction
      .delete(repositoryDependencies)
      .where(eq(repositoryDependencies.scanId, scanId));
    await transaction.delete(repositoryFiles).where(eq(repositoryFiles.scanId, scanId));

    const fileIdByPath = new Map<string, string>();
    for (const entries of chunk(extraction.files)) {
      const inserted = await transaction
        .insert(repositoryFiles)
        .values(
          entries.map((file) => ({
            repositoryId,
            scanId,
            path: file.path,
            language: file.language,
            contentHash: file.contentHash,
            sizeBytes: file.sizeBytes,
            lineCount: file.lineCount,
            treeSitterHasError: file.treeSitterHasError ? 1 : 0,
            parseError: file.parseError ?? null
          }))
        )
        .returning({ id: repositoryFiles.id, path: repositoryFiles.path });
      for (const file of inserted) {
        fileIdByPath.set(file.path, file.id);
      }
    }

    const symbolRows = extraction.files.flatMap((file) => {
      const fileId = requireId(fileIdByPath, file.path, "file");
      return file.symbols.map((symbol) => ({
        fileId,
        name: symbol.name,
        kind: symbol.kind,
        exported: symbol.exported ? 1 : 0,
        defaultExport: symbol.defaultExport ? 1 : 0,
        parentName: symbol.parentName ?? null,
        signature: symbol.signature ?? null,
        startLine: symbol.startLine,
        endLine: symbol.endLine,
        startColumn: symbol.startColumn,
        endColumn: symbol.endColumn
      }));
    });
    for (const entries of chunk(symbolRows)) {
      if (entries.length > 0) {
        await transaction.insert(codeSymbols).values(entries);
      }
    }

    const importRows = extraction.files.flatMap((file) => {
      const fileId = requireId(fileIdByPath, file.path, "file");
      return file.imports.map((entry) => ({
        fileId,
        targetFileId: entry.targetPath ? (fileIdByPath.get(entry.targetPath) ?? null) : null,
        moduleSpecifier: entry.moduleSpecifier,
        importKind: entry.importKind,
        isRelative: entry.isRelative ? 1 : 0,
        importedNames: entry.importedNames,
        startLine: entry.startLine,
        endLine: entry.endLine
      }));
    });
    for (const entries of chunk(importRows)) {
      if (entries.length > 0) {
        await transaction.insert(fileImports).values(entries);
      }
    }

    const dependencyRows = extraction.dependencies.map((dependency) => ({
      scanId,
      manifestPath: dependency.manifestPath,
      name: dependency.name,
      version: dependency.version,
      dependencyType: dependency.dependencyType
    }));
    for (const entries of chunk(dependencyRows)) {
      if (entries.length > 0) {
        await transaction.insert(repositoryDependencies).values(entries);
      }
    }

    const routeRows = extraction.files.flatMap((file) => {
      const fileId = requireId(fileIdByPath, file.path, "file");
      return file.apiRoutes.map((route) => ({
        scanId,
        fileId,
        method: route.method,
        path: route.path,
        handlerName: route.handlerName ?? null,
        startLine: route.startLine
      }));
    });
    for (const entries of chunk(routeRows)) {
      if (entries.length > 0) {
        await transaction.insert(apiRoutes).values(entries);
      }
    }

    const databaseCallRows = extraction.files.flatMap((file) => {
      const fileId = requireId(fileIdByPath, file.path, "file");
      return file.databaseCalls.map((call) => ({
        scanId,
        fileId,
        clientName: call.clientName,
        operation: call.operation,
        expression: call.expression,
        startLine: call.startLine
      }));
    });
    for (const entries of chunk(databaseCallRows)) {
      if (entries.length > 0) {
        await transaction.insert(databaseCalls).values(entries);
      }
    }

    const nodeIdByKey = new Map<string, string>();
    for (const entries of chunk(extraction.graph.nodes)) {
      const inserted = await transaction
        .insert(dependencyGraphNodes)
        .values(
          entries.map((node) => ({
            scanId,
            nodeKey: node.key,
            nodeType: node.type,
            label: node.label,
            fileId: node.filePath ? (fileIdByPath.get(node.filePath) ?? null) : null
          }))
        )
        .returning({ id: dependencyGraphNodes.id, nodeKey: dependencyGraphNodes.nodeKey });
      for (const node of inserted) {
        nodeIdByKey.set(node.nodeKey, node.id);
      }
    }

    const graphEdgeRows = extraction.graph.edges.map((edge) => ({
      scanId,
      sourceNodeId: requireId(nodeIdByKey, edge.sourceKey, "graph source node"),
      targetNodeId: requireId(nodeIdByKey, edge.targetKey, "graph target node"),
      edgeType: edge.edgeType,
      importFileId: fileIdByPath.get(edge.importFilePath) ?? null
    }));
    for (const entries of chunk(graphEdgeRows)) {
      if (entries.length > 0) {
        await transaction.insert(dependencyGraphEdges).values(entries);
      }
    }

    return {
      files: extraction.files.length,
      imports: importRows.length,
      symbols: symbolRows.length,
      dependencies: dependencyRows.length,
      apiRoutes: routeRows.length,
      databaseCalls: databaseCallRows.length,
      graphNodes: nodeIdByKey.size,
      graphEdges: graphEdgeRows.length
    };
  });
}
