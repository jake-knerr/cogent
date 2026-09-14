const { NODE_ENV } = process.env;

/**
 * @param {number} bytes
 * @param {number} [decimalPlaces=2]
 */
export function getMegaBytes(bytes, decimalPlaces = 2) {
  return (bytes / (1_024 * 1_024)).toFixed(decimalPlaces);
}

/**
 * @type {boolean}
 */
export const isProduction = NODE_ENV === "production";
