// everything the platform will stop at, before the exclusions in `isFocusable`
// are applied. `details > summary:first-of-type` rather than `summary`, since
// only the first summary of a details is focusable and a stray one is not
const FOCUSABLE = [
  "a[href]",
  "area[href]",
  "audio[controls]",
  "video[controls]",
  "button",
  "details > summary:first-of-type",
  "iframe",
  'input:not([type="hidden"])',
  "select",
  "textarea",
  '[contenteditable=""]',
  '[contenteditable="true"]',
  "[tabindex]",
].join(",");

/**
 * The focusable elements inside a root, in document order.
 *
 * `inert` already keeps focus out of everything behind a modal, but aria still
 * asks a dialog to wrap focus at its own edges rather than let it escape to the
 * browser chrome, and that needs the list.
 *
 * Document order, not tab order: a positive `tabindex` jumps the queue in a real
 * traversal and is not accounted for here. Positive values are discouraged
 * enough that the cost of sorting for them is not worth paying on every Tab.
 *
 * @param {Element} root
 * @returns {HTMLElement[]}
 */
export function getFocusableElements(root) {
  return /** @type {HTMLElement[]} */ (
    [...root.querySelectorAll(FOCUSABLE)].filter(isFocusable)
  );
}

/**
 * Whether an element can actually take focus right now -- not merely whether it
 * is the kind of element that could.
 *
 * @param {Element} element
 * @returns {boolean}
 */
export function isFocusable(element) {
  if (!element.matches(FOCUSABLE)) return false;

  // `:disabled` rather than `[disabled]`, so a control inside a disabled
  // fieldset is excluded too -- it has no attribute of its own to test
  if (element.matches(":disabled")) return false;

  // a negative tabindex is reachable by script but not by tabbing, which is the
  // only traversal this list is for
  if (Number(element.getAttribute("tabindex")) < 0) return false;

  // closest covers the element itself as well as its ancestors
  if (element.closest("[inert]")) return false;
  if (element.closest('[aria-hidden="true"]')) return false;

  const { display, visibility } = getComputedStyle(element);

  // visibility inherits, so reading it here catches a hidden ancestor without
  // walking one. Neither hidden state is focusable, and neither is caught by
  // the box checks below -- a visibility: hidden element still has boxes
  if (display === "none" || visibility === "hidden") return false;

  // rendered at all. getClientRects picks up what the offsets miss, notably an
  // inline element whose own width and height are zero
  return Boolean(
    /** @type {HTMLElement} */ (element).offsetWidth ||
      /** @type {HTMLElement} */ (element).offsetHeight ||
      element.getClientRects().length,
  );
}
