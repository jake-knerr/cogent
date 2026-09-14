import path from "node:path";
import { existsSync, readdirSync, statSync } from "node:fs";

/**
 * Walk a directory tree and hand every file to a callback.
 *
 * @param {string} dir
 * @param {(file: string) => void} onFile
 */
export function forEachFile(dir, onFile) {
  if (!existsSync(dir)) return;

  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);

    if (statSync(fullPath).isDirectory()) {
      forEachFile(fullPath, onFile);
    } else {
      onFile(fullPath);
    }
  }
}
