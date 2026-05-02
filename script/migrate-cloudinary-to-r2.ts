// script/migrate-cloudinary-to-r2.ts
import { config } from "dotenv";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import https from "https";
import path from "path";

// Load .env FIRST before importing any module that depends on it
config({ path: ".env" });

// Now, after env is loaded, we can import db dynamically
let db: any;
let sql: any;

async function initDb() {
  const module = await import("../server/db");
  db = module.db;
  const drizzle = await import("drizzle-orm");
  sql = drizzle.sql;
}

async function main() {
  await initDb();

  // Validate required env vars
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL environment variable is required");
    process.exit(1);
  }
  // ... rest of the script
}

main().catch(console.error);
