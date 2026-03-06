import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL ?? "postgres://nova:nova@localhost:5432/nova";
const client = postgres(connectionString);
export const db = drizzle(client);
