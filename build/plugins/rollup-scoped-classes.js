import path from "node:path";
import { readFileSync } from "node:fs";

import MagicString from "magic-string";

import { forEachFile } from "../../utils/files.js";
import { isProduction } from "../../utils/system.js";

/**
 * A rollup plugin that also answers postcss. `getScopedNameHandler` is not part
 * of rollup's interface -- the config reaches for it directly, which is how the
 * two halves of the rename meet without this file importing any css tooling.
 *
 * @typedef {import("rollup").Plugin & {
 *  getScopedNameHandler: () => (className: string) => string
 * }} ScopedClassPlugin
 */

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
const FULL = ALPHABET + "0123456789";

const MARKED_CLASS = /::([A-Za-z0-9_-]+)::/g;

// class selectors already written by hand; the generated names must not land on
// one of these, because an unmarked class keeps its literal name and the two
// share a namespace
const CSS_CLASS = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;

const MARKED_SOURCE = new Set([".js", ".ejs", ".html"]);

/**
 * Scopes css class names that opt in by being written as `::name::`, in js and
 * in templates alike.
 *
 * In production each marked name is replaced by a short generated one, in the
 * stylesheets and in every reference at once. In development the colons are
 * simply stripped and the original survives, which keeps devtools readable and
 * avoids rollup's watch-mode output map going stale.
 *
 * Nothing css-related is imported here, the way `rollup-css.js` imports no
 * minifier: postcss asks this plugin for names through `getScopedNameHandler`
 * rather than this plugin reaching for postcss.
 *
 * @param {Object} [arg]
 * @param {string[]} [arg.sources] Directories scanned up front for `::marked::`
 *  names and for class selectors already written by hand, which the generator
 *  must then avoid.
 * @param {(rewrite: (str: string) => string) => any} [arg.onClassMapReady]
 *  Run once the map is built and before any module is transformed, for anything
 *  else that needs to rewrite marked names -- static templates, say. Handed the
 *  rewriter, so this plugin never learns what it is being used for.
 * @returns {ScopedClassPlugin}
 */
export function createScopedClassRewritePlugin({
  sources = [],
  onClassMapReady,
} = {}) {
  /** @type {Map<string, string>} original class name -> generated name */
  const classMap = new Map();

  /** @type {Set<string>} originals postcss actually asked about */
  const foundClasses = new Set();

  /** @type {Set<string>} names the generator must not produce */
  const reservedNames = new Set();

  const tracker = [0];

  return {
    name: "scoped-class-rewrite",

    // this will run before anything else and respects async; necessary to
    // fully build the static sites and get the minified css before moving
    // forward
    async buildStart() {
      buildClassMap();

      // whatever else needs the map before a module is transformed -- rendering
      // static templates, say. Handed the rewriter rather than being named
      // here, so this plugin never learns what a site is. Text in, text out --
      // only `transform` has any use for the edits themselves
      await onClassMapReady?.((str) => rewriteColonClasses(str).toString());
    },

    // rewrite ::name:: in js only; stylesheets are postcss's job, and it asks
    // for names through getScopedNameHandler below
    transform(code, id) {
      if (!id.endsWith(".js")) return null;

      // Only our own source marks classes. A dependency is scanned otherwise,
      // and one of them ships the literal "std::string" in an error message --
      // which the marker pattern used to match, swallowing everything up to the
      // next pair of colons and corrupting the module past parsing.
      if (id.includes("node_modules")) return null;

      const magic = rewriteColonClasses(code);

      if (!magic.hasChanged()) return null;

      return {
        code: magic.toString(),

        // Always, and from the surgical edits rather than a whole-file
        // overwrite. The spa turns sourcemaps on in development, so a map
        // withheld outside production is withheld exactly when it is wanted,
        // and a map built from one file-sized replacement points every line at
        // the top of the file.
        map: magic.generateMap({ hires: true }),
      };
    },

    // return to postCSS the minified class names
    getScopedNameHandler() {
      return (className) => {
        const minified = classMap.get(className);

        // never marked, so it is not opted in; leave the name alone
        if (!minified) return className;

        foundClasses.add(className);

        return minified;
      };
    },

    writeBundle() {
      if (!isProduction) return;

      for (const [original, minified] of classMap)
        if (!foundClasses.has(original))
          console.warn(
            `Minified CSS class not found in stylesheets => original → ::${original}:: minified → ${minified}`,
          );
    },
  };

  // One deterministic pass over the sources before anything is transformed.
  //
  // postcss asks for a class name the moment it reaches a stylesheet, which can
  // happen before the js that marks that class has been transformed -- the two
  // are interleaved in rollup's module order. Filling the map lazily meant a
  // stylesheet reached first kept the original name while the js that came
  // later got a generated one, and the rule silently stopped matching. Sorting
  // the names also keeps the output stable from build to build.
  function buildClassMap() {
    if (!isProduction) return;

    const marked = new Set();

    for (const dir of sources)
      forEachFile(dir, (file) => {
        const ext = path.extname(file);

        if (ext === ".css") {
          const css = readFileSync(file, "utf8");

          for (const [, name] of css.matchAll(CSS_CLASS)) reservedNames.add(name);

          return;
        }

        if (!MARKED_SOURCE.has(ext)) return;

        const source = readFileSync(file, "utf8");

        for (const [, name] of source.matchAll(MARKED_CLASS)) marked.add(name);
      });

    for (const name of [...marked].sort())
      classMap.set(name, generateNextName());
  }

  function generateNextName() {
    // google has cleaner implementation here:
    // https://github.com/google/postcss-rename/blob/master/src/minimal-renamer.ts
    // still using my smooth brain version

    let name;

    // skip anything a stylesheet already spells out by hand
    do {
      name = "";

      for (let i = 0; i < tracker.length; i++)
        name += (i === 0 ? ALPHABET : FULL)[tracker[i]];

      let last = tracker.length - 1;

      tracker[last]++;

      while (tracker[last] >= (last === 0 ? ALPHABET.length : FULL.length)) {
        tracker[last] = 0;

        if (last === 0) {
          tracker.unshift(0);
        } else {
          last--;
        }

        tracker[last]++;
      }
    } while (reservedNames.has(name));

    return name;
  }

  /**
   * @param {string} str
   * @returns {MagicString} edits applied, so `transform` can still build a map
   */
  function rewriteColonClasses(str) {
    const magic = new MagicString(str);

    for (const match of str.matchAll(MARKED_CLASS)) {
      const original = match[1];
      const start = match.index;
      const end = start + match[0].length;

      // a name only reaches here unmapped when it lives outside `sources`
      if (isProduction && !classMap.has(original))
        classMap.set(original, generateNextName());

      magic.overwrite(
        start,
        end,
        isProduction ? classMap.get(original) : original,
      );
    }

    return magic;
  }
}
