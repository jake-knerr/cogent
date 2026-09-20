/**
 * Waits out `duration` and resolves.
 *
 * The timer is unrefed, so a pending wait never holds a Node process open. The
 * cost is that a process with nothing else to do exits with this promise still
 * pending, and whatever followed the `await` goes unrun. That only comes up
 * once the last ref'd handle is gone -- for a server, after its socket closes
 * -- so a wait during teardown may be abandoned rather than finished. Browsers
 * have no unref and are unaffected.
 *
 * In other words, this will not hold up a server shutdown so if resolve() is
 * required than do not use it.
 *
 * @param {number} duration
 * @returns {Promise<void>}
 */
export function delay(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration).unref?.());
}

/**
 * Waits out `duration` and resolves, holding the process open until it does.
 *
 * The counterpart to cogent's `delay`, whose timer is unrefed so that a pending
 * wait never keeps a process alive. Use this one wherever what follows the
 * `await` has to run -- a caller's write, a reply somebody is waiting on --
 * because an abandoned wait there leaves that work undone and its promise
 * pending forever.
 *
 * @param {number} duration
 * @returns {Promise<void>}
 */
export function delayRefed(duration) {
  return new Promise((resolve) => setTimeout(resolve, duration));
}
