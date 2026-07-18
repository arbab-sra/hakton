CREATE TYPE "public"."ai_analysis_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "ai_analysis_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"status" "ai_analysis_status" DEFAULT 'running' NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"context_fingerprint" text NOT NULL,
	"result" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "repository_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scan_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"analysis_run_id" uuid,
	"model" text NOT NULL,
	"context_fingerprint" text NOT NULL,
	"question" text NOT NULL,
	"answer" jsonb,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_analysis_runs" ADD CONSTRAINT "ai_analysis_runs_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_questions" ADD CONSTRAINT "repository_questions_scan_id_scans_id_fk" FOREIGN KEY ("scan_id") REFERENCES "public"."scans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_questions" ADD CONSTRAINT "repository_questions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_questions" ADD CONSTRAINT "repository_questions_analysis_run_id_ai_analysis_runs_id_fk" FOREIGN KEY ("analysis_run_id") REFERENCES "public"."ai_analysis_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_analysis_runs_scan_created_idx" ON "ai_analysis_runs" USING btree ("scan_id","created_at");--> statement-breakpoint
CREATE INDEX "repository_questions_scan_created_idx" ON "repository_questions" USING btree ("scan_id","created_at");--> statement-breakpoint
CREATE INDEX "repository_questions_user_created_idx" ON "repository_questions" USING btree ("user_id","created_at");