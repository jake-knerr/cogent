import { app } from "../host/app.js";
import { removeResizeHandler } from "../utils/resize.js";

/**
 * @import { TooltipContent } from "./tooltip.js"
 */

/**
 * @typedef {HTMLElement & Object.<string, any>} DOM
 */

/**
 * A wrapper around a DOM element.
 *
 * What a component encapsulates is its **interior** -- the nodes it builds
 * inside its root -- and not the root itself. The root is the face it presents
 * to everything around it, which is why reaching that is ordinary rather than a
 * concession: `classList`, `focus`, `appendTo`, `addEventListener` and
 * `setAttribute` all act on it, and none of them are a way around anything.
 *
 * What the boundary stops is composing into a component from outside: reading
 * or replacing its children, writing `innerHTML`, keeping hold of a node found
 * by querying inside it. That is why `fe` refuses a component as a parent, and
 * why `unsafeDOM` is named the way it is -- not "get the element" but "reach
 * inside", so that every caller is visibly claiming a reason to.
 *
 * Drawing it there is also what makes the public surface additive: a member is
 * added when something needs it, rather than a policy being written about what
 * may be touched. It is why forwarding unknown members to the element wholesale
 * would be the wrong shape -- that hands out the interior, and holding it back
 * again would take exactly the list this avoids.
 *
 * The line is a convention, not a runtime wall. `dom` is `@protected`, which
 * the type checker honors and nothing else does, because real privacy would
 * leave a `Component` subclass unable to extend another one.
 */
export class Component {
  // used for calling destroy() on children
  static #nodeToComponentMap = new WeakMap();

  #dom;
  #destroyed = false;

  // so teardown only reaches for the tooltip manager when this component
  // actually annotated itself, which also means the manager is mounted -- the
  // flag could not have been set otherwise
  #hasTooltip = false;

  /**
   * `@protected` reaches wider than `this`: code inside a class may read it on
   * anything typed as that class or narrower. So `Component` can take another
   * component's `dom` as an argument -- `contains` and `comparePosition` do --
   * while a subclass reaching for a plain `Component`'s is refused (TS2446),
   * which leaves this file the only one with the run of them.
   *
   * @protected
   * @returns {DOM} Intersection of HTMLElement
   *  and other element types.
   */
  get dom() {
    return this.#dom;
  }

  /**
   * @param {Element} element The root to wrap.
   */
  constructor(element) {
    if (!(element instanceof Element))
      throw new Error(
        `A component needs an element for a root; received: ${element}`,
      );

    this.#dom = /** @type {DOM} */ (element);

    Component.#nodeToComponentMap.set(this.#dom, this);
  }

  /**
   * Releases everything the component owns and removes its node, and calls
   * destroy() on every component nested inside it. Safe to call more than once.
   *
   * An override ends with `super.destroy()`, the ordinary way. It used to be
   * wrapped so the base teardown ran whether or not it was called, which read
   * as a convenience and behaved as a trap: a subclass override shadowed the
   * one its own base class had written, and the base's teardown was skipped
   * with nothing to say so.
   */
  destroy() {
    if (this.#destroyed) return;

    this.#destroyed = true;

    // the subtree is walked before the node leaves it, and querySelectorAll
    // answers in document order, so a nested component is destroyed after the
    // one that holds it. The list is static, so a child removing its own node
    // partway through does not disturb the walk. A grandchild this walk reaches
    // after its own parent already destroyed it is skipped because the mapping
    // below is deleted on teardown -- the node is still in the static list, but
    // it no longer answers to a component.
    //
    // Their public destroy() is what runs, not this one: a subclass override is
    // the whole of its teardown, and skipping it would leak whatever it owns
    for (const node of this.#dom?.querySelectorAll("*") ?? [])
      Component.#nodeToComponentMap.get(node)?.destroy();

    app.dispatcher.detach(this);

    // a tooltip describing something that is being removed would be left
    // pointing at nothing
    if (this.#hasTooltip) app.tooltips.removeTarget(this);

    // a no-op for a component that never observed itself, and the reason one
    // that did has nothing to undo
    removeResizeHandler(this.#dom);

    if (this.#dom) Component.#nodeToComponentMap.delete(this.#dom);

    this.#dom?.remove();
    this.#dom = undefined;
  }

  get destroyed() {
    return this.#destroyed;
  }

  // -------------------------------------------------------
  // sanctioned public dom surface
  // -------------------------------------------------------

  /**
   *  @returns {HTMLElement["classList"]|undefined}
   */
  get classList() {
    return this.dom?.classList;
  }

  /**
   * @returns {boolean|undefined}
   */
  get disabled() {
    return this.dom?.disabled;
  }

  /**
   * @param {boolean} value
   */
  set disabled(value) {
    if (this.dom) this.dom.disabled = value;
  }

  /**
   * @returns {boolean|undefined}
   */
  get inert() {
    return this.dom?.inert;
  }

  /**
   * @param {boolean} value
   */
  set inert(value) {
    if (this.dom) this.dom.inert = value;
  }

  /**
   * Whether the root is in the document.
   *
   * False rather than undefined once destroyed, unlike the reads around it: a
   * component that has been torn down is definitively not in the document,
   * where "how wide is it" has no answer at all.
   *
   * @returns {boolean}
   */
  get isConnected() {
    return this.dom?.isConnected ?? false;
  }

  /**
   * The laid-out height in whole pixels, which ignores any css transform on the
   * element. What to measure with while a transform is or might be running:
   * `getBoundingClientRect` reports the painted box instead, so a scale
   * animation in flight reports the scaled size.
   *
   * Zero for an element that is not being rendered.
   *
   * @returns {number|undefined}
   */
  get offsetHeight() {
    return this.dom?.offsetHeight;
  }

  /**
   * The laid-out width, with the same caveats as `offsetHeight`.
   *
   * @returns {number|undefined}
   */
  get offsetWidth() {
    return this.dom?.offsetWidth;
  }

  /**
   * Listens on the component's root, mirroring the element's own method.
   *
   * Sanctioned where reaching for the node is not, because a listener only
   * watches: it cannot restyle the component, move its children, or leave it
   * holding something it did not build. `destroy` does not release these -- a
   * listener on the root goes with the node, and one a caller registered is
   * that caller's to remove.
   *
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} handler
   * @param {boolean|AddEventListenerOptions} [options]
   * @returns {this}
   */
  addEventListener(type, handler, options) {
    this.dom?.addEventListener(type, handler, options);

    return this;
  }

  /**
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} handler
   * @param {boolean|EventListenerOptions} [options]
   * @returns {this}
   */
  removeEventListener(type, handler, options) {
    this.dom?.removeEventListener(type, handler, options);

    return this;
  }

  /**
   * @param {Element} parent
   * @param {InsertPosition} [position]
   * @returns {this}
   */
  appendTo(parent, position = "beforeend") {
    if (this.dom) parent?.insertAdjacentElement(position, this.dom);

    return this;
  }

  blur() {
    this.dom?.blur();
  }

  /**
   * Whether the target sits inside this component's root, itself included.
   * `Node.contains`, taking a component or a bare element, since a component
   * placed inside another arrives as either.
   *
   * @param {Component|Element} target
   * @returns {boolean}
   */
  contains(target) {
    const node = target instanceof Component ? target.dom : target;

    if (!this.dom || !(node instanceof Node)) return false;

    return this.dom.contains(node);
  }

  /**
   * @param {Component} other
   * @returns {number} a compareDocumentPosition bitmask, 0 when unknown
   */
  comparePosition(other) {
    const node = other instanceof Component ? other.dom : undefined;

    if (!this.dom || !node) return 0;

    return this.dom.compareDocumentPosition(node);
  }

  focus() {
    this.dom?.focus();
  }

  /**
   * @param {string} name
   * @returns {string|null|undefined} Null when the attribute is absent, and
   *  undefined once the component has been destroyed.
   */
  getAttribute(name) {
    return this.dom?.getAttribute(name);
  }

  getBoundingClientRect() {
    return this.dom?.getBoundingClientRect();
  }

  /**
   * Whether the root matches the selector. The state pseudo-classes are the
   * usual reason to ask -- `:focus-visible` for whether a focus deserves to be
   * shown, which the browser answers better than tracking input devices does.
   *
   * @param {string} selector
   * @returns {boolean|undefined}
   */
  matches(selector) {
    return this.dom?.matches(selector);
  }

  remove() {
    this.dom?.remove();
  }

  /**
   * @param {string} name
   * @returns {this}
   */
  removeAttribute(name) {
    this.dom?.removeAttribute(name);

    return this;
  }

  /**
   * Writes an attribute on the component's root, mirroring the element's own
   * method.
   *
   * Sanctioned because what a component encapsulates is its interior, not its
   * root: the root is the face it presents, and `classList`, `focus`, `inert`
   * and `appendTo` all reach it already. Composing *into* a component from
   * outside is the thing the boundary exists to stop, and this does not.
   *
   * Nothing is held back, which means `class` and `style` are reachable too.
   * Writing `class` wholesale drops the root class a component is styled by --
   * `classList` is the way to change classes without taking the rest with them.
   *
   * @param {string} name
   * @param {string} value
   * @returns {this}
   */
  setAttribute(name, value) {
    this.dom?.setAttribute(name, value);

    return this;
  }

  /**
   * Annotates the component, so hovering it with a mouse or reaching it with
   * the keyboard raises the shared tooltip. Cleared automatically on destroy.
   *
   * Empty text removes the annotation instead, so a caller can pass a value
   * that may or may not be there without checking first.
   *
   * Throws when the application mounted no tooltip manager, since a component
   * asking for a tooltip that can never appear is a wiring mistake rather than
   * a thing to do quietly.
   *
   * @param {TooltipContent} content
   * @returns {this}
   */
  setTooltip(content) {
    app.tooltips.addTarget(this, content);

    this.#hasTooltip = true;

    return this;
  }

  /**
   * The raw node, outside the sanctioned surface.
   *
   * Reaching past the public API is legitimately necessary sometimes.
   *
   * @returns {DOM}
   */
  unsafeDOM() {
    return this.dom;
  }
}
