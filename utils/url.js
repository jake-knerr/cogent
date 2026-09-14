// only the path and query are ever read from a parsed url here, so the origin
// is a placeholder that lets a relative one through the URL parser rather than
// a real host. `.invalid` is reserved and resolves nowhere, by design
const BASE = "http://cogent.invalid";

/**
 * A key repeated in a query arrives as an array, the way express reads one, so
 * `?tag=a&tag=b` keeps both rather than dropping all but the last.
 *
 * @typedef {Record<string, string|string[]>} UrlQuery
 */

/**
 * The path segments of a url, empty ones dropped, so `/a//b/` reads as
 * `["a", "b"]`.
 *
 * @param {string} url Absolute, or relative to nothing in particular.
 * @returns {string[]}
 */
export function getPaths(url) {
  return normalizePath(new URL(url, BASE).pathname).split("/").filter(Boolean);
}

/**
 * The query of a url, as an object.
 *
 * Written once here rather than at each call site, because the obvious
 * `Object.fromEntries(searchParams)` silently keeps only the last of a repeated
 * key and nothing about the result says so.
 *
 * @param {string} url Absolute, or relative to nothing in particular.
 * @returns {UrlQuery}
 */
export function getQuery(url) {
  const { searchParams } = new URL(url, BASE);

  /** @type {UrlQuery} */
  const query = {};

  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);

    query[key] = values.length > 1 ? values : values[0];
  }

  return query;
}

/**
 * Collapses repeated slashes, which a path assembled from pieces picks up
 * easily and which would otherwise read as empty segments.
 *
 * Takes a pathname rather than a whole url on purpose: run over one of those it
 * would reach into a query value that legitimately holds `//`.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function normalizePath(pathname) {
  return pathname.replace(/\/{2,}/g, "/");
}
