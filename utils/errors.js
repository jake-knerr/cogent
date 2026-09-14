/**
 * @param {Error|any} error
 * @returns {string}
 */
export function parseErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

export class ServerError extends Error {
  /**
   * @param {Object} arg
   * @param {boolean} [arg.crash=false]
   * @param {Error} [arg.err]
   * @param {string} [arg.message]
   * @param {number} [arg.statusCode=500]
   */
  constructor({ err, message, statusCode = 500, crash = false }) {
    super(message ?? err?.message ?? "error", err ? { cause: err } : undefined);

    // Error.prototype.name is "Error" and subclassing does not shadow it, so
    // loggers keying off name would mislabel every one of these
    // new.target meta-property lets you detect whether a function or
    // constructor was called using the new operator and in constructors refers
    // to the constructor that was directly invoked by new
    this.name = new.target.name;

    /**
     * @type {number}
     */
    this.statusCode = statusCode;

    /**
     * @type {boolean}
     */
    this.crash = crash;

    // optional call: V8 only, so a bundle that reaches a non-V8 browser skips
    // it rather than throwing. new.target trims the constructor frame for
    // subclasses too
    Error.captureStackTrace?.(this, new.target);
  }

  /**
   * Message and stack are non-enumerable, so a plain stringify would emit only
   * statusCode and crash and drop the error itself.
   *
   * @returns {{
   *  crash: boolean,
   *  message: string,
   *  name: string,
   *  stack: string|undefined,
   *  statusCode: number
   * }}
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      crash: this.crash,
      stack: this.stack,
    };
  }
}
