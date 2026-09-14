import { forEachFile } from "../../utils/files.js";

/**
 * Manually add watched folders in rollup.
 *
 * @param {{dirs: string[]}} arg
 */
export function watchStatic({ dirs }) {
  return {
    name: "watch-static-files",

    buildStart() {
      for (const dir of dirs) forEachFile(dir, (file) => this.addWatchFile(file));
    },
  };
}
