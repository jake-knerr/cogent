import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Get the directory path for the passed url. For ES modules pass
 * `import.meta.url`.
 *
 * Recreates __dirname from commonjs for ES modules.
 *
 * @param {string} url
 * @returns {string}
 */
export function getDirPath(url) {
  return path.dirname(fileURLToPath(url));
}
