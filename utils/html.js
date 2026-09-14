// NOTE split out from utils-xss to keep cjs jsdom out of bundles that
// don't need it

/**
 * @param {string} html
 */
export function escapeHTML(html) {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
