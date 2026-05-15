// Supabase Storage adapter. File name kept ("local.ts") so existing import paths
// don't all need to change — but the implementation now talks to Supabase Storage,
// not the local filesystem. Vercel-safe.
//
// One bucket (default: "uploads"), three logical prefixes: templates/, logos/, generated/.
// The "path" stored in the DB is the object key within the bucket
// (e.g. "templates/sample_invoice.html"), NOT a local filesystem path.

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "uploads";

export const STORAGE = {
  bucket: BUCKET,
  templates: "templates",
  logos: "logos",
  generated: "generated",
  // Back-compat: some code references STORAGE.root. Treat it as the bucket name.
  root: BUCKET,
};

let bucketReady: Promise<void> | null = null;

export async function ensureBucket(): Promise<void> {
  if (bucketReady) return bucketReady;
  bucketReady = (async () => {
    const admin = createSupabaseAdminClient();
    const { data: existing } = await admin.storage.getBucket(BUCKET);
    if (!existing) {
      const { error } = await admin.storage.createBucket(BUCKET, { public: false });
      if (error && !/already exists/i.test(error.message)) {
        throw new Error(`Failed to create bucket "${BUCKET}": ${error.message}`);
      }
    }
  })();
  return bucketReady;
}

// Reject anything that isn't alnum/dot/dash/underscore. Object keys still need
// to avoid traversal-style segments inside the prefix.
export function safeFileName(name: string): string {
  const base = name.split("/").pop() ?? name;
  return base.replace(/[^A-Za-z0-9_.\-]+/g, "_");
}

export function joinSafe(prefix: string, name: string): string {
  if (!/^[A-Za-z0-9_\-]+$/.test(prefix)) throw new Error("Invalid prefix");
  return `${prefix}/${safeFileName(name)}`;
}

function contentTypeForName(name: string): string {
  const ext = name.toLowerCase().split(".").pop();
  switch (ext) {
    case "pdf": return "application/pdf";
    case "xml": return "application/xml";
    case "html":
    case "htm": return "text/html";
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "svg": return "image/svg+xml";
    case "webp": return "image/webp";
    case "json": return "application/json";
    default: return "application/octet-stream";
  }
}

export async function writeFile(
  prefix: string,
  fileName: string,
  contents: Buffer | string,
): Promise<string> {
  await ensureBucket();
  const key = joinSafe(prefix, fileName);
  const body = typeof contents === "string" ? Buffer.from(contents, "utf-8") : contents;
  const admin = createSupabaseAdminClient();
  const { error } = await admin.storage.from(BUCKET).upload(key, body, {
    contentType: contentTypeForName(fileName),
    upsert: true,
  });
  if (error) throw new Error(`Upload failed (${key}): ${error.message}`);
  return key;
}

function normaliseKey(keyOrLegacyPath: string): string {
  // Tolerate legacy DB rows that stored absolute local paths from before the
  // migration: pull the last "<prefix>/<name>" pair out.
  if (keyOrLegacyPath.includes("/uploads/")) {
    const after = keyOrLegacyPath.split("/uploads/")[1];
    if (after) return after;
  }
  return keyOrLegacyPath;
}

export async function readFile(key: string): Promise<Buffer> {
  await ensureBucket();
  const objectKey = normaliseKey(key);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.storage.from(BUCKET).download(objectKey);
  if (error || !data) throw new Error(`Download failed (${objectKey}): ${error?.message ?? "no data"}`);
  const ab = await data.arrayBuffer();
  return Buffer.from(ab);
}

export async function deleteFile(key: string): Promise<void> {
  const objectKey = normaliseKey(key);
  const admin = createSupabaseAdminClient();
  await admin.storage.from(BUCKET).remove([objectKey]).catch(() => {});
}

// Helper used by the document generator to inline images (logos) as data URLs
// so Puppeteer doesn't have to fetch them over the network during PDF rendering.
export async function toDataUrl(key: string): Promise<string> {
  const buf = await readFile(key);
  const mime = contentTypeForName(normaliseKey(key));
  return `data:${mime};base64,${buf.toString("base64")}`;
}

// Back-compat: some callers expect this to exist. With Supabase Storage,
// the bucket is the only thing to bootstrap.
export async function ensureDirs(): Promise<void> {
  await ensureBucket();
}
