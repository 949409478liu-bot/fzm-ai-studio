import fs from "node:fs";
import path from "node:path";

export function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

export function assertInsideRoot(root: string, relativePath: string): string {
  if (path.isAbsolute(relativePath)) throw new Error("Absolute asset paths are not allowed");
  const resolved = path.resolve(root, relativePath);
  const normalizedRoot = path.resolve(root);
  if (resolved !== normalizedRoot && !resolved.startsWith(`${normalizedRoot}${path.sep}`)) {
    throw new Error("Path traversal rejected");
  }
  return resolved;
}
