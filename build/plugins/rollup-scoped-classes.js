import path from "node:path";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

import MagicString from "magic-string";

import { forEachFile } from "../../utils/files.js";
import { getDirPath } from "../../utils/path.js";
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

// three colons rather than two. Two of them is a sequence ordinary code
// writes on its own -- `std::string` in a quoted symbol, a `ns::key::value`
// cache key -- and this pattern is matched against whole modules rather than
// against anything that knows where a class name may appear, so it would
// swallow the text between such a pair. Three is rare enough in js, ejs and
// html to make that a non-issue, and the marker reads louder for it
const MARKED_CLASS = /:::([A-Za-z0-9_-]+):::/g;

// class selectors already written by hand; the generated names must not land on
// one of these, because an unmarked class keeps its literal name and the two
// share a namespace
const CSS_CLASS = /\.([A-Za-z_][A-Za-z0-9_-]*)/g;

const MARKED_SOURCE = new Set([".js", ".ejs", ".html"]);

// where cogent itself is, worked out from this file rather than looked for at
// node_modules/cogent. The answer is then the same whether an app installed
// it, linked it, or is the cogent repo itself, and a package manager that
// nests or hoists its own way changes nothing
const COGENT_ROOT = path.resolve(getDirPath(import.meta.url), "..", "..");

// the directories of cogent's own that can hold a marker or a class selector
// written by hand. Not the whole root: this very file writes `:::name:::` in
// its own doc comment while explaining what a marker is, so a scan that
// reached `build` would mint a class for the prose and then warn that no
// stylesheet uses it
const COGENT_SOURCES = ["components", "host", "managers"].map((dir) =>
  path.join(COGENT_ROOT, dir),
);

/**
 * Scopes css class names that opt in by being written as `:::name:::`, in js and
 * in templates alike.
 *
 * In production each marked name is replaced by a short generated one, in the
 * stylesheets and in every reference at once. In development the colons are
 * simply stripped and the original survives, which keeps devtools readable and
 * avoids rollup's watch-mode output map going stale.
 *
 * Nothing css-related is imported here: postcss asks this plugin for names
 * through `getScopedNameHandler` rather than this plugin reaching for postcss.
 * `rollup-css.js` owns lightningcss and nothing else, for the same reason --
 * postcss is the heavy half, and it stays the caller's.
 *
 * @param {Object} [arg]
 * @param {string[]} [arg.sources] Directories scanned up front for
 *  `:::marked:::` names and for class selectors already written by hand, which
 *  the generator must then avoid. A marked name living outside all of them is
 *  left at its original in both halves rather than renamed, and warned about.
 *
 *  Cogent's own component directories are added to whatever is passed, since
 *  its components carry markers and an app has no reason to know where its
 *  copy of cogent landed. A directory that does not exist is dropped rather
 *  than walked.
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

  /** @type {Set<string>} marked names that no source under `sources` declared */
  const unmappedClasses = new Set();

  const tracker = [0];

  // cogent's own directories join the caller's, deduped by resolved path so
  // naming one of them explicitly costs nothing, and existence-checked so a
  // renamed or absent directory is dropped rather than walked
  const scanned = [
    ...new Set(
      [...sources, ...COGENT_SOURCES]
        .map((dir) => path.resolve(dir))
        .filter((dir) => existsSync(dir)),
    ),
  ];

  return {
    name: "scoped-class-rewrite",

    // this will run before anything else and respects async; necessary to
    // fully build the static sites and get the minified css before moving
    // forward
    async buildStart() {
      // rollup keeps one plugin instance across every rebuild of a watch, so
      // the state below outlives a build unless it is cleared. A counter left
      // where the last build stopped hands the same class a new name while
      // rollup's transform cache still serves the old one, and the stylesheet
      // and the js then disagree
      classMap.clear();
      foundClasses.clear();
      reservedNames.clear();
      unmappedClasses.clear();
      tracker.length = 1;
      tracker[0] = 0;

      if (isProduction && !sources.length)
        console.warn(
          "Scoped classes: no `sources` given, so only cogent's own classes can be minified.",
        );

      await buildClassMap();

      // whatever else needs the map before a module is transformed -- rendering
      // static templates, say. Handed the rewriter rather than being named
      // here, so this plugin never learns what a site is. Text in, text out --
      // only `transform` has any use for the edits themselves
      await onClassMapReady?.((str) => rewriteColonClasses(str).toString());
    },

    // rewrite :::name::: in js only; stylesheets are postcss's job, and it asks
    // for names through getScopedNameHandler below
    transform(code, id) {
      if (!id.endsWith(".js")) return null;

      // dependencies included. Cogent itself is one -- an app installs it at
      // node_modules/cogent and its components carry markers of their own, so
      // skipping node_modules would leave every one of them unrewritten
      const magic = rewriteColonClasses(code);

      if (!magic.hasChanged()) return null;

      return {
        code: magic.toString(),

        // Always, and from the surgical edits rather than a whole-file
        // overwrite. The spa turns sourcemaps on in development, so a map
        // withheld outside production is withheld exactly when it is wanted,
        // and a map built from one file-sized replacement points every line at
        // the top of the file.
        // cast because the two libraries disagree on paper and not in fact:
        // magic-string types `sourcesContent` as (string|null)[], rollup wants
        // string[], and a null entry is legal in the source map spec
        map: /** @type {import("rollup").SourceMapInput} */ (
          magic.generateMap({ hires: true })
        ),
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

      for (const original of unmappedClasses)
        console.warn(
          `Marked CSS class found outside \`sources\`, so it was left unminified => :::${original}:::`,
        );

      for (const [original, minified] of classMap)
        if (!foundClasses.has(original))
          console.warn(
            `Minified CSS class not found in stylesheets => original → :::${original}::: minified → ${minified}`,
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
  async function buildClassMap() {
    if (!isProduction) return;

    /** @type {string[]} */
    const files = [];

    for (const dir of scanned)
      forEachFile(dir, (file) => {
        // a scanned directory's own dependencies are not its source, and
        // cogent's carries one of its own once installed
        if (path.relative(dir, file).split(path.sep).includes("node_modules"))
          return;

        const ext = path.extname(file);

        if (ext === ".css" || MARKED_SOURCE.has(ext)) files.push(file);
      });

    // read at once rather than one after another. Every source tree is walked
    // before a single module is loaded, so this is latency nothing else is
    // overlapping with, and read order does not matter: both halves land in a
    // set and the names are assigned from the sorted result below
    const contents = await Promise.all(
      files.map((file) => readFile(file, "utf8")),
    );

    const marked = new Set();

    for (const [index, file] of files.entries()) {
      const source = contents[index];

      if (path.extname(file) === ".css") {
        for (const [, name] of source.matchAll(CSS_CLASS))
          reservedNames.add(name);
      } else {
        for (const [, name] of source.matchAll(MARKED_CLASS)) marked.add(name);
      }
    }

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

        // a carry off the front opens a new digit, and that digit starts at the
        // first letter. Incrementing it here as well is what used to skip the
        // whole of `aa` through `a9` -- 63 of the cheapest names available, and
        // the same loss again at every length after
        if (last === 0) {
          tracker.unshift(0);

          break;
        }

        tracker[--last]++;
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

      // A name only reaches here unmapped when it lives outside `sources`.
      // Minting one now would be worse than leaving it alone: postcss reads a
      // stylesheet the moment it reaches one and has already answered for this
      // name, so whichever half asked first would win and the rule would stop
      // matching. Unmapped means unchanged on both sides instead -- unminified,
      // and warned about once the bundle is written
      if (isProduction && !classMap.has(original))
        unmappedClasses.add(original);

      magic.overwrite(start, end, classMap.get(original) ?? original);
    }

    return magic;
  }
}
