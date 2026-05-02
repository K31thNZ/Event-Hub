// script/migrate-cloudinary-to-r2.ts
import { config } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { db } from "../server/db";               // adjust path to your db export
import { eq } from "drizzle-orm";
import { users, events, groups } from "@shared/models/auth"; // adjust as needed
import path from "path";
import sharp from "sharp";
import fs from "fs/promises";
import https from "https";
import { Readable } from "stream";

config({ path: ".env" });

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const PUBLIC_URL_BASE = "https://pub-bbcea9b00e1042e59b8ffab29ad09276.r2.dev";
const BUCKET = process.env.R2_BUCKET_NAME!;

// Helper: download image from Cloudinary URL to buffer
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    }).on("error", reject);
  });
}

// Upload buffer to R2 and return public URL
async function uploadToR2(buffer: Buffer, fileName: string, folder: string): Promise<string> {
  const ext = path.extname(fileName) || ".jpg";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: "image/jpeg",
  }));
  return `${PUBLIC_URL_BASE}/${key}`;
}

// Process a table column that might contain a Cloudinary URL
async function migrateColumn(
  table: any,
  column: string,
  idField: string,
  folder: string,
  dryRun: boolean = false
) {
  const records = await db.select().from(table).where(ilike(column, "%res.cloudinary.com%"));
  console.log(`Found ${records.length} records in ${table._.name}.${column} to process`);

  for (const record of records) {
    const oldUrl = record[column];
    if (!oldUrl) continue;
    if (!oldUrl.includes("res.cloudinary.com")) continue;

    console.log(`Processing ${table._.name} ID ${record[idField]}: ${oldUrl}`);
    if (dryRun) {
      console.log(`  [DRY RUN] Would replace with R2 URL`);
      continue;
    }

    try {
      const buffer = await downloadImage(oldUrl);
      // Optional: compress/optimize with sharp
      const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
      const newUrl = await uploadToR2(optimized, path.basename(oldUrl), folder);
      await db.update(table).set({ [column]: newUrl }).where(eq(table[idField], record[idField]));
      console.log(`  ✅ Updated to ${newUrl}`);
    } catch (err) {
      console.error(`  ❌ Failed for ${oldUrl}:`, err);
    }
  }
}

// Drizzle doesn't have `ilike` by default; use raw SQL or simple `like`.
// For simplicity, we'll use raw SQL (adjust to your ORM).
const ilike = (column: any, pattern: string) => {
  // PostgreSQL case‑insensitive LIKE
  return sql`${column} ILIKE ${pattern}`;
};

// Since we can't easily use `ilike` with drizzle's query builder, we'll fallback to raw SQL.
// Alternative: use `db.execute` directly. Let's do that:

async function migrateAll(dryRun = false) {
  console.log(`🚀 Starting migration (dryRun = ${dryRun})`);

  // 1. Users - avatarUrl
  const usersRes = await db.execute(sql`
    SELECT id, avatar_url FROM users 
    WHERE avatar_url LIKE '%res.cloudinary.com%'
  `);
  console.log(`Found ${usersRes.rows.length} users with Cloudinary avatars`);
  for (const row of usersRes.rows) {
    const id = row.id;
    const oldUrl = row.avatar_url;
    if (!oldUrl) continue;
    console.log(`User ${id}: ${oldUrl}`);
    if (!dryRun) {
      const buffer = await downloadImage(oldUrl);
      const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
      const newUrl = await uploadToR2(optimized, "avatar.jpg", "avatars");
      await db.execute(sql`
        UPDATE users SET avatar_url = ${newUrl} WHERE id = ${id}
      `);
      console.log(`  ✅ Updated to ${newUrl}`);
    } else {
      console.log(`  [DRY RUN] Would update`);
    }
  }

  // 2. Events - imageUrl
  const eventsRes = await db.execute(sql`
    SELECT id, image_url FROM events 
    WHERE image_url LIKE '%res.cloudinary.com%'
  `);
  console.log(`Found ${eventsRes.rows.length} events with Cloudinary images`);
  for (const row of eventsRes.rows) {
    const id = row.id;
    const oldUrl = row.image_url;
    if (!oldUrl) continue;
    console.log(`Event ${id}: ${oldUrl}`);
    if (!dryRun) {
      const buffer = await downloadImage(oldUrl);
      const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
      const newUrl = await uploadToR2(optimized, "event.jpg", "events");
      await db.execute(sql`
        UPDATE events SET image_url = ${newUrl} WHERE id = ${id}
      `);
      console.log(`  ✅ Updated to ${newUrl}`);
    } else {
      console.log(`  [DRY RUN] Would update`);
    }
  }

  // 3. Groups - imageUrl (logo) and bannerUrl if they exist
  const groupsRes = await db.execute(sql`
    SELECT id, image_url, banner_url FROM groups 
    WHERE image_url LIKE '%res.cloudinary.com%' OR banner_url LIKE '%res.cloudinary.com%'
  `);
  console.log(`Found ${groupsRes.rows.length} groups with Cloudinary images`);
  for (const row of groupsRes.rows) {
    const id = row.id;
    if (row.image_url && row.image_url.includes("res.cloudinary.com")) {
      console.log(`Group ${id} logo: ${row.image_url}`);
      if (!dryRun) {
        const buffer = await downloadImage(row.image_url);
        const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
        const newUrl = await uploadToR2(optimized, "group_logo.jpg", "groups");
        await db.execute(sql`
          UPDATE groups SET image_url = ${newUrl} WHERE id = ${id}
        `);
        console.log(`  ✅ Logo updated`);
      }
    }
    if (row.banner_url && row.banner_url.includes("res.cloudinary.com")) {
      console.log(`Group ${id} banner: ${row.banner_url}`);
      if (!dryRun) {
        const buffer = await downloadImage(row.banner_url);
        const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
        const newUrl = await uploadToR2(optimized, "group_banner.jpg", "groups");
        await db.execute(sql`
          UPDATE groups SET banner_url = ${newUrl} WHERE id = ${id}
        `);
        console.log(`  ✅ Banner updated`);
      }
    }
  }

  console.log("🎉 Migration finished.");
}

// Run with --dry-run to test
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
migrateAll(dryRun).catch(console.error);
