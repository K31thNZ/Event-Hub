// script/check-cloudinary-urls.ts
// Run with:  DATABASE_URL=... npx tsx script/check-cloudinary-urls.ts
//
// Queries the DB for any events still pointing at Cloudinary CDN URLs
// (res.cloudinary.com) and prints a report. Safe read-only — no writes.

import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL is required");
    process.exit(1);
  }

  const { db } = await import("../server/db");
  const { sql } = await import("drizzle-orm");

  console.log("🔍 Scanning events table for Cloudinary image URLs...\n");

  const rows = await db.execute(
    sql`SELECT id, title, image_url
        FROM events
        WHERE image_url LIKE '%res.cloudinary.com%'
           OR image_url LIKE '%cloudinary.com%'
        ORDER BY id`
  );

  if (rows.rows.length === 0) {
    console.log("✅ No Cloudinary URLs found — migration appears complete.");
    process.exit(0);
  }

  console.log(`⚠️  Found ${rows.rows.length} event(s) with Cloudinary image URLs:\n`);
  console.log("ID     | Title                                   | Image URL");
  console.log("-------|-----------------------------------------|----------");

  for (const row of rows.rows as any[]) {
    const id    = String(row.id).padEnd(6);
    const title = String(row.title ?? "").slice(0, 40).padEnd(40);
    console.log(`${id} | ${title} | ${row.image_url}`);
  }

  console.log(`\n📋 Total: ${rows.rows.length} event(s) need image re-migration.`);
  console.log("   Run script/migrate-cloudinary-to-r2.ts to re-migrate them.");
  process.exit(1);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
