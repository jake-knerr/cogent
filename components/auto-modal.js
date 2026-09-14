import { app } from "../host/app.js";
import { RouterEventTypes } from "../managers/spa-router.js";
import { Modal, modals } from "./modal.js";

/**
 * A modal that takes a history entry, so the back button closes it rather than
 * leaving the view -- the behavior mobile users already expect.
 *
 * `Modal` is a dialog and nothing more: it blocks what is behind it, traps
 * focus, and is closed by whoever opened it. This adds the one thing that needs
 * a router, which is why an application with no routing can still use the base
 * and why `ModalManager` never learned what a history entry is.
 *
 * Do not create internal url state inside this component. If you need history
 * support, then create a Modal that is created/removed/updated via
 * Router.State.
 *
 * The entry is claimed on `show` and spent on close, whichever way the close
 * arrives. A back press reaches the router, which announces the id; this
 * recognizes its own and takes itself down.
 *
 * Open it in the same turn as the gesture that asked for it. Browsers skip
 * back-button stops at entries they judge to be unbacked by user interaction,
 * so an entry pushed after an `await` is quietly passed over and the modal
 * loses its back press. When the modal cannot exist until something resolves,
 * `reserve` claims the entry while the gesture is still fresh.
 */
export class AutoModal extends Modal {
  /** @type {string|undefined} */
  #modalID;

  /**
   * Claims a history entry now for a modal that cannot be built yet, so it is
   * pushed while the gesture that asked for it is still fresh.
   *
   * Hand the id to `show`, or to `release` if the modal never arrives.
   *
   * @returns {string|undefined} Undefined when the router is disabled.
   */
  static reserve() {
    return app.router.addModal();
  }

  /**
   * Hands back an entry from `reserve` whose modal never opened.
   *
   * @param {string} modalID
   */
  static release(modalID) {
    app.router.removeModal(modalID);
  }

  /**
   * Claims the history entry, then raises the modal.
   *
   * @param {string} [modalID] From `reserve`.
   * @returns {this}
   */
  show(modalID) {
    // asked before the entry is claimed, because the manager refuses a modal
    // that is already open, closing, or destroyed, and an entry taken for a
    // refused one would have nothing to spend it
    if (this.destroyed || this.closing || modals.modals.includes(this)) {
      super.show();

      return this;
    }

    this.#modalID = modalID ?? app.router.addModal();

    // attached here rather than in the constructor, so one built and never
    // shown holds nothing. `Component.destroy` releases it on the way out
    app.dispatcher.attach(this, this.#onDismissModal);

    super.show();

    // the manager also refuses everything once it has been torn down, which is
    // the one reason it can refuse that cannot be asked about beforehand. An
    // entry left claimed for a modal that never opened has nothing able to
    // spend it, and the id sits in the router for the rest of the session
    if (!modals.modals.includes(this)) {
      app.router.removeModal(this.#modalID);

      this.#modalID = undefined;
    }

    return this;
  }

  async closeFromManager(optArg) {
    // spent before the animation, so the stack and the history change together.
    // A close that came from the back button finds nothing to hand back: the
    // router drops a modal before announcing it, and the handler below clears
    // the id in any case
    app.router.removeModal(this.#modalID);
    this.#modalID = undefined;

    await super.closeFromManager(optArg);
  }

  #onDismissModal = (event) => {
    if (event.type !== RouterEventTypes.DISMISS_MODAL) return;
    if (event.id !== this.#modalID) return;

    // the router has already dropped it, so there is nothing left to spend
    this.#modalID = undefined;

    // whatever is stacked above goes first. It cannot be left floating over a
    // modal that is on its way out, and only the newest can be closed
    while (modals.top && modals.top !== this) modals.close();

    modals.close(this);
  };
}
