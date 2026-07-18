import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 10, prepare: false });
  const database = drizzle(client, { schema });

  return { client, database };
}

let singleton: Database | undefined;

export function getDatabase(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required before accessing the database.");
  }

  singleton ??= createDatabase(databaseUrl);
  return singleton;
}

export { schema };
