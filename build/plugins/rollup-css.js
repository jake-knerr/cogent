import * as lightningcss from "lightningcss";

import { isProduction } from "../../utils/system.js";

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
 * Minifying and class scoping are both lightningcss's, imported rather than
 * handed in: it is what cogent builds against, it parses the stylesheet
 * instead of running regexes over it, and it answers synchronously -- so there
 * is no async minifier contract left for a caller to get wrong.
 *
 * Scoping needed postcss until it did not. `scopeClassName` takes the name
 * handler off the scoped-class plugin and nothing else, so the two halves of
 * the rename still meet in the config rather than through an import, and a
 * build that wants the rename no longer installs postcss to get it.
 *
 * No sourcemap option. This concatenates N stylesheets into one file, so a
 * useful map would have to merge a map per input through that join. If it is
 * wanted, implement it; do not add a parameter that is never read.
 *
 * @param {Object} arg
 * @param {string} arg.extract name of the stylesheet to emit, e.g. "app.css".
 *  Passed to rollup as a name rather than a fileName, so assetFileNames still
 *  applies and the output can carry a content hash
 * @param {(className: string) => string} [arg.scopeClassName] renames every
 *  class in every selector, `:is()` and friends included. Pass
 *  `scopedClasses.getScopedNameHandler()`; a name it does not know comes back
 *  unchanged, which is how an unmarked class keeps its own
 * @param {(code: string, id: string) => string|Promise<string>} [arg.transform]
 *  runs over each stylesheet as it is collected, for whatever lightningcss
 *  does not do -- rarely anything, now that scoping, prefixing and syntax
 *  lowering are all above
 * @param {boolean} [arg.minify=isProduction] minifies the concatenated result.
 *  Off outside production, where a readable stylesheet is worth more than a
 *  small one
 * @param {import("lightningcss").Targets} [arg.targets] browsers to compile
 *  for. Left out, modern syntax is passed through as written -- which matters
 *  for nesting, since a component's stylesheet is written with it
 * @returns {import("rollup").Plugin}
 */
export function createCssPlugin({
  extract,
  transform: transformCSS,
  minify = isProduction,
  scopeClassName,
  targets,
}) {
  /** @type {Map<string, string>} module id -> collected css */
  const styles = new Map();

  return {
    name: "cogent-css",

    // one plugin instance serves every rebuild of a watch, so a stylesheet
    // whose import was deleted would otherwise keep shipping -- and with its id
    // gone from the import walk it would sort to the very front
    buildStart() {
      styles.clear();
    },

    async transform(code, id) {
      if (!id.endsWith(".css")) return null;

      styles.set(id, transformCSS ? await transformCSS(code, id) : code);

      // the stylesheet leaves nothing behind in the js bundle
      return { code: "", map: { mappings: "" } };
    },

    generateBundle(options, bundle) {
      if (!styles.size) return;

      // every entry, not the first one found: a second entry's stylesheets are
      // reachable from no other, and an entry rollup built from no module of
      // its own has nothing to walk
      const entries = Object.values(bundle).filter(
        (output) =>
          output.type === "chunk" && output.isEntry && output.facadeModuleId,
      );

      // concatenated in import order, not in the order rollup happened to
      // transform them. CSS is order sensitive -- two rules of equal
      // specificity are decided by which comes last -- so this walks the import
      // graph depth first from the entry, the same way the plugin it replaces
      // did
      const seen = new Set();
      const order = [];

      for (const entry of entries)
        if (entry.type === "chunk" && entry.facadeModuleId)
          order.push(
            ...getImportOrder(entry.facadeModuleId, this.getModuleInfo, seen),
          );

      // ranked once rather than scanned per comparison: `order` holds every
      // module in the graph and the sort asks about two ids at a time
      const rank = new Map(order.map((id, index) => [id, index]));

      // anything the walk never reached sorts last and keeps its relative
      // order, rather than the -1 an unranked id used to produce -- which put
      // it ahead of the first stylesheet and inverted the cascade it belongs to
      /** @param {string} id */
      const rankOf = (id) => rank.get(id) ?? order.length;

      const merged = [...styles.entries()]
        .sort(([first], [second]) => rankOf(first) - rankOf(second))
        .map(([, source]) => source)
        .join("\n");

      // "name", not "fileName": fileName pins the output and bypasses
      // assetFileNames, which is what stopped the old plugin from ever
      // producing a content-hashed stylesheet
      this.emitFile({
        type: "asset",
        name: extract,
        source:
          minify || scopeClassName
            ? compileCSS(merged, extract, { minify, scopeClassName, targets })
            : merged,
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
 * @param {(id: string) => {
 *  importedIds: readonly string[],
 *  dynamicallyImportedIds: readonly string[]
 * }|null} getModuleInfo
 * @param {Set<string>} [seen]
 * @returns {string[]}
 */
function getImportOrder(id, getModuleInfo, seen = new Set()) {
  if (!id || seen.has(id)) return [];

  seen.add(id);

  const order = [id];

  const info = getModuleInfo(id);

  // dynamic imports as well as static ones. Rollup keeps them in a separate
  // list, and a route panel loaded with `await import()` is exactly the kind of
  // module whose stylesheet belongs last rather than first
  for (const imported of [
    ...(info?.importedIds ?? []),
    ...(info?.dynamicallyImportedIds ?? []),
  ])
    order.push(...getImportOrder(imported, getModuleInfo, seen));

  return order;
}

/**
 * One parse for all of it: renaming, minifying and whatever `targets` asks to
 * be lowered. Synchronous, so the emit above stays a plain expression.
 *
 * @param {string} code
 * @param {string} filename Carried only so a parse error can name a file.
 * @param {Object} arg
 * @param {boolean} [arg.minify]
 * @param {(className: string) => string} [arg.scopeClassName]
 * @param {import("lightningcss").Targets} [arg.targets]
 * @returns {string}
 */
function compileCSS(code, filename, { minify, scopeClassName, targets }) {
  const { code: compiled } = lightningcss.transform({
    filename,
    code: Buffer.from(code),
    minify,
    targets,
    visitor: scopeClassName
      ? { Selector: (selector) => scopeSelector(selector, scopeClassName) }
      : undefined,
  });

  return Buffer.from(compiled).toString("utf8");
}

/**
 * Recursive because the visitor is not: it is handed a selector and never the
 * selector lists inside one, so `:is(.a, .b)` would keep both names while the
 * `.a` beside it was renamed -- a rule that matches half of what it used to.
 *
 * @param {import("lightningcss").Selector} selector
 * @param {(className: string) => string} scopeClassName
 * @returns {import("lightningcss").Selector}
 */
function scopeSelector(selector, scopeClassName) {
  return selector.map((part) => {
    if (part.type === "class")
      return { ...part, name: scopeClassName(part.name) };

    if (!("selectors" in part) || !part.selectors) return part;

    const { selectors } = part;

    // `:is()` and the rest hold a list of selectors; `:host()` holds one. The
    // cast is for the spread, which widens the `kind` of whichever pseudo-class
    // this is back to the union of all of them
    return /** @type {import("lightningcss").SelectorComponent} */ ({
      ...part,
      selectors: Array.isArray(selectors[0])
        ? /** @type {import("lightningcss").SelectorList} */ (selectors).map(
            (inner) => scopeSelector(inner, scopeClassName),
          )
        : scopeSelector(
            /** @type {import("lightningcss").Selector} */ (selectors),
            scopeClassName,
          ),
    });
  });
}
