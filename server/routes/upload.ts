// server/routes/upload.ts – updated to accept a "folder" field
import { Router } from "express";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { requireAuth } from "../auth-client";
import { randomBytes } from "crypto";
import path from "path";

const router = Router();

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME!;
const PUBLIC_URL = "https://pub-bbcea9b00e1042e59b8ffab29ad09276.r2.dev";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post("/api/upload/event-image", requireAuth, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    // Get folder from form field, default to "events"
    const folder = req.body.folder || "events";
    const ext = path.extname(req.file.originalname) || ".jpg";
    const key = `${folder}/${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = `${PUBLIC_URL}/${key}`;
    res.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    cb(null, allowed.includes(file.mimetype));
  },
});

router.post("/api/upload/avatar", requireAuth, upload.single("file"), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const key = `avatars/${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;

    console.log(`📤 Uploading to R2: ${key} (${req.file.size} bytes)`);

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const url = `${PUBLIC_URL}/${key}`;
    console.log(`✅ Upload successful: ${url}`);
    res.json({ url });
  } catch (error) {
    // Log the full error details to Render console
    console.error("❌ Upload error details:");
    console.error(error);

    // Also log the error name and message individually for clarity
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Stack trace: ${error.stack}`);
    }

    // Send a generic response to the client (don't expose internals)
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
