import path from "node:path";
import fs from "node:fs/promises";

const ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.resolve(process.cwd(), "uploads");

export const STORAGE = {
  root: ROOT,
  templates: path.join(ROOT, "templates"),
  logos: path.join(ROOT, "logos"),
  generated: path.join(ROOT, "generated"),
};

export async function ensureDirs() {
  for (const dir of Object.values(STORAGE)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Reject path traversal: only allow alnum, dot, dash, underscore
export function safeFileName(name: string): string {
  const base = path.basename(name);
  return base.replace(/[^A-Za-z0-9_.\-]+/g, "_");
}

export function joinSafe(dir: string, name: string): string {
  const safe = safeFileName(name);
  const full = path.join(dir, safe);
  if (!full.startsWith(dir + path.sep) && full !== dir) {
    throw new Error("Path traversal detected");
  }
  return full;
}

export async function writeFile(dir: string, fileName: string, contents: Buffer | string): Promise<string> {
  await ensureDirs();
  const full = joinSafe(dir, fileName);
  await fs.writeFile(full, contents);
  return full;
}

export async function readFile(fullPath: string): Promise<Buffer> {
  // Restrict to within the upload root
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(STORAGE.root)) throw new Error("Forbidden path");
  return fs.readFile(resolved);
}

export async function deleteFile(fullPath: string): Promise<void> {
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(STORAGE.root)) throw new Error("Forbidden path");
  await fs.unlink(resolved).catch(() => {});
}
