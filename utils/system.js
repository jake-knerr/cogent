const { NODE_ENV } = process.env;

/**
 * @param {number} bytes
 * @param {number} [decimalPlaces=2]
 * @returns {string} fixed to `decimalPlaces`, so it is formatted rather than
 *  arithmetic
 */
export function getMegaBytes(bytes, decimalPlaces = 2) {
  return (bytes / (1_024 * 1_024)).toFixed(decimalPlaces);
}

/**
 * @type {boolean}
 */
export const isProduction = NODE_ENV === "production";
