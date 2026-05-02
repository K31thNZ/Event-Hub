// script/migrate-cloudinary-to-r2.ts
import { config } from "dotenv";
// Load .env BEFORE importing any server modules
config({ path: ".env" });

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import https from "https";
import path from "path";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

// Validate required env vars
if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is required");
  process.exit(1);
}
if (!process.env.CLOUDFLARE_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
  console.error("❌ Missing R2 credentials in environment");
  process.exit(1);
}

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

// Helper: download image from URL to Buffer
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

async function uploadToR2(buffer: Buffer, originalFilename: string, folder: string): Promise<string> {
  const ext = path.extname(originalFilename) || ".jpg";
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: "image/jpeg",
  }));
  return `${PUBLIC_URL_BASE}/${key}`;
}

async function migrateAll(dryRun = false) {
  console.log(`🚀 Starting migration (dryRun = ${dryRun})`);

  // 1. Users - avatar_url
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
      try {
        const buffer = await downloadImage(oldUrl);
        const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
        const newUrl = await uploadToR2(optimized, "avatar.jpg", "avatars");
        await db.execute(sql`
          UPDATE users SET avatar_url = ${newUrl} WHERE id = ${id}
        `);
        console.log(`  ✅ Updated to ${newUrl}`);
      } catch (err: any) {
        console.error(`  ❌ Failed: ${err.message}`);
      }
    } else {
      console.log(`  [DRY RUN] Would update`);
    }
  }

  // 2. Events - image_url
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
      try {
        const buffer = await downloadImage(oldUrl);
        const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
        const newUrl = await uploadToR2(optimized, "event.jpg", "events");
        await db.execute(sql`
          UPDATE events SET image_url = ${newUrl} WHERE id = ${id}
        `);
        console.log(`  ✅ Updated to ${newUrl}`);
      } catch (err: any) {
        console.error(`  ❌ Failed: ${err.message}`);
      }
    } else {
      console.log(`  [DRY RUN] Would update`);
    }
  }

  // 3. Groups - logo (image_url) and banner_url
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
        try {
          const buffer = await downloadImage(row.image_url);
          const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
          const newUrl = await uploadToR2(optimized, "group_logo.jpg", "groups");
          await db.execute(sql`
            UPDATE groups SET image_url = ${newUrl} WHERE id = ${id}
          `);
          console.log(`  ✅ Logo updated`);
        } catch (err: any) {
          console.error(`  ❌ Logo failed: ${err.message}`);
        }
      } else {
        console.log(`  [DRY RUN] Would update logo`);
      }
    }
    if (row.banner_url && row.banner_url.includes("res.cloudinary.com")) {
      console.log(`Group ${id} banner: ${row.banner_url}`);
      if (!dryRun) {
        try {
          const buffer = await downloadImage(row.banner_url);
          const optimized = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
          const newUrl = await uploadToR2(optimized, "group_banner.jpg", "groups");
          await db.execute(sql`
            UPDATE groups SET banner_url = ${newUrl} WHERE id = ${id}
          `);
          console.log(`  ✅ Banner updated`);
        } catch (err: any) {
          console.error(`  ❌ Banner failed: ${err.message}`);
        }
      } else {
        console.log(`  [DRY RUN] Would update banner`);
      }
    }
  }

  console.log("🎉 Migration finished.");
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
migrateAll(dryRun).catch(console.error);
