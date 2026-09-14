const NUMBERS = "0123456789";
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";

const alphaOnlyArr = ALPHABET.split("");
const alphaNumericArr = (NUMBERS + ALPHABET).split("");

const alphaLen = alphaOnlyArr.length;
const alphaNumericLen = alphaNumericArr.length;

/**
 * @param {Object} optArg
 * @param {number} [optArg.len=12] The length of the returned `string`.
 * @returns {string}
 */
export function getAlphaID({ len = 12 } = {}) {
  const res = [];

  // math.random not inclusive of 1
  for (let i = 0; i < len; i++)
    res.push(alphaOnlyArr[Math.floor(Math.random() * alphaLen)]);

  return res.join("");
}

/**
 * Uses ASCII. Unique enough
 *
 * @param {Object} optArg
 * @param {number} [optArg.len=12] The length of the returned `string`.
 * @param {boolean} [optArg.startAlpha=true] Start with a letter.
 * @returns {string}
 */
export function getID({ len = 12, startAlpha = true } = {}) {
  const res = [];

  // math.random not inclusive of 1
  for (let i = 0; i < len; i++) {
    if (i === 0 && startAlpha) {
      res.push(alphaOnlyArr[Math.floor(Math.random() * alphaLen)]);
    } else {
      res.push(alphaNumericArr[Math.floor(Math.random() * alphaNumericLen)]);
    }
  }

  return res.join("");
}

/**
 * UUID type IDs not designed for security applications.
 *
 * Deliberately not using crypto for cross-runtime and context support. For
 * example, crypto will not run in a non-https environment.
 *
 * @param {string} [prefix]
 * @returns {string}
 */
export function generatePrefixedID(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}
