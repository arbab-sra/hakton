import { z } from "zod";

function optionalEnvironmentString(minimumLength = 1) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(minimumLength).optional()
  );
}

const serverEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  AUTH_SECRET: optionalEnvironmentString(32),
  AUTH_GITHUB_ID: optionalEnvironmentString(),
  AUTH_GITHUB_SECRET: optionalEnvironmentString(),
  GITHUB_TOKEN: optionalEnvironmentString(),
  GROQ_API_KEY: optionalEnvironmentString(),
  GROQ_MODEL: z.string().min(1).default("openai/gpt-oss-20b"),
  AI_CONTEXT_MAX_CHARS: z.coerce.number().int().min(20_000).max(500_000).default(120_000),
  REPOSITORY_WORKDIR: z.string().min(1).default("/tmp/codemri"),
  MAX_REPOSITORY_FILES: z.coerce.number().int().positive().max(100_000).default(10_000),
  MAX_REPOSITORY_FILE_BYTES: z.coerce.number().int().positive().max(10_000_000).default(1_000_000)
});

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000")
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

/** Validates configuration only when a service is initialized, never at module import time. */
export function getServerEnvironment(environment = process.env): ServerEnvironment {
  if (environment.SKIP_ENV_VALIDATION === "1") {
    return environment as unknown as ServerEnvironment;
  }

  return serverEnvironmentSchema.parse(environment);
}

export function getPublicEnvironment(environment = process.env): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}
