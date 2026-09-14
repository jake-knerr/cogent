import { ServerError } from "./errors.js";

/** @typedef {{ code: string, field?: string }} ValidationError */
/** @typedef {{ error?: ValidationError }} ValidationState */
/** @typedef {{ ok: boolean, error?: string, field?: string }} ValidationReport */

/**
 * Records the first failure and ignores every one after it. Validators bail on
 * their first error, so a later code describes a field the request never got
 * far enough to be judged on.
 *
 * @param {ExpressRequest} req
 * @param {string} code
 * @param {string} [field]
 */
export function addRequestError(req, code, field) {
  const validation = getValidation(req);

  validation.error ??= { code, field };
}

/**
 * @param {ExpressRequest} req
 * @returns {ValidationState}
 */
function getValidation(req) {
  const res = req.res;

  if (!res)
    throw new ServerError({
      crash: false,
      message: "validation_response_missing",
    });

  if (!res.locals)
    throw new ServerError({
      crash: false,
      message: "validation_locals_missing",
    });

  return (res.locals.validation ??= {});
}

/**
 * ok is derived rather than stored, so it can never disagree with error. The
 * field is reported for a caller that wants to mark up an input; the client is
 * only sent the code for now.
 *
 * @param {ExpressRequest} req
 * @returns {ValidationReport}
 */
export function getValidationReport(req) {
  const { error } = getValidation(req);

  return { ok: !error, error: error?.code, field: error?.field };
}
