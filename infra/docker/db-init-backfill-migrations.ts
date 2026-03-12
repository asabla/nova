/**
 * Backfills the drizzle migration journal when the database was created via `db:push`.
 * Checks if tables exist but no migrations are recorded, and if so, inserts records
 * for all known migrations so that `drizzle-kit migrate` can run cleanly afterward.
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

try {
  const [{ c }] = await sql<[{ c: number }]>`
    SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations
  `;

  if (c > 0) {
    console.log("  Migration journal already has entries — skipping backfill.");
    process.exit(0);
  }

  const journal = JSON.parse(
    readFileSync("/app/packages/api/drizzle/meta/_journal.json", "utf8"),
  );

  for (const entry of journal.entries) {
    const content = readFileSync(
      `/app/packages/api/drizzle/${entry.tag}.sql`,
      "utf8",
    );
    const hash = createHash("md5").update(content).digest("hex");
    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
    console.log("  Recorded migration:", entry.tag);
  }

  console.log("  Migration journal backfilled.");
} finally {
  await sql.end();
}
