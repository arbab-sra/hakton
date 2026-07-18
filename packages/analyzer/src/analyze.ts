import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { posix } from "node:path";

import Parser from "tree-sitter";
import JavaScript from "tree-sitter-javascript";
import TypeScript from "tree-sitter-typescript";
import { Node, Project, SyntaxKind, type SourceFile } from "ts-morph";

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "vendor"
]);
const httpMethods = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]);
const databaseOperations = new Set([
  "select",
  "insert",
  "update",
  "delete",
  "execute",
  "query",
  "transaction"
]);

export type SourceLanguage = "typescript" | "tsx" | "javascript" | "jsx";

export interface ExtractedSymbol {
  name: string;
  kind: "function" | "method" | "class" | "interface" | "variable";
  exported: boolean;
  defaultExport: boolean;
  parentName?: string;
  signature?: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface ExtractedImport {
  moduleSpecifier: string;
  importKind: "import" | "re-export";
  isRelative: boolean;
  importedNames: string[];
  targetPath?: string;
  startLine: number;
  endLine: number;
}

export interface ExtractedApiRoute {
  method: string;
  path: string;
  handlerName?: string;
  startLine: number;
}

export interface ExtractedDatabaseCall {
  clientName: string;
  operation: string;
  expression: string;
  startLine: number;
}

export interface ExtractedFile {
  path: string;
  language: SourceLanguage;
  contentHash: string;
  sizeBytes: number;
  lineCount: number;
  complexity: number;
  isTestFile: boolean;
  treeSitterHasError: boolean;
  parseError?: string;
  securitySignals: Array<"dynamic-evaluation" | "shell-execution" | "hardcoded-secret">;
  performanceSignals: Array<"synchronous-io" | "database-call-in-loop">;
  symbols: ExtractedSymbol[];
  imports: ExtractedImport[];
  apiRoutes: ExtractedApiRoute[];
  databaseCalls: ExtractedDatabaseCall[];
}

export interface ExtractedDependency {
  manifestPath: string;
  name: string;
  version: string;
  dependencyType: "dependency" | "devDependency" | "peerDependency" | "optionalDependency";
}

export interface DependencyGraphNode {
  key: string;
  type: "file" | "external-module";
  label: string;
  filePath?: string;
}

export interface DependencyGraphEdge {
  sourceKey: string;
  targetKey: string;
  edgeType: "imports" | "re-exports";
  importFilePath: string;
}

export interface RepositoryExtraction {
  files: ExtractedFile[];
  dependencies: ExtractedDependency[];
  graph: { nodes: DependencyGraphNode[]; edges: DependencyGraphEdge[] };
}

export interface AnalyzeRepositoryOptions {
  maxFiles: number;
  maxFileBytes: number;
}

interface DiscoveredFile {
  absolutePath: string;
  relativePath: string;
}

function normalizePath(path: string) {
  return path.split("\\").join("/");
}

function getLanguage(path: string): SourceLanguage | undefined {
  switch (extname(path).toLowerCase()) {
    case ".ts":
      return "typescript";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "javascript";
    case ".jsx":
      return "jsx";
    default:
      return undefined;
  }
}

async function discoverFiles(root: string, options: AnalyzeRepositoryOptions) {
  const sourceFiles: DiscoveredFile[] = [];
  const manifestFiles: DiscoveredFile[] = [];

  async function visit(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
        continue;
      }

      const absolutePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const relativePath = normalizePath(relative(root, absolutePath));
      if (entry.name === "package.json") {
        manifestFiles.push({ absolutePath, relativePath });
      }

      if (getLanguage(relativePath)) {
        sourceFiles.push({ absolutePath, relativePath });
        if (sourceFiles.length > options.maxFiles) {
          throw new Error(
            `Repository exceeds the ${options.maxFiles.toString()} source-file limit.`
          );
        }
      }
    }
  }

  await visit(root);
  return { sourceFiles, manifestFiles };
}

function getTreeSitterLanguage(language: SourceLanguage) {
  if (language === "typescript") {
    return TypeScript.typescript;
  }

  if (language === "tsx") {
    return TypeScript.tsx;
  }

  return JavaScript;
}

function location(node: Node) {
  const sourceFile = node.getSourceFile();
  const start = sourceFile.getLineAndColumnAtPos(node.getStart());
  const end = sourceFile.getLineAndColumnAtPos(node.getEnd());

  return {
    startLine: start.line,
    endLine: end.line,
    startColumn: start.column,
    endColumn: end.column
  };
}

function compactText(value: string, maxLength = 1_000) {
  const compacted = value.replace(/\s+/g, " ").trim();
  return compacted.length > maxLength ? `${compacted.slice(0, maxLength - 1)}…` : compacted;
}

function getPackageName(moduleSpecifier: string) {
  if (moduleSpecifier.startsWith("@")) {
    return moduleSpecifier.split("/").slice(0, 2).join("/");
  }

  return moduleSpecifier.split("/")[0] ?? moduleSpecifier;
}

function resolveRelativeImport(fromPath: string, moduleSpecifier: string, allPaths: Set<string>) {
  if (!moduleSpecifier.startsWith(".")) {
    return undefined;
  }

  const withoutExtension = posix.normalize(posix.join(posix.dirname(fromPath), moduleSpecifier));
  const candidates = [
    withoutExtension,
    ...[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].map(
      (extension) => `${withoutExtension}${extension}`
    ),
    ...["index.ts", "index.tsx", "index.js", "index.jsx", "index.mjs", "index.cjs"].map((file) =>
      posix.join(withoutExtension, file)
    )
  ];

  if (/\.(?:js|jsx|mjs|cjs)$/.test(withoutExtension)) {
    candidates.push(withoutExtension.replace(/\.(?:js|jsx|mjs|cjs)$/, ".ts"));
    candidates.push(withoutExtension.replace(/\.(?:js|jsx|mjs|cjs)$/, ".tsx"));
  }

  return candidates.find((candidate) => allPaths.has(candidate));
}

function extractImports(sourceFile: SourceFile, allPaths: Set<string>): ExtractedImport[] {
  const imports: ExtractedImport[] = [];
  const addImport = (
    moduleSpecifier: string,
    importKind: ExtractedImport["importKind"],
    importedNames: string[],
    node: Node
  ) => {
    const resolvedPath = resolveRelativeImport(sourceFile.getFilePath(), moduleSpecifier, allPaths);
    imports.push({
      moduleSpecifier,
      importKind,
      isRelative: moduleSpecifier.startsWith("."),
      importedNames,
      targetPath: resolvedPath,
      startLine: node.getStartLineNumber(),
      endLine: node.getEndLineNumber()
    });
  };

  for (const declaration of sourceFile.getImportDeclarations()) {
    const names = [
      declaration.getDefaultImport()?.getText(),
      declaration.getNamespaceImport()?.getText(),
      ...declaration
        .getNamedImports()
        .map((item) => item.getAliasNode()?.getText() ?? item.getName())
    ].filter((name): name is string => Boolean(name));
    addImport(declaration.getModuleSpecifierValue(), "import", names, declaration);
  }

  for (const declaration of sourceFile.getExportDeclarations()) {
    const moduleSpecifier = declaration.getModuleSpecifierValue();
    if (!moduleSpecifier) {
      continue;
    }

    const names = declaration
      .getNamedExports()
      .map((item) => item.getAliasNode()?.getText() ?? item.getName());
    addImport(moduleSpecifier, "re-export", names, declaration);
  }

  return imports;
}

function extractSymbols(sourceFile: SourceFile): ExtractedSymbol[] {
  const symbols: ExtractedSymbol[] = [];
  const addSymbol = (
    node: Node,
    name: string | undefined,
    kind: ExtractedSymbol["kind"],
    exported: boolean,
    defaultExport: boolean,
    parentName?: string
  ) => {
    if (!name) {
      return;
    }

    symbols.push({
      name,
      kind,
      exported,
      defaultExport,
      parentName,
      signature: compactText(node.getText(), 500),
      ...location(node)
    });
  };

  for (const declaration of sourceFile.getFunctions()) {
    addSymbol(
      declaration,
      declaration.getName(),
      "function",
      declaration.isExported(),
      declaration.isDefaultExport()
    );
  }

  for (const declaration of sourceFile.getClasses()) {
    addSymbol(
      declaration,
      declaration.getName(),
      "class",
      declaration.isExported(),
      declaration.isDefaultExport()
    );
  }

  for (const declaration of sourceFile.getInterfaces()) {
    addSymbol(declaration, declaration.getName(), "interface", declaration.isExported(), false);
  }

  for (const declaration of sourceFile.getVariableStatements()) {
    if (!declaration.isExported()) {
      continue;
    }

    for (const variable of declaration.getDeclarations()) {
      addSymbol(variable, variable.getName(), "variable", true, declaration.isDefaultExport());
    }
  }

  for (const declaration of sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration)) {
    const parentClass = declaration.getFirstAncestorByKind(SyntaxKind.ClassDeclaration)?.getName();
    addSymbol(declaration, declaration.getName(), "method", false, false, parentClass);
  }

  return symbols;
}

function getRoutePath(path: string) {
  const appRoute = path.match(/(?:^|\/)app\/api\/(.+)\/route\.[^.]+$/);
  if (appRoute) {
    return `/api/${appRoute[1]?.replaceAll(/\[([^\]]+)\]/g, ":$1") ?? ""}`;
  }

  const rootAppRoute = path.match(/(?:^|\/)app\/api\/route\.[^.]+$/);
  if (rootAppRoute) {
    return "/api";
  }

  const pagesRoute = path.match(/(?:^|\/)pages\/api\/(.+)\.[^.]+$/);
  if (pagesRoute) {
    return `/api/${pagesRoute[1]?.replace(/\/index$/, "") ?? ""}`;
  }

  return undefined;
}

function extractApiRoutes(sourceFile: SourceFile): ExtractedApiRoute[] {
  const path = getRoutePath(sourceFile.getFilePath());
  if (!path) {
    return [];
  }

  const routes: ExtractedApiRoute[] = [];
  for (const declaration of sourceFile.getFunctions()) {
    const name = declaration.getName();
    if (name && declaration.isExported() && httpMethods.has(name)) {
      routes.push({
        method: name,
        path,
        handlerName: name,
        startLine: declaration.getStartLineNumber()
      });
    }
  }

  for (const statement of sourceFile.getVariableStatements()) {
    if (!statement.isExported()) {
      continue;
    }

    for (const declaration of statement.getDeclarations()) {
      const name = declaration.getName();
      if (httpMethods.has(name)) {
        routes.push({
          method: name,
          path,
          handlerName: name,
          startLine: declaration.getStartLineNumber()
        });
      }
    }
  }

  return routes;
}

function extractDatabaseCalls(sourceFile: SourceFile): ExtractedDatabaseCall[] {
  const calls: ExtractedDatabaseCall[] = [];

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression();
    if (!Node.isPropertyAccessExpression(expression)) {
      continue;
    }

    const operation = expression.getName();
    const clientName = expression.getExpression().getText();
    if (
      !databaseOperations.has(operation) ||
      !/(?:^|\.)(?:db|database|prisma|sql|client)$/i.test(clientName)
    ) {
      continue;
    }

    calls.push({
      clientName,
      operation,
      expression: compactText(call.getText()),
      startLine: call.getStartLineNumber()
    });
  }

  return calls;
}

function extractComplexity(sourceFile: SourceFile) {
  const branches = [
    SyntaxKind.IfStatement,
    SyntaxKind.CaseClause,
    SyntaxKind.CatchClause,
    SyntaxKind.ConditionalExpression,
    SyntaxKind.ForInStatement,
    SyntaxKind.ForOfStatement,
    SyntaxKind.ForStatement,
    SyntaxKind.WhileStatement,
    SyntaxKind.DoStatement
  ];

  return (
    1 + branches.reduce((total, kind) => total + sourceFile.getDescendantsOfKind(kind).length, 0)
  );
}

function extractSecuritySignals(source: string) {
  const signals = new Set<ExtractedFile["securitySignals"][number]>();
  if (/\b(?:eval|Function)\s*\(/.test(source)) {
    signals.add("dynamic-evaluation");
  }
  if (/\b(?:exec|execFile|spawn|spawnSync)\s*\(/.test(source)) {
    signals.add("shell-execution");
  }
  if (/(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i.test(source)) {
    signals.add("hardcoded-secret");
  }

  return [...signals];
}

function extractPerformanceSignals(sourceFile: SourceFile, databaseCalls: ExtractedDatabaseCall[]) {
  const signals = new Set<ExtractedFile["performanceSignals"][number]>();
  if (/\b(?:readFileSync|writeFileSync|readdirSync|statSync)\s*\(/.test(sourceFile.getFullText())) {
    signals.add("synchronous-io");
  }

  if (databaseCalls.length > 0) {
    const loops = sourceFile
      .getDescendants()
      .filter((node) =>
        [
          SyntaxKind.ForInStatement,
          SyntaxKind.ForOfStatement,
          SyntaxKind.ForStatement,
          SyntaxKind.WhileStatement,
          SyntaxKind.DoStatement
        ].includes(node.getKind())
      );
    const hasDatabaseCallInLoop = loops.some((loop) =>
      databaseCalls.some(
        (call) =>
          call.startLine >= loop.getStartLineNumber() && call.startLine <= loop.getEndLineNumber()
      )
    );
    if (hasDatabaseCallInLoop) {
      signals.add("database-call-in-loop");
    }
  }

  return [...signals];
}

async function extractManifestDependencies(manifests: DiscoveredFile[]) {
  const dependencies: ExtractedDependency[] = [];
  const sections = [
    ["dependencies", "dependency"],
    ["devDependencies", "devDependency"],
    ["peerDependencies", "peerDependency"],
    ["optionalDependencies", "optionalDependency"]
  ] as const;

  for (const manifest of manifests) {
    try {
      const raw = await readFile(manifest.absolutePath, "utf8");
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        continue;
      }

      const record = parsed as Record<string, unknown>;
      for (const [section, dependencyType] of sections) {
        const dependencyRecord = record[section];
        if (
          !dependencyRecord ||
          typeof dependencyRecord !== "object" ||
          Array.isArray(dependencyRecord)
        ) {
          continue;
        }

        for (const [name, version] of Object.entries(dependencyRecord)) {
          if (typeof version === "string") {
            dependencies.push({
              manifestPath: manifest.relativePath,
              name,
              version,
              dependencyType
            });
          }
        }
      }
    } catch {
      // Invalid package manifests are not source files and do not invalidate a repository extraction.
    }
  }

  return dependencies;
}

export async function analyzeRepository(
  repositoryPath: string,
  options: AnalyzeRepositoryOptions
): Promise<RepositoryExtraction> {
  const { sourceFiles, manifestFiles } = await discoverFiles(repositoryPath, options);
  const readableFiles: Array<{
    path: string;
    language: SourceLanguage;
    source: string;
    sizeBytes: number;
  }> = [];

  for (const file of sourceFiles) {
    const metadata = await stat(file.absolutePath);
    if (metadata.size > options.maxFileBytes) {
      continue;
    }

    readableFiles.push({
      path: file.relativePath,
      language: getLanguage(file.relativePath) as SourceLanguage,
      source: await readFile(file.absolutePath, "utf8"),
      sizeBytes: metadata.size
    });
  }

  const allPaths = new Set(readableFiles.map((file) => file.path));
  const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { allowJs: true } });
  const parser = new Parser();
  const files: ExtractedFile[] = [];

  for (const file of readableFiles) {
    let treeSitterHasError = false;
    try {
      parser.setLanguage(getTreeSitterLanguage(file.language));
      treeSitterHasError = parser.parse(file.source).rootNode.hasError;
    } catch {
      treeSitterHasError = true;
    }

    const sourceFile = project.createSourceFile(file.path, file.source, { overwrite: true });
    let parseError: string | undefined;
    let symbols: ExtractedSymbol[] = [];
    let imports: ExtractedImport[] = [];
    let apiRoutes: ExtractedApiRoute[] = [];
    let databaseCalls: ExtractedDatabaseCall[] = [];
    let complexity = 1;

    try {
      symbols = extractSymbols(sourceFile);
      imports = extractImports(sourceFile, allPaths);
      apiRoutes = extractApiRoutes(sourceFile);
      databaseCalls = extractDatabaseCalls(sourceFile);
      complexity = extractComplexity(sourceFile);
    } catch {
      parseError = "ts-morph could not extract all symbols from this file.";
    }

    files.push({
      path: file.path,
      language: file.language,
      contentHash: createHash("sha256").update(file.source).digest("hex"),
      sizeBytes: file.sizeBytes,
      lineCount: file.source === "" ? 0 : file.source.split(/\r?\n/).length,
      complexity,
      isTestFile: /(?:^|\/)(?:__tests__\/|.*\.(?:test|spec)\.[^.]+$)/.test(file.path),
      treeSitterHasError,
      parseError,
      securitySignals: extractSecuritySignals(file.source),
      performanceSignals: extractPerformanceSignals(sourceFile, databaseCalls),
      symbols,
      imports,
      apiRoutes,
      databaseCalls
    });
  }

  const nodes = new Map<string, DependencyGraphNode>();
  const edges = new Map<string, DependencyGraphEdge>();
  for (const file of files) {
    const sourceKey = `file:${file.path}`;
    nodes.set(sourceKey, { key: sourceKey, type: "file", label: file.path, filePath: file.path });

    for (const entry of file.imports) {
      const targetKey = entry.targetPath
        ? `file:${entry.targetPath}`
        : `module:${getPackageName(entry.moduleSpecifier)}`;
      if (!nodes.has(targetKey)) {
        nodes.set(targetKey, {
          key: targetKey,
          type: entry.targetPath ? "file" : "external-module",
          label: entry.targetPath ?? getPackageName(entry.moduleSpecifier),
          filePath: entry.targetPath
        });
      }

      const edgeType = entry.importKind === "re-export" ? "re-exports" : "imports";
      const edgeKey = `${sourceKey}:${targetKey}:${edgeType}`;
      edges.set(edgeKey, { sourceKey, targetKey, edgeType, importFilePath: file.path });
    }
  }

  return {
    files,
    dependencies: await extractManifestDependencies(manifestFiles),
    graph: { nodes: [...nodes.values()], edges: [...edges.values()] }
  };
}
