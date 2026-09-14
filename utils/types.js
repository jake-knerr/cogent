/**
 * @param {number} value
 * @returns {boolean}
 */
export function testUndefined(value) {
  return value === undefined;
}

/**
 * @param {number} value
 * @returns {boolean}
 */
export function testDefined(value) {
  return value !== undefined && value !== null;
}

/**
 * @param {number} value
 * @returns {boolean}
 */
export function testNumber(value) {
  return typeof value === "number";
}
