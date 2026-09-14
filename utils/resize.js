/**
 * What a resize handler is given. Both boxes are reported whatever box is being
 * observed -- the option chooses what counts as a change, not what is measured.
 *
 * @typedef {Object} ResizeEvent
 * @prop {readonly ResizeObserverSize[]} borderBox
 * @prop {readonly ResizeObserverSize[]} contentBox
 */

/** @type {WeakMap<Element, Set<(event: ResizeEvent) => void>>} */
const resizeMap = new WeakMap();

/** @type {ResizeObserver|undefined} */
let resizeObserver;

/**
 * Registers a callback for when the target changes size. More than one may be
 * registered per target, and each is called.
 *
 * - Observation will fire when the watched element is inserted into or removed
 * from the dom.
 * - Observation will fire when the watched element's display is set to none.
 * - Observations do not fire for non-replaced inline elements.
 * - Observations are not triggered by css transforms.
 * - Observation will fire when observation starts, if the element is being
 * rendered and its size is not 0,0.
 *
 * Do not use to get the initial size of an element: the opening observation is
 * withheld for anything unrendered or zero-sized, so it cannot be relied on.
 *
 * `Component.destroy` releases whatever a component registered, so a component
 * that only observes its own root has nothing to undo.
 *
 * @param {Element} target
 * @param {(event: ResizeEvent) => void} handler
 */
export function addResizeHandler(target, handler) {
  let handlers = resizeMap.get(target);

  if (!handlers) {
    handlers = new Set();

    resizeMap.set(target, handlers);
    getResizeObserver().observe(target, { box: "border-box" });
  }

  handlers.add(handler);
}

/**
 * Releases one handler, or every handler on the target when none is named.
 * Observation stops once the last one is gone.
 *
 * @param {Element} target
 * @param {(event: ResizeEvent) => void} [handler]
 */
export function removeResizeHandler(target, handler) {
  // unobserving undefined can silently crash a browser, and there is nothing to
  // release before the first handler has built the observer
  if (!target || !resizeObserver) return;

  const handlers = resizeMap.get(target);

  if (!handlers) return;

  if (handler) {
    handlers.delete(handler);
  } else {
    handlers.clear();
  }

  if (handlers.size) return;

  resizeObserver.unobserve(target);
  resizeMap.delete(target);
}

// built on first use rather than at import, so bringing this module into a
// context without a dom -- a server bundle, a test -- does not throw on the way
// in. One instance is much faster than many; see
// https://github.com/WICG/resize-observer/issues/59
function getResizeObserver() {
  resizeObserver ??= new ResizeObserver((entries) => {
    for (const entry of entries) {
      /** @type {ResizeEvent} */
      const event = {
        borderBox: entry.borderBoxSize,
        contentBox: entry.contentBoxSize,
      };

      for (const handler of resizeMap.get(entry.target) ?? [])
        try {
          handler(event);
        } catch (error) {
          // isolated so one failing handler neither starves the handlers after
          // it nor the entries left in the same batch
          console.error("Resize handler failed:", error);
        }
    }
  });

  return resizeObserver;
}
