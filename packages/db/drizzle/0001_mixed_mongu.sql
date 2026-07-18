CREATE TYPE "public"."metric_name" AS ENUM('overall_health', 'maintainability', 'technical_debt', 'architecture_integrity', 'performance_risk', 'security_exposure', 'code_complexity', 'test_confidence', 'dependency_health', 'production_readiness');--> statement-breakpoint
CREATE TYPE "public"."metric_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."repository_status" AS ENUM('pending', 'cloning', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_job_status" AS ENUM('queued', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."scan_stage" AS ENUM('clone', 'parse', 'graph', 'metrics', 'embeddings', 'ai', 'report');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "api_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"handler_name" text,
	"start_line" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "code_symbols" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"exported" integer DEFAULT 0 NOT NULL,
	"default_export" integer DEFAULT 0 NOT NULL,
	"parent_name" text,
	"signature" text,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL,
	"start_column" integer NOT NULL,
	"end_column" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "database_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"client_name" text NOT NULL,
	"operation" text NOT NULL,
	"expression" text NOT NULL,
	"start_line" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dependency_graph_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"edge_type" text NOT NULL,
	"import_file_id" uuid
);
--> statement-breakpoint
CREATE TABLE "dependency_graph_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"node_key" text NOT NULL,
	"node_type" text NOT NULL,
	"label" text NOT NULL,
	"file_id" uuid
);
--> statement-breakpoint
CREATE TABLE "file_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"target_file_id" uuid,
	"module_specifier" text NOT NULL,
	"import_kind" text NOT NULL,
	"is_relative" integer DEFAULT 0 NOT NULL,
	"imported_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"start_line" integer NOT NULL,
	"end_line" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text DEFAULT 'github' NOT NULL,
	"provider_repository_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"url" text NOT NULL,
	"clone_url" text NOT NULL,
	"default_branch" text NOT NULL,
	"visibility" text NOT NULL,
	"status" "repository_status" DEFAULT 'pending' NOT NULL,
	"last_clone_commit" text,
	"last_cloned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"manifest_path" text NOT NULL,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"dependency_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"scan_id" uuid NOT NULL,
	"path" text NOT NULL,
	"language" text NOT NULL,
	"content_hash" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"line_count" integer NOT NULL,
	"tree_sitter_has_error" integer DEFAULT 0 NOT NULL,
	"parse_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"stage" "scan_stage" NOT NULL,
	"status" "scan_job_status" DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"bullmq_job_id" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_jobs_bullmq_job_id_unique" UNIQUE("bullmq_job_id")
);
--> statement-breakpoint
CREATE TABLE "scan_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"metric" "metric_name" NOT NULL,
	"score" integer NOT NULL,
	"severity" "metric_severity" NOT NULL,
	"explanation" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"affected_file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" integer NOT NULL,
	"recommended_actions" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_metrics_score_range" CHECK ("scan_metrics"."score" >= 0 AND "scan_metrics"."score" <= 100),
	CONSTRAINT "scan_metrics_confidence_range" CHECK ("scan_metrics"."confidence" >= 0 AND "scan_metrics"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "scan_progress_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"stage" "scan_stage" NOT NULL,
	"status" "scan_status" NOT NULL,
	"progress" integer NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scan_progress_events_progress_range" CHECK ("scan_progress_events"."progress" >= 0 AND "scan_progress_events"."progress" <= 100)
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"repository_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'queued' NOT NULL,
	"current_stage" "scan_stage" DEFAULT 'clone' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"clone_path" text,
	"clone_commit" text,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scans_progress_range" CHECK ("scans"."progress" >= 0 AND "scans"."progress" <= 100)
);
--> statement-breakpoint
ALTER TABLE "api_routes" ADD CONSTRAINT "api_routes_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_routes" ADD CONSTRAINT "api_routes_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "code_symbols" ADD CONSTRAINT "code_symbols_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_calls" ADD CONSTRAINT "database_calls_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "database_calls" ADD CONSTRAINT "database_calls_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_edges" ADD CONSTRAINT "dependency_graph_edges_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_edges" ADD CONSTRAINT "dependency_graph_edges_source_node_id_dependency_graph_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."dependency_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_edges" ADD CONSTRAINT "dependency_graph_edges_target_node_id_dependency_graph_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."dependency_graph_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_edges" ADD CONSTRAINT "dependency_graph_edges_import_file_id_repository_files_id_fk" FOREIGN KEY ("import_file_id") REFERENCES "public"."repository_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_nodes" ADD CONSTRAINT "dependency_graph_nodes_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dependency_graph_nodes" ADD CONSTRAINT "dependency_graph_nodes_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_imports" ADD CONSTRAINT "file_imports_file_id_repository_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."repository_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_imports" ADD CONSTRAINT "file_imports_target_file_id_repository_files_id_fk" FOREIGN KEY ("target_file_id") REFERENCES "public"."repository_files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_dependencies" ADD CONSTRAINT "repository_dependencies_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_files" ADD CONSTRAINT "repository_files_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_jobs" ADD CONSTRAINT "scan_jobs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_metrics" ADD CONSTRAINT "scan_metrics_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_progress_events" ADD CONSTRAINT "scan_progress_events_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_routes_scan_path_idx" ON "api_routes" USING btree ("scan_id","path");--> statement-breakpoint
CREATE INDEX "code_symbols_file_name_idx" ON "code_symbols" USING btree ("file_id","name");--> statement-breakpoint
CREATE INDEX "database_calls_scan_file_idx" ON "database_calls" USING btree ("scan_id","file_id");--> statement-breakpoint
CREATE INDEX "dependency_graph_edges_scan_source_idx" ON "dependency_graph_edges" USING btree ("scan_id","source_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "dependency_graph_nodes_scan_key_idx" ON "dependency_graph_nodes" USING btree ("scan_id","node_key");--> statement-breakpoint
CREATE INDEX "dependency_graph_nodes_scan_type_idx" ON "dependency_graph_nodes" USING btree ("scan_id","node_type");--> statement-breakpoint
CREATE INDEX "file_imports_file_idx" ON "file_imports" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "file_imports_target_idx" ON "file_imports" USING btree ("target_file_id");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_user_provider_remote_idx" ON "repositories" USING btree ("user_id","provider","provider_repository_id");--> statement-breakpoint
CREATE INDEX "repositories_user_updated_idx" ON "repositories" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_dependencies_scan_manifest_name_idx" ON "repository_dependencies" USING btree ("scan_id","manifest_path","name");--> statement-breakpoint
CREATE INDEX "repository_dependencies_scan_name_idx" ON "repository_dependencies" USING btree ("scan_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "repository_files_scan_path_idx" ON "repository_files" USING btree ("scan_id","path");--> statement-breakpoint
CREATE INDEX "repository_files_repository_path_idx" ON "repository_files" USING btree ("repository_id","path");--> statement-breakpoint
CREATE INDEX "scan_jobs_scan_stage_idx" ON "scan_jobs" USING btree ("scan_id","stage");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_metrics_scan_metric_idx" ON "scan_metrics" USING btree ("scan_id","metric");--> statement-breakpoint
CREATE INDEX "scan_progress_events_scan_created_idx" ON "scan_progress_events" USING btree ("scan_id","created_at");--> statement-breakpoint
CREATE INDEX "scans_repository_created_idx" ON "scans" USING btree ("repository_id","created_at");--> statement-breakpoint
CREATE INDEX "scans_requester_created_idx" ON "scans" USING btree ("requested_by_user_id","created_at");