/**
 * @param {string} name
 * @returns {string|undefined} undefined when no cookie of that name is set
 */
export function getCookieValue(name) {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.split("=")[1];
}
