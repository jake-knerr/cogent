// NOTE ensure not sharing the same name as a typescript file in the directory
// or this file will be shadowed

/**
 * Ambient types that have no source implementation.
 */

/**
 * @typedef {{[key: string]: any}} POJO
 */

/**
 * @template T
 * @typedef {T[keyof T]} ValueOf
 */

/**
 * @typedef {string} JsonString
 */

/**
 * What a function answers with, with any promise unwrapped, so a consumer can
 * name a service's return rather than restate it and drift from it.
 *
 * @template {(...args: any) => any} T
 * @typedef {Awaited<ReturnType<T>>} ReturnOf
 */
