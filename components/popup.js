import { app } from "../host/app.js";
import { Component } from "./component.js";

/**
 * A component that lives above the application rather than inside it -- a
 * tooltip, a toast.
 */
export class Popup extends Component {
  /**
   * Puts the popup in the application's popup layer.
   *
   * @returns {this}
   */
  show() {
    app.addPopup(this);

    return this;
  }

  /**
   * Takes it back out while leaving the component intact, for a popup that is
   * shown again later rather than rebuilt. `destroy` is the one that does not
   * come back.
   *
   * @returns {this}
   */
  hide() {
    app.removePopup(this);

    return this;
  }

  destroy() {
    app.removePopup(this);

    super.destroy();
  }
}
