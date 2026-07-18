import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getServerEnvironment } from "@codemri/config/env";
import { getDatabase } from "@codemri/db";
import {
  createRepositoryImport,
  GitHubRepositoryError,
  listScansForActor,
  ScanQueueError,
  type CreateScanInput
} from "@codemri/repository";

import { getAuthenticatedActor } from "@/lib/actor";

export const runtime = "nodejs";

export async function GET() {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const scans = await listScansForActor(getDatabase().database, actor.email);
    return NextResponse.json({ scans });
  } catch (error) {
    console.error("Unable to load repository imports", error);
    return NextResponse.json(
      {
        error: "Repository progress is unavailable. Check that PostgreSQL is running and migrated."
      },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedActor();
  if (!actor) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  try {
    const body: unknown = await request.json();
    const environment = getServerEnvironment();
    const result = await createRepositoryImport({
      actor,
      input: body as CreateScanInput,
      database: getDatabase(environment.DATABASE_URL).database,
      redisUrl: environment.REDIS_URL,
      githubToken: environment.GITHUB_TOKEN
    });

    return NextResponse.json(result, { status: 202 });
  } catch (error: unknown) {
    if (error instanceof GitHubRepositoryError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error:
            "Repository import configuration is invalid. Check the repository URL and server environment."
        },
        { status: 400 }
      );
    }

    if (error instanceof ScanQueueError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error("Repository import failed", error);
    return NextResponse.json({ error: "Unable to start the repository import." }, { status: 500 });
  }
}
