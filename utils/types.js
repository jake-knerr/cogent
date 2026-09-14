/**
 * @param {unknown} value
 * @returns {value is undefined}
 */
export function testUndefined(value) {
  return value === undefined;
}

/**
 * Both of them, despite the name: null is as absent as undefined to every
 * caller that has asked so far.
 *
 * Generic rather than `unknown`, so the narrowing keeps whatever the caller
 * already knew -- a `string|null` comes out a `string` rather than a `{}`.
 *
 * @template T
 * @param {T} value
 * @returns {value is NonNullable<T>}
 */
export function testDefined(value) {
  return value !== undefined && value !== null;
}

/**
 * NaN is a number here, as it is to `typeof`.
 *
 * @param {unknown} value
 * @returns {value is number}
 */
export function testNumber(value) {
  return typeof value === "number";
}
