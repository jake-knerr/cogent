import { delay } from "./timers.js";

/**
 * A message carried out of a `catch`: whatever the failure happened to say,
 * passed through for a human to read. It is not a code, so nothing should
 * branch on it -- it names the routes whose failures were never enumerated.
 * These are the ones that arrive with a 500: the status carries what the
 * message cannot, since the client could not have anticipated it.
 *
 * The `& {}` is what makes it worth writing. A plain `string` swallows any
 * literal beside it, so `"Invalid ticker." | string` collapses to `string` and
 * the one thing worth knowing is lost; intersected, both survive the union.
 *
 * @typedef {string & {}} UnknownError
 */

/**
 * The envelope every JSON route returns. `fetchJSON` guarantees this shape on
 * every path, including its own failures, so callers can read `ok` without a
 * guard.
 *
 * The error comes first, the way a callback once took `err` ahead of its
 * result. It is a single code, not a list: validators bail on their first
 * failure, so there is only ever one. A route that narrows its failures names
 * them as a union, e.g. `JSONResponse<"cooldown"|"too_many_requests">`.
 *
 * That union is never the whole story, and does not claim to be. An
 * [[UnknownError]] is added to whatever is named, because any route can fail in
 * a way it did not enumerate -- something threw -- and no annotation can
 * promise otherwise. So the argument says what a route refuses *deliberately*,
 * and a route with no deliberate refusals names `never`, which leaves the
 * unknown message on its own.
 *
 * Everything else a route sends rides at the top level rather than in a nested
 * payload -- a resource, or metadata such as the seconds left on a cooldown.
 * Describe those keys with the second argument, e.g.
 * `JSONResponse<never, { positions: Position[] }>`. They are made optional, so
 * one type covers both the success and the failure response.
 *
 * @template {string} [E=never]
 * @template {object} [T={}]
 * @typedef {{ ok: boolean, error?: E | UnknownError } & Partial<T>} JSONResponse
 */

/**
 * A request that produced no usable response: it never completed, or the body
 * was not JSON an envelope could be read from. There is no status to report.
 *
 * Its handler runs before `fetchJSON` resolves, so whatever it does -- toast,
 * dispatch, retry -- has already happened by the time the caller reads the
 * answer.
 *
 * @typedef {Object} RequestErrorReport
 * @prop {string} route
 * @prop {string} message
 * @prop {unknown} [cause]
 * @prop {boolean} [silent] The call asked that its failures not interrupt
 *  anyone. Advisory.
 */

/**
 * A response that arrived carrying a non-2xx status. Only a status decides
 * this, never the envelope: a 2xx answering `ok: false` is an outcome the
 * caller asked for and reads itself, while a non-2xx is the transport saying
 * something went wrong for reasons no single call site owns -- a 500 worth
 * retrying, a 401 worth sending everyone to a login. That is what a handler
 * here is for. `error` holds the code the server sent, when it sent one.
 *
 * Only fires once a response has arrived, so a `status` is always present; a
 * request that never completed goes to `onRequestError` instead. Its handler
 * runs before `fetchJSON` resolves.
 *
 * @typedef {Object} ResponseErrorReport
 * @prop {string} route
 * @prop {string} message
 * @prop {number} status
 * @prop {string} [error]
 * @prop {boolean} [silent] The call asked that its failures not interrupt
 *  anyone. Advisory.
 */

/**
 * Every envelope that parsed, handed over before the caller sees it. The status
 * is 2xx by definition, since a non-2xx never reaches the parse, so this is
 * where an `ok: false` that no single call site owns can still be noticed --
 * a toast, a dispatch -- without the caller having to remember to raise it.
 *
 * `response` is the object the caller receives, not a copy of it.
 *
 * @typedef {Object} ResponseReport
 * @prop {string} route
 * @prop {number} status
 * @prop {JSONResponse<string, any>} response
 * @prop {boolean} [silent] The call asked that its failures not interrupt
 *  anyone. Advisory.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 250;

// a failure the same request could survive: the connection never landed, or the
// server said it was momentarily unable rather than unwilling
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);

// the methods a server may repeat without repeating its effect. A timeout says
// nothing about whether the request arrived, so anything else risks asking
// twice for something already done
const IDEMPOTENT_METHODS = new Set(["GET", "HEAD"]);

// fetch rejects outright any request that carries a body on one of these, so
// they are the methods that send none. The same two as above today, but the two
// ideas are unrelated and a later PUT or DELETE would belong to only one
const BODYLESS_METHODS = new Set(["GET", "HEAD"]);

/**
 * Builds a `fetchJSON` bound to the given failure handlers. Supply either or
 * both; a failure with no handler falls back to `console.error` rather than
 * passing silently.
 *
 * All three fire once, after the last attempt and before the returned promise
 * resolves. A retry runs inside the call, so an attempt that was retried is
 * never reported and never reaches the caller: there is no moment where a retry
 * is in flight and anything downstream has an answer to act on.
 *
 * The two error handlers split on whether a response arrived at all;
 * `onResponse` sees every envelope that arrived, `ok: false` included, which is
 * the one place a refusal can be handled once rather than at every call site.
 *
 * `retry` sets the default for every call: one further attempt when the first
 * never launched, went unanswered, or came back 429, 500, 502, 503 or 504. An
 * unanswered request may still have been acted on, which is why it defaults to
 * whether the method is idempotent: a GET recovers from a hiccup on its own
 * while a POST does not repeat itself.
 *
 * Nothing retries on a 4xx, which would refuse identically, nor on a 2xx
 * answering `ok: false`, which is an answer rather than a fault.
 *
 * The pause before that attempt is fixed. A `Retry-After` is deliberately not
 * read: a server asking for a wait long enough to matter is asking for longer
 * than a fetch wrapper should hold its caller, so the one retry goes out on the
 * short delay and a second failure is reported rather than rescheduled.
 *
 * A `silent` call reaches every handler as usual, with the flag on its report.
 * Read it when deciding whether to raise something, and ignore it for whatever
 * has to happen either way.
 *
 * @param {Object} [handlers]
 * @param {boolean} [handlers.retry] Defaults to GET/HEAD; retries only occur
 *  for 429/5XX or when the request never launched or went unanswered.
 * @param {(report: RequestErrorReport) => void} [handlers.onRequestError] A request that produced no usable response.
 * @param {(report: ResponseErrorReport) => void} [handlers.onResponseError] A response that arrived carrying a non-2xx status.
 * @param {(report: ResponseReport) => void} [handlers.onResponse] All 2xx responses.
 */
export function createFetchJSON({
  onRequestError,
  onResponseError,
  onResponse,
  retry: retryByDefault,
} = {}) {
  /**
   * Sends a JSON request and returns the parsed JSON response.
   *
   * Never throws and never returns a non-object: every failure path resolves
   * to `{ ok: false, error: string }`, so callers can read `.ok`
   * unconditionally.
   *
   * @template {object} [T={}]
   * @param {string} route
   * @param {Object} [optArg]
   * @param {string} [optArg.method="GET"]
   * @param {Object} [optArg.body] serialized as the JSON request body
   * @param {number} [optArg.timeoutMS=10000] bounds each attempt rather than
   *  the call, so a request that retries can take about twice this plus the
   *  retry delay
   * @param {boolean} [optArg.retry] overrides the default for this call
   * @param {boolean} [optArg.silent] Asks that a failure not interrupt anyone,
   *  for a request nobody is waiting on -- a poll, a prefetch, an autosave.
   *
   *  A request rather than a guarantee: it arrives at the handlers as a flag on
   *  the report, and they are free to ignore it. Hides nothing either way --
   *  the call returns the same envelope and the failure is still logged.
   * @returns {Promise<JSONResponse<string, T>>}
   */
  async function fetchJSON(
    route,
    { method = "GET", body, timeoutMS = DEFAULT_TIMEOUT_MS, retry, silent } = {},
  ) {
    // normalized once and used everywhere below: read case-sensitively in one
    // place and upper-cased in another, a lowercase "get" both takes a body and
    // counts as idempotent, and fetch rejects a GET that carries one
    const httpMethod = method.toUpperCase();

    const requestBody = BODYLESS_METHODS.has(httpMethod)
      ? undefined
      : JSON.stringify(body ?? {});

    const mayRetry =
      retry ?? retryByDefault ?? IDEMPOTENT_METHODS.has(httpMethod);

    let retryLeft = mayRetry ? 1 : 0;

    while (true) {
      // a controller is spent once it aborts, so an attempt carries its own
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMS);

      // the timer covers the whole attempt, the body read included. A server
      // can send headers and then stall mid-body, and a timer cleared once
      // fetch resolves leaves nothing able to abort that: the promise this
      // returns would never settle and the caller would wait forever
      try {
        let response;

        try {
          response = await fetch(route, {
            method: httpMethod,
            headers: {
              Accept: "application/json",
              // only bodyless methods go without one; the api rejects an unsafe
              // request that declares no json content type, so those send {}
              // rather than drop the header. Accept above asks for JSON back
              ...(requestBody === undefined
                ? {}
                : { "Content-Type": "application/json" }),
            },
            body: requestBody,
            signal: controller.signal,
          });
        } catch (error) {
          // nothing arrived, so nothing says whether the server acted. Only a
          // request that may be repeated safely gets asked again
          if (retryLeft) {
            retryLeft -= 1;

            await delay(RETRY_DELAY_MS);

            continue;
          }

          return reportRequestError(
            route,
            testTimedOut(error)
              ? `Request to ${route} timed out after ${timeoutMS}ms.`
              : `Request to ${route} could not be sent: ${error?.message ?? error}`,
            error,
            silent,
          );
        }

        if (!response.ok) {
          if (retryLeft && RETRY_STATUSES.has(response.status)) {
            retryLeft -= 1;

            // nothing reads this body, and an unread stream holds its
            // connection out of the pool until gc finalizes it -- exactly the
            // connections the retry then has to compete for
            await response.body?.cancel().catch(() => {});

            await delay(RETRY_DELAY_MS);

            continue;
          }

          // validators answer 400 with a populated envelope, so the status alone
          // would throw away the only useful part of the response
          let error;

          try {
            const body = await response.json();

            // an empty code is not a code; letting it through would hand the
            // caller a blank message where the status line still had something
            if (typeof body?.error === "string" && body.error)
              error = body.error;
          } catch {
            // a proxy or framework error page is not JSON; the status must speak
          }

          const message =
            error ??
            `Request to ${route} failed with status ${response.status}.`;

          if (onResponseError) {
            onResponseError({
              route,
              message,
              status: response.status,
              error,
              silent,
            });
          } else {
            log(message);
          }

          // the caller's `T` is not in scope for a literal built here, so the
          // extras are left open rather than claimed
          return /** @type {JSONResponse<string, any>} */ ({
            ok: false,
            error: message,
          });
        }

        let resJSON;

        try {
          resJSON = await response.json();
        } catch (error) {
          // a 200 can still carry a non-JSON body: a proxy error page, an empty
          // response. Parsing outside the try would throw past the return
          // contract. A body this broken is not worth asking for twice.
          // The timer covers this read, so an abort here is the deadline
          // rather than a malformed body and has to say so
          return reportRequestError(
            route,
            testTimedOut(error)
              ? `Request to ${route} timed out after ${timeoutMS}ms.`
              : `Request to ${route} returned a body that is not JSON.`,
            error,
            silent,
          );
        }

        // callers read `.ok` unconditionally, so a body carrying no boolean
        // `ok` is not an envelope however well formed it is as json. Catches
        // null and primitives, and arrays and payloads that lost their wrapper
        if (
          !resJSON ||
          typeof resJSON !== "object" ||
          typeof resJSON.ok !== "boolean"
        )
          return reportRequestError(
            route,
            `Request to ${route} returned an unexpected body.`,
            undefined,
            silent,
          );

        // a 2xx that answers `ok: false` is the server's considered answer, not
        // a failure of the exchange, so it goes back untouched for the caller to
        // read. The global handler gets first sight of it either way
        if (onResponse)
          onResponse({
            route,
            status: response.status,
            response: resJSON,
            silent,
          });

        return resJSON;
      } finally {
        window.clearTimeout(timeoutId);
      }
    }
  }

  // the only abort this wrapper installs is its own deadline, so an AbortError
  // coming back out of one is the timeout and never a caller cancelling
  function testTimedOut(error) {
    return error instanceof DOMException && error.name === "AbortError";
  }

  /**
   * The wrapper's own failures carry no route keys, but the caller's `T` is
   * not in scope here, so the extras are left open rather than claimed.
   *
   * @returns {JSONResponse<string, any>}
   */
  function reportRequestError(route, message, cause, silent) {
    if (onRequestError) {
      onRequestError({ route, message, cause, silent });
    } else {
      log(message, cause);
    }

    return { ok: false, error: message };
  }

  function log(message, cause) {
    if (cause === undefined) {
      console.error(message);
    } else {
      console.error(message, cause);
    }
  }

  return fetchJSON;
}
