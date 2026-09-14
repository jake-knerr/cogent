import "./styles/application.css";

import { fe } from "../utils/fe.js";
import { app, isMounted, mountApp, sealApp } from "../host/app.js";
import { Component } from "./component.js";

/**
 * @typedef {Partial<Omit<typeof app,
 *  "addPopup" | "removePopup" | "setStaticLayerInert"
 * >>} AppManagers
 */

/**
 * The root of a running application: it owns the document's layer structure
 * and mounts required APIs.
 *
 * Subclassed by the app, which supplies `render` and possibly `setup`. Build it
 * with `create` rather than `new`.
 */
export class Application extends Component {
  static #building = false;

  #staticLayerDOM;

  #popupLayerDOM;

  /**
   * Builds the application and starts it.
   *
   * @returns {Application}
   */
  static create() {
    Application.#building = true;

    /** @type {Application} */
    let app;

    // cleared even if a subclass constructor throws, or the next attempt would
    // be waved through by a flag nobody reset
    try {
      app = new this();
    } finally {
      Application.#building = false;
    }

    app.setup((parts) => app.#mount(parts));

    // checked after setup rather than wired before it, so registration is one
    // visible call in the subclass -- and before render, so nothing is built
    // against a half-mounted host. Named one by one rather than trusting
    // `mount` to have supplied its three together: it is not the only way in,
    // since `mountApp` is public until it is sealed
    for (const name of [
      "addPopup",
      "removePopup",
      "setStaticLayerInert",
      "dispatcher",
    ])
      if (!isMounted(name))
        throw new Error(
          `${this.name}.setup() never mounted ${name}. One call to mount({ dispatcher }) supplies it, along with everything else cogent cannot run without.`,
        );

    // nothing registers after this, so a component cannot swap a capability out
    // from under the running application
    sealApp();

    // legal because static Application owns the context here
    app.render(app.#staticLayerDOM);

    return app;
  }

  constructor() {
    if (!Application.#building)
      throw new Error(
        "An Application must be built with create(), not new: the constructor cannot wire or render, since it runs before a subclass's fields exist.",
      );

    super(document.documentElement);

    fe(document.documentElement, { addClass: ":::application:::" });

    fe(
      document.body,

      // default focus is <body> even though it cannot be focused
      // programmatically without a tabIndex; this makes it a safe blur target
      { tabIndex: -1 },
      (this.#staticLayerDOM = fe("div")),
      (this.#popupLayerDOM = fe("div")),
    );
  }

  /**
   * @param {Component} popup
   */
  addPopup(popup) {
    popup.appendTo(this.#popupLayerDOM);
  }

  /**
   * @param {Component} popup
   */
  removePopup(popup) {
    popup.remove();
  }

  /**
   * @param {boolean} inert
   */
  setStaticLayerInert(inert) {
    // inert only. Pairing it with aria-hidden breaks a VoiceOver user's ability
    // (iOS) to arrow out of the modal line by line, and inert already keeps the
    // content out of the accessibility tree
    this.#staticLayerDOM.inert = inert;
  }

  #mount(parts) {
    mountApp({
      addPopup: (popup) => this.addPopup(popup),
      removePopup: (popup) => this.removePopup(popup),
      setStaticLayerInert: (inert) => this.setStaticLayerInert(inert),
      ...parts,
    });
  }

  /**
   * Override to register the application's services. Runs after the whole
   * constructor chain, so a subclass's fields are up, and before `render`, so
   * whatever is mounted here is live by the time the ui is built.
   *
   * One call is expected, and `create` refuses to render without it:
   *
   * ```js
   * setup(mount) {
   *   mount({ dispatcher: componentDispatcher, router });
   * }
   * ```
   *
   * A router is optional -- nothing in cogent reads one until a modal opens.
   *
   * @param {(parts?: AppManagers) => void} mountApp Registers the application,
   *  forwarding `addPopup`, `removePopup` and `setStaticLayerInert` on its
   *  behalf, and takes whatever else the application supplies. Only reachable
   *  here.
   */
  setup(mountApp) {}

  /**
   * Override to build the application's interface into the static layer.
   *
   * @param {HTMLElement} dom The static layer, beneath the popup layer.
   */
  render(dom) {}
}
