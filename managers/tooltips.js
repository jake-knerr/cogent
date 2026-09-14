import {
  ARROW_GAP,
  ARROW_RECT_SIZE,
  Tooltip,
} from "../components/tooltip.js";

/**
 * @import { TooltipContent } from "../components/tooltip.js"
 */

/**
 * What is known about one annotated target.
 *
 * `dom` is learned from the first event rather than asked of the target, which
 * is what keeps the manager off `unsafeDOM`: a component's root is the thing
 * that fires, so `currentTarget` hands it over without anyone reaching inside.
 *
 * @typedef {Object} TooltipTarget
 * @prop {TooltipContent} content
 * @prop {(event: any) => void} handler
 * @prop {HTMLElement} [dom]
 */

// long enough that a pointer crossing a toolbar on its way somewhere else does
// not leave a trail of tooltips behind it
const SHOW_DELAY = 600;

// short enough that leaving one feels immediate, while still covering the gap
// between two adjacent targets so the tooltip slides rather than blinks
const HIDE_DELAY = 200;

// only a beat, since focus lands on the next element in the same tick
const BLUR_DELAY = 20;

// what every annotated target listens for: the two ways a tooltip is asked for
const ASK_EVENTS = ["pointerenter", "focus"];

// and what only the target currently holding the tooltip listens for -- the
// ways it is given up again, which no other target has any use for
const HOLD_EVENTS = ["pointerleave", "blur", "click"];

/**
 * The one tooltip, and every target that can raise it.
 *
 * Owns the whole question of *when* a tooltip is wanted: the hover and focus
 * tracking, the delays, and the dismissals. The tooltip itself only knows how
 * to put itself somewhere, which is why every listener is here and none are
 * there.
 *
 * The view is built on first show rather than at startup, so an application
 * that mounts this and never annotates anything builds no dom for it.
 *
 * No instance is exported. The arrow's size and clearance are settled at
 * construction, so a ready-made one could only ever carry the defaults, and an
 * application wanting anything else would be building its own beside it. One is
 * built and mounted during setup instead:
 *
 * ```js
 * mount({ tooltips: new TooltipManager({ arrowRectSize: 14 }) });
 * ```
 *
 * `Component.setTooltip` reaches whatever was mounted, so nothing else needs to
 * know which instance it is.
 */
export class TooltipManager {
  /** @type {WeakMap<Component|HTMLElement, TooltipTarget>} */
  #targets = new WeakMap();

  /** @type {Tooltip|undefined} */
  #tooltip;

  // the target the tooltip is describing, if any
  #current;

  // which target each source holds, rather than merely whether either holds
  // something. Leaving a hovered target while the keyboard still holds a
  // *different* one has to hand the tooltip back to it, and a pair of booleans
  // cannot tell that apart from the same target being held twice
  #pointerTarget;
  #focusTarget;

  // the pointer resting on the tooltip itself, which is no target at all and
  // still the best reason there is to keep it up
  #onTooltip = false;

  #arrowGap;
  #arrowRectSize;

  #listening = false;
  #destroyed = false;
  #showTimerID;
  #hideTimerID;

  /**
   * @param {Object} [optArg]
   * @param {number} [optArg.arrowGap=ARROW_GAP] The clearance between the
   *  arrow's tip and its target, for every tooltip unless a target names its
   *  own.
   * @param {number} [optArg.arrowRectSize=ARROW_RECT_SIZE] The side of the
   *  square rotated to make the arrow, for every tooltip. Set once here rather
   *  than per target, since an application has one arrow, not one per
   *  annotation.
   */
  constructor({
    arrowGap = ARROW_GAP,
    arrowRectSize = ARROW_RECT_SIZE,
  } = {}) {
    this.#arrowGap = arrowGap;
    this.#arrowRectSize = arrowRectSize;
  }

  /**
   * The tooltip, once something has raised one. For a caller that needs to ask
   * whether one is up, rather than to build one.
   *
   * @returns {Tooltip|undefined}
   */
  get tooltip() {
    return this.#tooltip;
  }

  /**
   * Annotates a target, so hovering it with a mouse or reaching it with the
   * keyboard raises the tooltip. Annotating an already-annotated target
   * replaces its text, on screen as well as for next time.
   *
   * Empty text removes the annotation, which lets a caller feed it a value that
   * may or may not be there without checking first.
   *
   * @param {Component|HTMLElement} target
   * @param {TooltipContent} content
   */
  addTarget(target, content) {
    if (!target) return;

    // said out loud rather than ignored: annotating through a manager that is
    // finished looks like it worked and never raises anything
    if (this.#destroyed) {
      if (__DEV__)
        console.warn(
          "TooltipManager.addTarget() was called after destroy(), and does nothing.",
        );

      return;
    }

    if (!content?.primaryText) return this.removeTarget(target);

    const entry = this.#targets.get(target);

    if (entry) {
      entry.content = content;

      // re-annotated while its own tooltip is up, so the new text goes on now
      // rather than waiting for the next hover
      if (this.#current === target && this.#tooltip?.visible)
        this.#render(entry);

      return;
    }

    // one handler per target, closing over which target it belongs to, so an
    // event says where it came from without anything being looked up by node
    const handler = (event) => this.#onTargetEvent(target, event);

    this.#targets.set(target, { content, handler });

    for (const type of ASK_EVENTS) target.addEventListener(type, handler);
  }

  /**
   * Drops the annotation, and takes the tooltip down if it was describing this
   * target. `Component.destroy` calls this for anything it annotated, so a
   * component torn down while its tooltip is up does not leave one pointing at
   * an element that is no longer there.
   *
   * @param {Component|HTMLElement} target
   */
  removeTarget(target) {
    const entry = this.#targets.get(target);

    if (!entry) return;

    // taken down first, while the entry is still here for the hold listeners to
    // be unhooked with
    if (this.#current === target) this.#hide(true);

    for (const type of ASK_EVENTS)
      target.removeEventListener(type, entry.handler);

    this.#targets.delete(target);
  }

  /**
   * Releases the shared tooltip and the listeners the manager holds on the
   * document.
   *
   * Annotated targets keep their own listeners, because a `WeakMap` cannot be
   * enumerated to take them back off -- and keeping a list that could be would
   * pin every target for as long as the manager lived, which is the leak the
   * `WeakMap` is there to avoid. They go inert instead: a destroyed manager
   * raises nothing, and each listener leaves with the element it is on.
   */
  destroy() {
    if (this.#destroyed) return;

    this.#destroyed = true;

    this.#hide(true);

    this.#tooltip?.destroy();
    this.#tooltip = undefined;
  }

  #onTargetEvent(target, event) {
    if (this.#destroyed) return;

    // ahead of the lookup rather than inside the switch, so a tap on a phone
    // costs one type compare and nothing else. A hybrid device answers the
    // hover media query because a mouse *could* be plugged in; the event itself
    // says whether one actually was. Bailing this early skips learning the
    // element below, which a touch-only session never needs -- and a mouse or a
    // keyboard turning up later fills it in then
    if (
      event.type === "pointerenter" &&
      /** @type {PointerEvent} */ (event).pointerType !== "mouse"
    )
      return;

    const entry = this.#targets.get(target);

    if (!entry) return;

    entry.dom = /** @type {HTMLElement} */ (event.currentTarget);

    switch (event.type) {
      case "pointerenter":
        this.#pointerTarget = target;

        // already up means the pointer came straight from another target, and
        // the slide between them is the point of there being one tooltip
        this.#enter(target, this.#tooltip?.visible ? 0 : SHOW_DELAY);

        break;

      case "focus":
        // the browser's own answer to "does this focus deserve a ring", which
        // is the same question as "does it deserve a tooltip" -- and a better
        // answer than tracking the last input device by hand
        if (!entry.dom.matches(":focus-visible")) return;

        this.#focusTarget = target;

        this.#enter(target, 0);

        break;

      case "pointerleave":
        if (this.#pointerTarget === target) this.#pointerTarget = undefined;

        this.#leave(HIDE_DELAY);

        break;

      case "blur":
        if (this.#focusTarget === target) this.#focusTarget = undefined;

        this.#leave(BLUR_DELAY);

        break;

      case "click":
        this.#hide(true);

        break;
    }
  }

  // anything that moves the target out from under the tooltip, or says plainly
  // that it is not wanted
  #onDismissEvent = (event) => {
    if (event.type === "keydown" && event.key !== "Escape") return;

    this.#hide(true);
  };

  #enter(target, delay) {
    this.#clearTimers();
    this.#watch(target);

    if (!delay) {
      this.#show(target);

      return;
    }

    this.#showTimerID = setTimeout(() => this.#show(target), delay);
  }

  #leave(delay) {
    this.#clearTimers();

    // nothing on screen to take down, and any pending show has just been
    // cleared, so there is nothing for a timer to do
    if (!this.#tooltip?.visible) return;

    // the pointer resting on the tooltip is the one hold that is not a target,
    // and the one that most needs the tooltip to stay
    if (this.#onTooltip) return;

    const holder = this.#pointerTarget ?? this.#focusTarget;

    if (!holder) {
      this.#hideTimerID = setTimeout(() => this.#hide(), delay);

      return;
    }

    // still held by what is on screen, so there is nothing to do
    if (holder === this.#current) return;

    // held, but by something else: a keyboard focus left behind while the
    // pointer wandered onto another target and off again. The tooltip goes back
    // to it rather than sitting on a target nothing points at any more
    this.#enter(holder, 0);
  }

  #show(target) {
    this.#clearTimers();

    const entry = this.#targets.get(target);

    // the target can be dropped, or the element removed, between a delayed show
    // being scheduled and coming due
    if (!entry?.dom?.isConnected) return;

    // asked per target rather than in general, or a show for one target stays
    // wanted because some other one happens to be held
    if (this.#pointerTarget !== target && this.#focusTarget !== target) return;

    this.#render(entry);
    this.#listen();
  }

  // the entry comes in rather than being looked up again, since both callers
  // are holding it already. Annotated only because `dom` is optional on the
  // typedef and both callers have already established that this one has it
  /** @param {TooltipTarget} entry */
  #render({ content, dom }) {
    this.#tooltip ??= new Tooltip({
      arrowRectSize: this.#arrowRectSize,
      // the pointer moving onto the tooltip holds it open, which is what makes
      // it readable for anyone who has to travel to it -- someone magnifying
      // the screen, where the tooltip can land outside the magnified view.
      // WCAG 1.4.13 exempts the browser's own `title` from this, not ours
      onPointerEnter: () => {
        this.#onTooltip = true;

        this.#clearTimers();
      },
      onPointerLeave: () => {
        this.#onTooltip = false;

        this.#leave(HIDE_DELAY);
      },
    });

    this.#tooltip.showFor(dom, {
      ...content,
      // the target's own answer, then the application's. `??` rather than a
      // spread, so an explicit undefined does not shadow the one below it
      arrowGap: content.arrowGap ?? this.#arrowGap,
    });
  }

  #hide(instant = false) {
    this.#clearTimers();
    this.#watch(undefined);
    this.#unlisten();

    this.#pointerTarget = this.#focusTarget = undefined;
    this.#onTooltip = false;

    this.#tooltip?.hide({ instant });
  }

  // the listeners that only make sense against the target currently in play,
  // moved from one to the next rather than left behind on every target the
  // pointer has ever crossed
  #watch(target) {
    if (this.#current === target) return;

    const previous = this.#current && this.#targets.get(this.#current);

    if (previous)
      for (const type of HOLD_EVENTS)
        this.#current.removeEventListener(type, previous.handler);

    const next = target && this.#targets.get(target);

    if (next)
      for (const type of HOLD_EVENTS)
        target.addEventListener(type, next.handler);

    this.#current = target;
  }

  #listen() {
    if (this.#listening) return;

    this.#listening = true;

    // capturing, so a scroll in any container counts and not only one that
    // reaches the document
    document.addEventListener("keydown", this.#onDismissEvent, true);
    document.addEventListener("scroll", this.#onDismissEvent, true);
    window.addEventListener("resize", this.#onDismissEvent);
  }

  #unlisten() {
    if (!this.#listening) return;

    this.#listening = false;

    document.removeEventListener("keydown", this.#onDismissEvent, true);
    document.removeEventListener("scroll", this.#onDismissEvent, true);
    window.removeEventListener("resize", this.#onDismissEvent);
  }

  #clearTimers() {
    clearTimeout(this.#showTimerID);
    clearTimeout(this.#hideTimerID);

    this.#showTimerID = this.#hideTimerID = undefined;
  }
}
