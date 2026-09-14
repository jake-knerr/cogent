/**
 * Collects every imported stylesheet, keeps them in import order, and emits one
 * stylesheet per bundle.
 *
 * Replaces rollup-plugin-postcss, which was last released in 2023 and pinned
 * cssnano 5 -- the source of stale browserslist data and of a security
 * advisory, and the reason the emitted filename could not carry a content
 * hash: it called emitFile({fileName}), which bypasses rollup's assetFileNames
 * entirely.
 *
 * Nothing is imported here on purpose. Scoping needs postcss, minifying needs a
 * minifier, and a build that wants neither should not install either, so both
 * arrive as functions from the caller. That keeps this file free of every
 * dependency it would otherwise force on its consumers, and lets a consumer
 * choose its own minifier rather than the one this happened to be written
 * against.
 *
 * No sourcemap option. This concatenates N stylesheets into one file, so a
 * useful map would have to merge a map per input through that join. If it is
 * wanted, implement it; do not add a parameter that is never read.
 *
 * @param {Object} arg
 * @param {string} arg.extract name of the stylesheet to emit, e.g. "app.css".
 *  Passed to rollup as a name rather than a fileName, so assetFileNames still
 *  applies and the output can carry a content hash
 * @param {(code: string, id: string) => string|Promise<string>} [arg.transform]
 *  runs over each stylesheet as it is collected -- where a caller hooks in
 *  class scoping, autoprefixing, or anything else per file
 * @param {(code: string, filename: string) => string} [arg.minify] runs over the
 *  concatenated result. Left out, the stylesheet is emitted as written
 * @returns {import("rollup").Plugin}
 */
export function createCssPlugin({ extract, transform: transformCSS, minify }) {
  /** @type {Map<string, string>} module id -> collected css */
  const styles = new Map();

  return {
    name: "cogent-css",

    async transform(code, id) {
      if (!id.endsWith(".css")) return null;

      styles.set(id, transformCSS ? await transformCSS(code, id) : code);

      // the stylesheet leaves nothing behind in the js bundle
      return { code: "", map: { mappings: "" } };
    },

    generateBundle(options, bundle) {
      if (!styles.size) return;

      const entry = Object.values(bundle).find(
        (output) => output.type === "chunk" && output.isEntry,
      );

      // narrowed again because find cannot carry its predicate's type, and an
      // entry rollup built from no module of its own has nothing to walk
      if (entry?.type !== "chunk" || !entry.facadeModuleId) return;

      // concatenated in import order, not in the order rollup happened to
      // transform them. CSS is order sensitive -- two rules of equal
      // specificity are decided by which comes last -- so this walks the import
      // graph depth first from the entry, the same way the plugin it replaces
      // did
      const order = getImportOrder(entry.facadeModuleId, this.getModuleInfo);

      const merged = [...styles.entries()]
        .sort(
          ([first], [second]) => order.indexOf(first) - order.indexOf(second),
        )
        .map(([, source]) => source)
        .join("\n");

      // "name", not "fileName": fileName pins the output and bypasses
      // assetFileNames, which is what stopped the old plugin from ever
      // producing a content-hashed stylesheet
      this.emitFile({
        type: "asset",
        name: extract,
        source: minify ? minify(merged, extract) : merged,
      });
    },
  };
}

/**
 * Walks the import graph depth first, so a stylesheet imported by an earlier
 * module comes first in the output. Recursive, so it is named rather than
 * inlined into its one caller.
 *
 * @param {string} id
 * @param {(id: string) => {importedIds: readonly string[]}|null} getModuleInfo
 * @param {Set<string>} [seen]
 * @returns {string[]}
 */
function getImportOrder(id, getModuleInfo, seen = new Set()) {
  if (!id || seen.has(id)) return [];

  seen.add(id);

  const order = [id];

  for (const imported of getModuleInfo(id)?.importedIds ?? [])
    order.push(...getImportOrder(imported, getModuleInfo, seen));

  return order;
}
