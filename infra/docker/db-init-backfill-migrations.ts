/**
 * Backfills the drizzle migration journal for migrations whose tables already
 * exist in the database (e.g. created via `db:push`) but aren't recorded in
 * the `__drizzle_migrations` table. This lets `drizzle-kit migrate` skip
 * already-applied migrations instead of failing with "relation already exists".
 */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!);

try {
  // Get hashes already recorded in the journal
  const existing = await sql<{ hash: string }[]>`
    SELECT hash FROM drizzle.__drizzle_migrations
  `;
  const existingHashes = new Set(existing.map((r) => r.hash));

  const journal = JSON.parse(
    readFileSync("/app/packages/api/drizzle/meta/_journal.json", "utf8"),
  );

  let backfilled = 0;
  for (const entry of journal.entries) {
    const content = readFileSync(
      `/app/packages/api/drizzle/${entry.tag}.sql`,
      "utf8",
    );
    const hash = createHash("md5").update(content).digest("hex");

    if (existingHashes.has(hash)) {
      continue;
    }

    await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${entry.when})`;
    console.log("  Recorded migration:", entry.tag);
    backfilled++;
  }

  if (backfilled === 0) {
    console.log("  All migrations already recorded — nothing to backfill.");
  } else {
    console.log(`  Backfilled ${backfilled} migration(s).`);
  }
} finally {
  await sql.end();
}
