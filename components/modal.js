import { app } from "../host/app.js";
import { fe } from "../utils/fe.js";
import { getFocusableElements } from "../utils/focus.js";
import { Popup } from "./popup.js";

/**
 * What an animation prop hands back: something to wait on, and something to
 * call it off with. An `Animation` is one, and so is a composite of several --
 * which is the only way to animate more than one element, since a single
 * `Animation` drives a single target and `GroupEffect` never shipped:
 *
 * ```js
 * const backdrop = rootDOM.animate(dim, { duration: 150, fill: "both" });
 * const panel = panelDOM.animate(slide, { duration: 300, fill: "both" });
 *
 * return {
 *   finished: Promise.all([backdrop.finished, panel.finished]),
 *   cancel() {
 *     backdrop.cancel();
 *     panel.cancel();
 *   },
 * };
 * ```
 *
 * The close waits on the slower of the two, and an instant close calls both
 * off. A cancelled `Animation` rejects its `finished` with `AbortError`, which
 * `Promise.all` passes straight through -- and that is what tells a close that
 * was called off from one that faulted.
 *
 * Leave the first keyframe out of a closing animation and it begins wherever
 * the opening one had got to, since an implicit keyframe reads the value
 * underneath it and the open is still running there. So
 * `animate([{ opacity: 0 }], ...)` rather than
 * `animate([{ opacity: 1 }, { opacity: 0 }], ...)`, and a close arriving
 * mid-open joins on instead of jumping.
 *
 * @typedef {{finished: Promise<any>, cancel: () => void}} ModalAnimation
 */

/**
 * @typedef {Object} ModalProps
 * @prop {string} [role="dialog"]
 * @prop {Element|Component} [content] Placed in the root, and destroyed with
 *  the modal: closing tears the modal down, and that walks its subtree
 *  destroying components as it goes. Which is what content built inline for one
 *  showing wants, and `keepContent` is for the other kind.
 * @prop {boolean} [keepContent=false] Whether the content outlives the modal.
 *  It is taken back out of the root before the teardown walk reaches it, so it
 *  survives however the close arrived -- the back button and a route included,
 *  neither of which passes through anything a caller could hook.
 *
 *  For content that moves rather than belongs: a navigation menu that sits in
 *  the page on a wide screen and in a modal on a narrow one. Rebuilding that on
 *  every open would take its state with it each time.
 *
 *  Whoever handed it in owns it from then on, its teardown included.
 * @prop {boolean} [dismissible=true] Whether escape and a click outside the
 *  modal close it -- light dismissal, and the whole of what this governs.
 *  `close` still closes it, `closeOnResize` still does, and so does the back
 *  button, which is the platform's rather than a modal's to refuse.
 *
 *  Outside means outside the modal's own root, so anything else in the popup
 *  layer counts -- a toast, or any other popup standing over it. Something
 *  interactive that has to sit above a modal is a modal itself, which puts it
 *  on top of the stack and hands it the input rather than leaving it to be
 *  clicked through.
 * @prop {boolean} [closeOnResize=false] Whether a viewport resize closes it.
 *  What a dropdown wants, its anchor having just moved out from under it, and
 *  what a dialog does not: a rotation would take a half-filled form with it.
 *
 *  Reaches `close` like everything else, so an override sees it, and is not
 *  governed by `dismissible`: a resize is an anchor going stale rather than a
 *  gesture asking for a dismissal.
 * @prop {(rootDOM: Element) => void} [openFocus] Puts focus somewhere once the
 *  modal has opened -- the first field of a form, say -- for a modal built
 *  rather than subclassed.
 *
 *  Reached once, on open. Focus that escapes afterwards is put back where the
 *  user left it, not sent to the top of the form again.
 *
 *  A hint rather than a promise: if it leaves focus outside the modal, the root
 *  takes it, since the trap would otherwise pull at every focusin from then on.
 * @prop {(rootDOM: Element) => ModalAnimation} [openAnimation] Use
 *  `fill: both` to prevent a flicker at the ends.
 * @prop {(rootDOM: Element) => ModalAnimation} [closeAnimation] Called
 *  synchronously as the close begins. Build the animation and nothing else:
 *  when the close came from a navigation, a `navigate` from here is refused,
 *  since the one already under way is about to write over it.
 *
 *  An opening animation that has not finished is left running, and this one
 *  layers over it -- see `ModalAnimation` for what that buys. For a close that
 *  retraces the open exactly, keep what `openAnimation` handed back and return
 *  `opening.reverse()` instead: it is still live and still where it was.
 * @prop {() => void} [onClose] Reached once, as the modal begins to go, for
 *  every close there is -- a close button, escape, an outside click, `hide`, a
 *  resize, the back button, a route, `closeAll`, and a `destroy` arriving while
 *  it is still open. Runs before the closing animation, so the modal is still
 *  in the layer and still on screen. A notification rather than a veto;
 *  overriding `close` is what refuses one.
 * @prop {() => void} [onDestroy] Reached once the modal is gone rather than
 *  going, after the whole teardown: `destroyed` is true, the content is out,
 *  the stack is unwound and focus is back where it came from. A modal torn down
 *  without ever having been opened reaches this one alone.
 */

/**
 * A dialog that takes over from the application behind it: dropdowns, sheets
 * and alerts included.
 *
 * Knows nothing about history, the popup layer, or what else is open. The
 * manager owns all of that, and nothing using a modal has to hold the manager
 * to say so.
 *
 * There are two sets of methods here and they belong to different callers.
 *
 * `show` and `close` are yours. Both are requests, and both go out through
 * the manager, so a history entry is taken on the way in and spent on the way
 * out. Nothing else is needed to raise a modal: build it and show it.
 *
 * `openFromManager`, `closeFromManager` and `handleManagerDocumentEvent` are
 * reserved for the Manager. Do not call them.
 *
 * The last of those is why a modal registers no listeners of its own: the
 * manager keeps one set for the whole stack and hands each event to the newest
 * modal, which is the only one that takes input.
 *
 * There is no dimmed backdrop here, shared or otherwise. `inert` is what keeps
 * input and focus out of the application behind a modal; a dim is a look, and a
 * modal that wants one covers the screen and carries it on its own root. Then
 * it animates as one piece -- see `ModalAnimation` for a backdrop and a panel
 * moving on different timings -- rather than being choreographed against
 * something the modal does not own.
 */
export class Modal extends Popup {
  #dismissible;

  /** @type {Element|Component|undefined} */
  // held only to take it back out again, so only when it is not the modal's to
  // destroy. Kept as it arrived: an element and a component both answer to
  // `remove`, which is the whole of what is asked of it
  #content;

  #closeOnResize;

  #openFocus;

  // the last thing focused inside, so focus that escapes goes back where the
  // user left it
  #lastFocusDOM;

  #openAnimation;

  #closeAnimation;

  #onClose;

  #onDestroy;

  // whatever is being waited on -- the opening animation, then the closing one
  #animation;

  // the opening animation, once a closing one has been layered over it. Held
  // only so the teardown can call it off, since nothing else will
  #openInFlight;

  #opened = false;

  // set the moment a close begins and never cleared, since the teardown at the
  // end of one is the end of the modal. The closing animation is a window where
  // it is neither open nor destroyed, which is long enough to be shown again
  #closing = false;

  #returnFocusDOM;

  /**
   * @param {ComponentProps & ModalProps} [props]
   */
  constructor({
    content,
    role = "dialog",
    dismissible = true,
    keepContent = false,
    closeOnResize = false,
    openFocus,
    openAnimation,
    closeAnimation,
    onClose,
    onDestroy,
    ...props
  } = {}) {
    super(
      fe("div.:::modal:::", {
        ariaModal: "true",
        role,

        // the container itself has to be able to take focus, so that focus has
        // somewhere to land before anything inside it exists
        tabIndex: -1,
        ...props,
      }),
    );

    this.#dismissible = dismissible;
    this.#closeOnResize = closeOnResize;
    this.#openFocus = openFocus;
    this.#openAnimation = openAnimation;
    this.#closeAnimation = closeAnimation;
    this.#onClose = onClose;
    this.#onDestroy = onDestroy;

    // appends itself when it is a component, so nothing here needs its element
    if (content) fe(this.dom, content);

    if (keepContent) this.#content = content;
  }

  /**
   * Whether a close has begun: the modal is no longer open, and the teardown
   * that ends it has not arrived. True for as long as a closing animation runs,
   * and true forever after, since nothing here reopens.
   *
   * @returns {boolean}
   */
  get closing() {
    return this.#closing;
  }

  /**
   * Raises the modal: takes a history entry, puts the application behind it out
   * of reach, mounts and takes focus.
   *
   * Overrides `Popup`, whose `show` mounts straight into the layer -- which for
   * a modal would skip every one of those and leave the back button with
   * nothing to close.
   *
   * @returns {this}
   */
  show() {
    modals.open(this);

    return this;
  }

  /**
   * Asks to be closed. What escape, an outside click, `hide`, a resize a modal
   * asked to be closed by, and a close button all reach for, so an override
   * catches every one of them.
   *
   * That override is where a modal with a question to ask puts it -- a form
   * with unsaved changes, most often. `super.close()` is the only thing that
   * actually closes, so whatever the question resolves to calls it in turn:
   *
   * ```js
   * close() {
   *   if (this.#dirty) {
   *     this.#askToDiscard();
   *
   *     return;
   *   }
   *
   *   super.close();
   * }
   * ```
   *
   * An override takes the options with it -- `super.close(optArg)` -- or a
   * caller asking for an instant close gets an animated one anyway.
   *
   * An `AutoModal` can be overridden the same way, and the back button still
   * closes it: that arrives at the manager through the router rather than
   * through here, which is what `dismissible` means about the back button
   * always being the platform's.
   *
   * @param {Object} [optArg]
   * @param {boolean} [optArg.instant=false] Skips the closing animation, and
   *  calls off an opening one still in flight. For a close the layout is
   *  waiting on rather than one the user asked for -- content moving back out
   *  to the page as the screen grows, where a fade would show it leaving a
   *  modal it has already left.
   */
  close(optArg) {
    // already going. Asked to be gone now, the animation is the whole of what
    // is left, so calling it off is what finishes the close --
    // `closeFromManager` is waiting on it and tears the modal down as soon as
    // it answers. Asked again without `instant`, this is a close button
    // clicked twice
    if (this.#closing) {
      if (optArg?.instant) this.#animation?.cancel();

      return;
    }

    modals.close(this, optArg);
  }

  /**
   * `close` under another name, because closing a modal is the manager's
   * business either way.
   *
   * `Popup`'s would take the modal out of the layer directly, leaving the
   * manager holding a stack entry and an inert application for something no
   * longer on screen. There is also nothing for a modal to be
   * hidden *to*: it is built for one showing and destroyed on close.
   *
   * @param {Object} [optArg] Taken as `close` takes it.
   * @returns {this}
   */
  hide(optArg) {
    this.close(optArg);

    return this;
  }

  /**
   * The manager's half of `show`, once the history entry is taken. Not the way
   * to raise a modal -- `show` is.
   *
   * @param {Element} [returnFocusDOM] What had focus before the modal was
   *  asked for, to be given it back on close. Taken by the manager rather than
   *  read here, since by the time this runs the application has gone inert and
   *  the focus fixup rule has already moved focus to the body.
   * @returns {Promise<void>} Resolves once any opening animation has finished.
   */
  async openFromManager(returnFocusDOM) {
    // the manager pushes onto its stack before calling this, so anything not on
    // it arrived by a route that skipped everything the stack is there for
    if (!modals.modals.includes(this))
      throw new Error(
        "Raise a modal with modal.show(). openFromManager() is the manager's half, and skips the history entry that makes back work.",
      );

    if (this.#opened) return;

    this.#opened = true;
    this.#returnFocusDOM = /** @type {HTMLElement} */ (returnFocusDOM);

    // Popup's, which mounts into the layer. `this.show` is the request that got
    // us here
    super.show();

    // before the animation rather than after. Focus was moved to the body when
    // the application went inert a moment ago, so waiting would leave it there
    // for as long as the animation runs -- keystrokes going nowhere, and
    // nothing for a screen reader to announce
    if (!this.dom.contains(document.activeElement)) this.focus();

    await this.#animate(this.#openAnimation);
  }

  /**
   * Called by the manager once the history entry is spent. Not the way to close
   * a modal from inside it -- that is `close`.
   *
   * @param {Object} [optArg]
   * @param {boolean} [optArg.instant=false]
   * @returns {Promise<void>} Resolves once any closing animation has finished.
   */
  async closeFromManager({ instant = false } = {}) {
    if (!this.#opened) return;

    // announced from here rather than from `close`, which is only one of the
    // ways in -- the back button, a route and `closeAll` all reach the teardown
    // without passing through it. Before any of the unwinding below, so a
    // handler is given a modal still in the layer and still on screen
    this.#announceClose();

    this.#opened = false;
    this.#closing = true;

    // out of reach for the rest of its life. It stays in the layer until the
    // animation finishes, still on top and still live, while the manager has
    // already moved the stack on -- so a click landing here would be judged
    // outside the modal beneath and close that one instead, which a
    // double-clicked close button manages on its own, and a tab would put focus
    // inside something already on its way out
    this.dom.style.pointerEvents = "none";
    this.inert = true;

    // returned before the animation rather than after it, so focus is not
    // sitting on something mid-fade when a screen reader reads it.
    //
    // Only if it is still in the document: the view behind may have re-rendered
    // while the modal was up, and focusing a detached node does nothing at all
    // while looking like it did something
    if (this.#returnFocusDOM?.isConnected) this.#returnFocusDOM.focus();

    this.#returnFocusDOM = undefined;

    // an opening animation is left running when a closing one is about to
    // cover it. The closing one comes later in composite order and so wins,
    // which is what lets a close with no first keyframe read the open's current
    // value and pick up exactly where it had got to -- and what lets an app
    // that kept the opening animation simply reverse it.
    //
    // An instant close has nothing to cover it with, so that one is called off:
    // left alone it would go on filling over the modal's own styles for
    // whatever it had left to run
    if (instant) {
      this.#animation?.cancel();
    } else {
      this.#openInFlight = this.#animation;
    }

    this.#animation = undefined;

    try {
      if (!instant) await this.#animate(this.#closeAnimation);
    } finally {
      // a modal is built for one showing. Reopening a torn-down one would mean
      // carrying every piece of state above through a second lifetime for no
      // gain, when constructing another costs a line.
      //
      // In a `finally` because a closing animation that faults is app code
      // failing rather than a reason to leave the modal in the layer -- off the
      // stack, with nothing left that could take it out again. The fault still
      // goes on up, where the manager logs it
      this.destroy();
    }
  }

  /**
   * Closes the modal the hard way when it is torn down while still open, which
   * is the one thing the dom cannot do for it, and reaches `onDestroy` once
   * everything else is done.
   *
   * The document listeners belong to the manager, one set for the stack, so
   * there are none here to release.
   */
  destroy() {
    // left on the stack, a destroyed modal is still the one the manager hands
    // every document event to and has no dom to answer with -- so escape and
    // outside clicks stop working for the whole stack while the application
    // behind stays inert, and nothing on screen can close anything. Closing it
    // here unwinds all of that, and spends an `AutoModal`'s history entry
    if (this.#opened) {
      if (__DEV__)
        console.warn(
          "Modal: destroyed while still open. close() is what closes one; this closes it without the animation.",
          this,
        );

      // this is a close, and the only one that never reaches the announcement
      // in `closeFromManager` -- the two lines below are what make its half a
      // no-op, and they have to run before it for the reason given there
      this.#announceClose();

      // before the close rather than after, so the manager's half finds nothing
      // left to do and returns at once -- no animation, and no second destroy
      // from the end of it
      this.#opened = false;
      this.#closing = true;

      // whatever is stacked above goes first. Only the newest can be closed,
      // and one left floating would be over a modal that has gone.
      //
      // Instantly, like this one: a destroy takes no animation, so a modal
      // above that took one would be left fading over the hole this leaves
      while (modals.top && modals.top !== this)
        modals.close(undefined, { instant: true });

      modals.close(this, { instant: true });
    }

    // still set only when the close above was the one that ran, since a close
    // through the manager returns focus itself and clears this. Focus is on the
    // body, where the fixup rule put it when the application went inert, and
    // the un-inerting a moment ago is what lets the trigger take it back
    if (this.#returnFocusDOM?.isConnected) this.#returnFocusDOM.focus();

    // in flight and about to outlive the element they are running on. The
    // opening one is here because a close layered over it rather than calling
    // it off, which leaves this the only thing that will
    this.#animation?.cancel();
    this.#openInFlight?.cancel();

    this.#animation = undefined;
    this.#openInFlight = undefined;

    // taken out before the walk in `super.destroy()` reaches it. Done here
    // rather than at a close site, so it survives the closes the caller does
    // not drive -- the back button and a route among them.
    //
    // Only while it is still in here. A caller that has already put it back
    // where it belongs -- the usual way round on a screen that grew -- would
    // otherwise have it pulled out of its new home
    if (this.#content && this.contains(this.#content)) this.#content.remove();

    // no node outlives the teardown, the trap's last known focus included
    this.#content = undefined;
    this.#returnFocusDOM = undefined;
    this.#lastFocusDOM = undefined;

    super.destroy();

    // last of all, so a handler is given a modal that is done rather than one
    // part way through -- which is also what makes it safe to build a
    // replacement from in there. Taken off the instance as it runs: the base
    // teardown returns early on a second destroy, and this would otherwise be
    // the one part of the teardown that did not
    const onDestroy = this.#onDestroy;

    this.#onDestroy = undefined;

    onDestroy?.();
  }

  // taken off the instance as it runs. The two callers are already exclusive --
  // one sets `#opened` false, which is what shuts the other out -- so this is
  // belt and braces rather than the thing that makes it fire once
  #announceClose() {
    const onClose = this.#onClose;

    this.#onClose = undefined;

    onClose?.();
  }

  /**
   * Where focus goes when the modal opens.
   *
   * Overridable, though a modal built rather than subclassed passes
   * `openFocus` instead. Not what the trap reaches for: focus that escapes
   * later is restored to wherever it was, not sent back through here.
   */
  focus() {
    this.#openFocus?.(this.dom);

    // whatever it did or did not do, focus has to end up inside. Left outside,
    // the trap would pull at it on every focusin from here on
    if (!this.dom?.contains(document.activeElement)) this.dom?.focus();
  }

  /**
   * The manager's half of the document listeners. It keeps one set for the
   * whole stack and hands each event to the newest modal, which is the only one
   * that takes input, so nothing here has to ask whether it is that modal.
   *
   * Not a listener and not registered anywhere. Reserved for the manager, like
   * `openFromManager` and `closeFromManager`.
   *
   * @param {Event} event
   */
  handleManagerDocumentEvent(event) {
    switch (event.type) {
      case "keydown":
        this.#onKeydown(/** @type {KeyboardEvent} */ (event));

        break;

      case "focusin":
        this.#onFocusIn(event);

        break;

      case "pointerdown":
        this.#onPointerDown(event);

        break;

      case "resize":
        this.#onResize();

        break;
    }
  }

  async #animate(handler) {
    const animation = handler?.(this.dom);

    this.#animation = animation;

    try {
      await animation?.finished;
    } catch (error) {
      // a rejected `finished` is what a cancel looks like, and being called off
      // is not a failure -- reduced motion switched on, or a close arriving
      // before the open had finished. Whatever called it off has moved
      // `#animation` on, so this leaves it alone. Anything else is a fault and
      // goes on up, where the manager logs it
      if (/** @type {Error} */ (error)?.name !== "AbortError") throw error;

      return;
    }

    // cancel rather than leave it filling, or the element keeps the animation's
    // computed values instead of its own styles
    animation?.cancel();

    this.#animation = undefined;
  }

  #onKeydown(event) {
    if (event.key === "Escape") {
      if (!this.#dismissible) return;

      event.preventDefault();

      this.close();

      return;
    }

    if (event.key !== "Tab") return;

    // inert already keeps focus out of everything behind, but aria asks a
    // dialog to wrap at its own edges rather than let focus reach the browser
    // chrome, and only the list can say where those edges are
    const focusable = getFocusableElements(this.dom);

    if (!focusable.length) return;

    const index = focusable.indexOf(
      /** @type {HTMLElement} */ (document.activeElement),
    );

    if (event.shiftKey && index < 1) {
      focusable[focusable.length - 1].focus();
      event.preventDefault();
    } else if (!event.shiftKey && index === focusable.length - 1) {
      focusable[0].focus();
      event.preventDefault();
    }
  }

  // conditional here rather than in what gets registered, now that nothing is
  // registered per modal
  #onPointerDown(event) {
    if (!this.#dismissible) return;

    // the root is the dialog, so anything outside it is outside -- another
    // popup in the layer included, since that sits beside a modal rather than
    // inside one
    if (!this.dom.contains(event.target)) this.close();
  }

  // focusin rather than focusout: focusout fires before focus has actually
  // moved, and safari can drop relatedTarget on it
  #onFocusIn(event) {
    // kept while focus is inside, so the trap has somewhere to put it back
    if (this.dom.contains(event.target)) {
      this.#lastFocusDOM = /** @type {HTMLElement} */ (event.target);

      return;
    }

    // asked again on the way in, since a modal may have opened over this one in
    // the meantime and focus belongs to that one now
    queueMicrotask(() => {
      if (modals.top !== this) return;

      // where the user left it, unless that has since gone from the modal --
      // content replaced, a row removed -- in which case the root takes it
      const last = this.#lastFocusDOM;

      if (last?.isConnected && this.dom?.contains(last)) {
        last.focus();
      } else {
        this.dom?.focus();
      }
    });
  }

  #onResize() {
    if (!this.#closeOnResize) return;

    this.close();
  }
}

/**
 * Owns the open modal stack: what is on top, what is buried, what is inert,
 * and where focus goes.
 *
 * Knows nothing about history. A plain `Modal` is opened and closed by whoever
 * built it, and `AutoModal` adds the history entry that lets the back button
 * close one -- so an application with no router can still use modals.
 *
 * Below `Modal` rather than beside it: the two are one feature, and the half
 * anyone reads first is the component. An instance is created at the foot of
 * this file and mounts itself, so importing a modal is all it takes.
 *
 * Only the newest modal can be closed. Closing from underneath would leave the
 * one above it floating over nothing, and for an `AutoModal` it would spend the
 * wrong history entry.
 */
// not exported. `Modal.show`, `close` and the focus trap all reach the one
// instance below by name, so a second manager would hold a stack nothing
// consults. One stack is also the only arrangement where an `AutoModal`'s depth
// and the history's stay the same number, which is what the back button rests
// on
class ModalManager {
  /** @type {Modal[]} Oldest first. */
  #open = [];

  #listening = false;

  #destroyed = false;

  /**
   * The open modals, oldest first.
   *
   * @returns {Modal[]}
   */
  get modals() {
    return [...this.#open];
  }

  /**
   * The only modal that takes input, and the only one that can be closed.
   *
   * @returns {Modal|undefined}
   */
  get top() {
    return this.#open[this.#open.length - 1];
  }

  /**
   * Mounts a modal: puts everything behind it out of reach and hands it
   * focus.
   *
   * Reached through `Modal.show` rather than called directly. An `AutoModal`
   * has already claimed its history entry by the time this runs.
   *
   * @param {Modal} modal
   * @returns {Modal} The modal, for chaining.
   */
  open(modal) {
    if (this.#destroyed) {
      if (__DEV__)
        console.warn(
          "ModalManager: open() was called after destroy(), and does nothing.",
          modal,
        );

      return modal;
    }

    // asked before a history entry is taken, since neither can use one. A modal
    // opened while already up goes on the stack twice and, worse, becomes its
    // own `covered` -- so it turns itself inert, and the dialog the user just
    // asked for cannot be used
    const already = this.#open.includes(modal);

    if (already || modal.destroyed || modal.closing) {
      if (__DEV__) {
        // one still animating out is as final as one already gone: the close it
        // is in the middle of ends in a teardown, so a modal shown again here
        // would be pulled down a moment later by a close it had no part in
        const reason = already
          ? "that modal is already open"
          : modal.destroyed
            ? "that modal has been destroyed, so there is nothing to open"
            : "that modal is closing, and a modal is built for one showing";

        console.warn(`ModalManager: ${reason}. Ignored.`, modal);
      }

      return modal;
    }

    // taken before anything goes inert. The focus fixup rule moves focus to the
    // body the moment an ancestor of the focused element becomes inert, so
    // asking any later finds the body and the modal has nothing to give back
    const returnFocusDOM = document.activeElement;

    // only the newest modal takes input. The first one to open is what puts the
    // app behind it out of reach; the rest bury the modal below them
    const covered = this.top;

    if (covered) {
      covered.inert = true;
    } else {
      app.setStaticLayerInert(true);

      this.#listen();
    }

    this.#open.push(modal);

    // held rather than dropped. Everything after the opening animation lives
    // inside that promise, so a rejection there is otherwise silent
    modal.openFromManager(returnFocusDOM).catch((error) => {
      console.error("ModalManager: a modal failed to open.", error);
    });

    return modal;
  }

  /**
   * Closes the newest modal.
   *
   * @param {Modal} [modal] Checked against the newest, for a caller that has
   *  one in hand. A modal below the top is refused: closing from underneath
   *  would leave the one above it floating over nothing, and for an `AutoModal`
   *  it would take the wrong history entry.
   * @param {Object} [optArg] Handed to the modal's `closeFromManager`, which is
   *  where `instant` is answered.
   */
  close(modal, optArg) {
    const leaving = this.#open[this.#open.length - 1];

    if (!leaving) return;

    if (modal && modal !== leaving) {
      // open, but buried
      if (__DEV__ && this.#open.includes(modal))
        console.warn(
          "ModalManager: only the newest modal can be closed. Ignored.",
          modal,
        );

      // not open at all, which is a second close arriving behind the first --
      // a double-clicked close button. Nothing went wrong and there is nothing
      // to say
      return;
    }

    this.#open.pop();

    // reached before the modal closes, so whatever it returns focus to is
    // already able to take it
    const uncovered = this.top;

    if (uncovered) {
      uncovered.inert = false;
    } else {
      app.setStaticLayerInert(false);

      this.#unlisten();
    }

    leaving.closeFromManager(optArg).catch((error) => {
      console.error("ModalManager: a modal failed to close.", error);
    });
  }

  /**
   * Closes every open modal, newest first.
   *
   * @param {Object} [optArg] Handed to each of them, so `instant` takes the
   *  whole stack down in one turn rather than leaving a row of animations
   *  running.
   */
  closeAll(optArg) {
    while (this.#open.length) this.close(undefined, optArg);
  }

  /**
   * Releases the manager. The modals go with it, and nothing opens through it
   * again.
   *
   * Closing spends history, so a manager torn down with modals still open
   * traverses back over every entry they took -- one move for the lot, not one
   * apiece. Leaving those entries unspent would be worse, since they would stay
   * in the history with nothing left to close, but it does mean this is not a
   * silent teardown.
   */
  destroy() {
    if (this.#destroyed) return;

    this.#destroyed = true;

    // without waiting on their animations. The manager is going, and a modal
    // still fading would be on screen with nothing left that owns it
    this.closeAll({ instant: true });

    this.#unlisten();
  }

  // listened to only while something is open, so an application with no modals
  // on screen has nothing attached. Safe to call during a dispatch: the
  // dispatcher defers the bookkeeping until its stack unwinds
  #listen() {
    if (this.#listening) return;

    this.#listening = true;

    // capturing, so the modal sees these before anything inside it does
    document.addEventListener("keydown", this.#onDocumentEvent, true);
    document.addEventListener("focusin", this.#onDocumentEvent, true);
    document.addEventListener("pointerdown", this.#onDocumentEvent, true);
    addEventListener("resize", this.#onDocumentEvent);
  }

  #unlisten() {
    if (!this.#listening) return;

    this.#listening = false;

    document.removeEventListener("keydown", this.#onDocumentEvent, true);
    document.removeEventListener("focusin", this.#onDocumentEvent, true);
    document.removeEventListener("pointerdown", this.#onDocumentEvent, true);
    removeEventListener("resize", this.#onDocumentEvent);
  }

  // one set for the whole stack rather than one per modal, handed to the newest
  // one because it is the only one that takes input. Registering per modal
  // meant every one of them answered every event and had to be told, four
  // times over, that it was not its turn -- and meant a modal torn down without
  // being closed left four listeners behind holding it
  #onDocumentEvent = (event) => {
    const top = this.top;

    // a destroyed modal takes itself off the stack, so the top is a live one.
    // Guarded all the same: one lingering here would swallow every event for
    // the stack behind it, which shows up as a screen nothing can close rather
    // than as a stack trace
    if (!top || top.destroyed) return;

    top.handleManagerDocumentEvent(event);
  };
}

/**
 * The one manager. Declared below both classes but reached from inside `Modal`,
 * which is legal because those reads happen at call time rather than when the
 * class is defined -- a `static #manager = new ModalManager()` field would have
 * run too early and found nothing.
 *
 * The instance is exported, the class is not: `closeAll` is what an application
 * wants on logout or on an error it cannot recover from, and there is nothing
 * to gain from a second one. Nothing else here needs reaching.
 */
export const modals = new ModalManager();
