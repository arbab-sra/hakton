import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const repositoryStatusEnum = pgEnum("repository_status", [
  "pending",
  "cloning",
  "ready",
  "failed"
]);

export const scanStatusEnum = pgEnum("scan_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
]);

export const scanStageEnum = pgEnum("scan_stage", [
  "clone",
  "parse",
  "graph",
  "metrics",
  "embeddings",
  "ai",
  "report"
]);

export const scanJobStatusEnum = pgEnum("scan_job_status", [
  "queued",
  "active",
  "completed",
  "failed"
]);

export const metricNameEnum = pgEnum("metric_name", [
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
]);

export const metricSeverityEnum = pgEnum("metric_severity", ["low", "medium", "high", "critical"]);

export const aiAnalysisStatusEnum = pgEnum("ai_analysis_status", [
  "running",
  "completed",
  "failed"
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refreshToken: text("refresh_token"),
    accessToken: text("access_token"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    tokenType: text("token_type"),
    scope: text("scope"),
    idToken: text("id_token"),
    sessionState: text("session_state")
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable(
  "sessions",
  {
    sessionToken: text("session_token").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { withTimezone: true }).notNull()
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull()
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

export const repositories = pgTable(
  "repositories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("github"),
    providerRepositoryId: text("provider_repository_id").notNull(),
    owner: text("owner").notNull(),
    name: text("name").notNull(),
    fullName: text("full_name").notNull(),
    url: text("url").notNull(),
    cloneUrl: text("clone_url").notNull(),
    defaultBranch: text("default_branch").notNull(),
    visibility: text("visibility").notNull(),
    status: repositoryStatusEnum("status").notNull().default("pending"),
    lastCloneCommit: text("last_clone_commit"),
    lastClonedAt: timestamp("last_cloned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("repositories_user_provider_remote_idx").on(
      table.userId,
      table.provider,
      table.providerRepositoryId
    ),
    index("repositories_user_updated_idx").on(table.userId, table.updatedAt)
  ]
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: scanStatusEnum("status").notNull().default("queued"),
    currentStage: scanStageEnum("current_stage").notNull().default("clone"),
    progress: integer("progress").notNull().default(0),
    clonePath: text("clone_path"),
    cloneCommit: text("clone_commit"),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("scans_repository_created_idx").on(table.repositoryId, table.createdAt),
    index("scans_requester_created_idx").on(table.requestedByUserId, table.createdAt),
    check("scans_progress_range", sql`${table.progress} >= 0 AND ${table.progress} <= 100`)
  ]
);

export const scanJobs = pgTable(
  "scan_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    stage: scanStageEnum("stage").notNull(),
    status: scanJobStatusEnum("status").notNull().default("queued"),
    attemptCount: integer("attempt_count").notNull().default(0),
    bullmqJobId: text("bullmq_job_id").notNull().unique(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [index("scan_jobs_scan_stage_idx").on(table.scanId, table.stage)]
);

export const scanProgressEvents = pgTable(
  "scan_progress_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    stage: scanStageEnum("stage").notNull(),
    status: scanStatusEnum("status").notNull(),
    progress: integer("progress").notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    index("scan_progress_events_scan_created_idx").on(table.scanId, table.createdAt),
    check(
      "scan_progress_events_progress_range",
      sql`${table.progress} >= 0 AND ${table.progress} <= 100`
    )
  ]
);

export const repositoryFiles = pgTable(
  "repository_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    repositoryId: uuid("repository_id")
      .notNull()
      .references(() => repositories.id, { onDelete: "cascade" }),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    language: text("language").notNull(),
    contentHash: text("content_hash").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    lineCount: integer("line_count").notNull(),
    treeSitterHasError: integer("tree_sitter_has_error").notNull().default(0),
    parseError: text("parse_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("repository_files_scan_path_idx").on(table.scanId, table.path),
    index("repository_files_repository_path_idx").on(table.repositoryId, table.path)
  ]
);

export const codeSymbols = pgTable(
  "code_symbols",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repositoryFiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    exported: integer("exported").notNull().default(0),
    defaultExport: integer("default_export").notNull().default(0),
    parentName: text("parent_name"),
    signature: text("signature"),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull(),
    startColumn: integer("start_column").notNull(),
    endColumn: integer("end_column").notNull()
  },
  (table) => [index("code_symbols_file_name_idx").on(table.fileId, table.name)]
);

export const fileImports = pgTable(
  "file_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repositoryFiles.id, { onDelete: "cascade" }),
    targetFileId: uuid("target_file_id").references(() => repositoryFiles.id, {
      onDelete: "set null"
    }),
    moduleSpecifier: text("module_specifier").notNull(),
    importKind: text("import_kind").notNull(),
    isRelative: integer("is_relative").notNull().default(0),
    importedNames: jsonb("imported_names").$type<string[]>().notNull().default([]),
    startLine: integer("start_line").notNull(),
    endLine: integer("end_line").notNull()
  },
  (table) => [
    index("file_imports_file_idx").on(table.fileId),
    index("file_imports_target_idx").on(table.targetFileId)
  ]
);

export const repositoryDependencies = pgTable(
  "repository_dependencies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    manifestPath: text("manifest_path").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    dependencyType: text("dependency_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("repository_dependencies_scan_manifest_name_idx").on(
      table.scanId,
      table.manifestPath,
      table.name
    ),
    index("repository_dependencies_scan_name_idx").on(table.scanId, table.name)
  ]
);

export const apiRoutes = pgTable(
  "api_routes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repositoryFiles.id, { onDelete: "cascade" }),
    method: text("method").notNull(),
    path: text("path").notNull(),
    handlerName: text("handler_name"),
    startLine: integer("start_line").notNull()
  },
  (table) => [index("api_routes_scan_path_idx").on(table.scanId, table.path)]
);

export const databaseCalls = pgTable(
  "database_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    fileId: uuid("file_id")
      .notNull()
      .references(() => repositoryFiles.id, { onDelete: "cascade" }),
    clientName: text("client_name").notNull(),
    operation: text("operation").notNull(),
    expression: text("expression").notNull(),
    startLine: integer("start_line").notNull()
  },
  (table) => [index("database_calls_scan_file_idx").on(table.scanId, table.fileId)]
);

export const dependencyGraphNodes = pgTable(
  "dependency_graph_nodes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    nodeKey: text("node_key").notNull(),
    nodeType: text("node_type").notNull(),
    label: text("label").notNull(),
    fileId: uuid("file_id").references(() => repositoryFiles.id, { onDelete: "cascade" })
  },
  (table) => [
    uniqueIndex("dependency_graph_nodes_scan_key_idx").on(table.scanId, table.nodeKey),
    index("dependency_graph_nodes_scan_type_idx").on(table.scanId, table.nodeType)
  ]
);

export const dependencyGraphEdges = pgTable(
  "dependency_graph_edges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    sourceNodeId: uuid("source_node_id")
      .notNull()
      .references(() => dependencyGraphNodes.id, { onDelete: "cascade" }),
    targetNodeId: uuid("target_node_id")
      .notNull()
      .references(() => dependencyGraphNodes.id, { onDelete: "cascade" }),
    edgeType: text("edge_type").notNull(),
    importFileId: uuid("import_file_id").references(() => repositoryFiles.id, {
      onDelete: "set null"
    })
  },
  (table) => [index("dependency_graph_edges_scan_source_idx").on(table.scanId, table.sourceNodeId)]
);

export const scanMetrics = pgTable(
  "scan_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    metric: metricNameEnum("metric").notNull(),
    score: integer("score").notNull(),
    severity: metricSeverityEnum("severity").notNull(),
    explanation: text("explanation").notNull(),
    evidence: jsonb("evidence")
      .$type<Array<{ code: string; message: string; filePath?: string }>>()
      .notNull(),
    affectedFileIds: jsonb("affected_file_ids").$type<string[]>().notNull().default([]),
    confidence: integer("confidence").notNull(),
    recommendedActions: jsonb("recommended_actions").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("scan_metrics_scan_metric_idx").on(table.scanId, table.metric),
    check("scan_metrics_score_range", sql`${table.score} >= 0 AND ${table.score} <= 100`),
    check(
      "scan_metrics_confidence_range",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 100`
    )
  ]
);

export const aiAnalysisRuns = pgTable(
  "ai_analysis_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    status: aiAnalysisStatusEnum("status").notNull().default("running"),
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull(),
    contextFingerprint: text("context_fingerprint").notNull(),
    result: jsonb("result").$type<unknown>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [index("ai_analysis_runs_scan_created_idx").on(table.scanId, table.createdAt)]
);

export const repositoryQuestions = pgTable(
  "repository_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    analysisRunId: uuid("analysis_run_id").references(() => aiAnalysisRuns.id, {
      onDelete: "set null"
    }),
    model: text("model").notNull(),
    contextFingerprint: text("context_fingerprint").notNull(),
    question: text("question").notNull(),
    answer: jsonb("answer").$type<unknown>(),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true })
  },
  (table) => [
    index("repository_questions_scan_created_idx").on(table.scanId, table.createdAt),
    index("repository_questions_user_created_idx").on(table.userId, table.createdAt)
  ]
);

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  repositories: many(repositories),
  requestedScans: many(scans),
  repositoryQuestions: many(repositoryQuestions)
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id]
  })
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id]
  })
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  user: one(users, {
    fields: [repositories.userId],
    references: [users.id]
  }),
  scans: many(scans)
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [scans.repositoryId],
    references: [repositories.id]
  }),
  requestedByUser: one(users, {
    fields: [scans.requestedByUserId],
    references: [users.id]
  }),
  jobs: many(scanJobs),
  progressEvents: many(scanProgressEvents),
  aiAnalysisRuns: many(aiAnalysisRuns),
  repositoryQuestions: many(repositoryQuestions)
}));

export const scanJobsRelations = relations(scanJobs, ({ one }) => ({
  scan: one(scans, {
    fields: [scanJobs.scanId],
    references: [scans.id]
  })
}));

export const scanProgressEventsRelations = relations(scanProgressEvents, ({ one }) => ({
  scan: one(scans, {
    fields: [scanProgressEvents.scanId],
    references: [scans.id]
  })
}));

export const repositoryFilesRelations = relations(repositoryFiles, ({ one, many }) => ({
  repository: one(repositories, {
    fields: [repositoryFiles.repositoryId],
    references: [repositories.id]
  }),
  scan: one(scans, {
    fields: [repositoryFiles.scanId],
    references: [scans.id]
  }),
  symbols: many(codeSymbols),
  imports: many(fileImports, { relationName: "source_file_imports" }),
  importedBy: many(fileImports, { relationName: "target_file_imports" }),
  apiRoutes: many(apiRoutes),
  databaseCalls: many(databaseCalls),
  graphNodes: many(dependencyGraphNodes)
}));

export const codeSymbolsRelations = relations(codeSymbols, ({ one }) => ({
  file: one(repositoryFiles, {
    fields: [codeSymbols.fileId],
    references: [repositoryFiles.id]
  })
}));

export const fileImportsRelations = relations(fileImports, ({ one }) => ({
  file: one(repositoryFiles, {
    fields: [fileImports.fileId],
    references: [repositoryFiles.id],
    relationName: "source_file_imports"
  }),
  targetFile: one(repositoryFiles, {
    fields: [fileImports.targetFileId],
    references: [repositoryFiles.id],
    relationName: "target_file_imports"
  })
}));

export const repositoryDependenciesRelations = relations(repositoryDependencies, ({ one }) => ({
  scan: one(scans, {
    fields: [repositoryDependencies.scanId],
    references: [scans.id]
  })
}));

export const apiRoutesRelations = relations(apiRoutes, ({ one }) => ({
  scan: one(scans, { fields: [apiRoutes.scanId], references: [scans.id] }),
  file: one(repositoryFiles, { fields: [apiRoutes.fileId], references: [repositoryFiles.id] })
}));

export const databaseCallsRelations = relations(databaseCalls, ({ one }) => ({
  scan: one(scans, { fields: [databaseCalls.scanId], references: [scans.id] }),
  file: one(repositoryFiles, { fields: [databaseCalls.fileId], references: [repositoryFiles.id] })
}));

export const dependencyGraphNodesRelations = relations(dependencyGraphNodes, ({ one, many }) => ({
  scan: one(scans, { fields: [dependencyGraphNodes.scanId], references: [scans.id] }),
  file: one(repositoryFiles, {
    fields: [dependencyGraphNodes.fileId],
    references: [repositoryFiles.id]
  }),
  outgoingEdges: many(dependencyGraphEdges, { relationName: "source_graph_node" }),
  incomingEdges: many(dependencyGraphEdges, { relationName: "target_graph_node" })
}));

export const dependencyGraphEdgesRelations = relations(dependencyGraphEdges, ({ one }) => ({
  scan: one(scans, { fields: [dependencyGraphEdges.scanId], references: [scans.id] }),
  source: one(dependencyGraphNodes, {
    fields: [dependencyGraphEdges.sourceNodeId],
    references: [dependencyGraphNodes.id],
    relationName: "source_graph_node"
  }),
  target: one(dependencyGraphNodes, {
    fields: [dependencyGraphEdges.targetNodeId],
    references: [dependencyGraphNodes.id],
    relationName: "target_graph_node"
  })
}));

export const scanMetricsRelations = relations(scanMetrics, ({ one }) => ({
  scan: one(scans, { fields: [scanMetrics.scanId], references: [scans.id] })
}));

export const aiAnalysisRunsRelations = relations(aiAnalysisRuns, ({ one, many }) => ({
  scan: one(scans, { fields: [aiAnalysisRuns.scanId], references: [scans.id] }),
  repositoryQuestions: many(repositoryQuestions)
}));

export const repositoryQuestionsRelations = relations(repositoryQuestions, ({ one }) => ({
  scan: one(scans, { fields: [repositoryQuestions.scanId], references: [scans.id] }),
  user: one(users, { fields: [repositoryQuestions.userId], references: [users.id] }),
  analysisRun: one(aiAnalysisRuns, {
    fields: [repositoryQuestions.analysisRunId],
    references: [aiAnalysisRuns.id]
  })
}));
