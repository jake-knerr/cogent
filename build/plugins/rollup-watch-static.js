import { forEachFile } from "../../utils/files.js";

/**
 * Manually add watched folders in rollup.
 *
 * @param {Object} [arg]
 * @param {string[]} [arg.dirs] Directories to watch, everything under them
 *  included.
 * @returns {import("rollup").Plugin}
 */
export function watchStatic({ dirs = [] } = {}) {
  return {
    name: "watch-static-files",

    buildStart() {
      for (const dir of dirs) {
        // the directory itself, and not only what is in it. Watching the files
        // alone means a file added later is watched by nothing, so its first
        // appearance triggers no rebuild and it stays invisible until something
        // else does
        this.addWatchFile(dir);

        forEachFile(dir, (file) => this.addWatchFile(file));
      }
    },
  };
}
