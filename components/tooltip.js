import "./styles/tooltip.css";

import { fe } from "../utils/fe.js";
import { getID } from "../utils/id.js";
import { getPopupPosition } from "../utils/popup-position.js";
import { Popup } from "./popup.js";

/**
 * @import {
 *  HorizontalAlignment,
 *  VerticalAlignment,
 * } from "../utils/popup-position.js"
 */

/**
 * What a tooltip says, and where it goes.
 *
 * The placements name the side of the target the tooltip sits on, before any
 * flip needed to keep it on screen. `center` on an axis means it is not pushed
 * to either side of that one, so the default -- centered, below -- hangs the
 * tooltip under the target. Naming a side on both axes puts it at a corner.
 *
 * @typedef {Object} TooltipContent
 * @prop {string} primaryText
 * @prop {string} [secondaryText]
 * @prop {HorizontalAlignment} [placementH="center"]
 * @prop {VerticalAlignment} [placementV="bottom"]
 * @prop {number} [arrowGap] The clearance between this tooltip's arrow tip and
 *  its target, overriding whatever default the manager was built with. For a
 *  target needing more room than the rest -- something with its own outline or
 *  shadow -- rather than a value every tooltip has to share.
 */

/**
 * Clearance between the arrow's tip and the target, which is what the gap
 * looks like rather than what the body is offset by -- the body sits back
 * further, by however far the arrow reaches.
 *
 * The default only: `TooltipManager` takes another for the whole application,
 * and a single target can name its own.
 */
export const ARROW_GAP = 4;

/**
 * The side of the square that is rotated to make the arrow, in pixels.
 *
 * Set here rather than measured from the stylesheet, so the arithmetic that
 * places the arrow needs no layout read at all, and so an application can
 * change it once through `TooltipManager`. The tooltip writes it onto the
 * element, which is why the stylesheet gives the arrow no size of its own.
 *
 * Pixels rather than rem, since the placement needs a number: the arrow is the
 * one part of a tooltip that does not scale with the root font size.
 */
export const ARROW_RECT_SIZE = 10;

// how close to a corner the arrow may slide before it would start to come off
// the rounded edge, which is the border radius plus a little
const ARROW_INSET = 12;

const FADE_MS = 75;
const MOVE_MS = 75;

/**
 * The tooltip itself: one element positioned against whatever target asks for
 * it, sliding between targets rather than being torn down and rebuilt.
 *
 * There is deliberately one of these. Sliding from the last target to the next
 * is only possible while it stays the same element, so a second instance is not
 * a second tooltip -- it is a bug that turns the movement into a flicker.
 * `TooltipManager` owns the instance; nothing else should build one.
 *
 * A view, and only a view. Deciding *when* a tooltip is wanted -- hover, focus,
 * the delays, the dismissals -- belongs to the manager, which is why every
 * listener lives there and none live here. The two the constructor takes are
 * the exception, and they are the manager's own.
 */
export class Tooltip extends Popup {
  #primaryDOM;
  #secondaryDOM;
  #arrowDOM;
  #targetDOM;
  #visible = false;

  /** @type {Animation|undefined} */
  #animation;

  /** @type {Animation|undefined} */
  #arrowAnimation;

  // which edge the arrow is currently held against, so a move that switches
  // sides can skip an animation between two properties that do not compare
  #arrowAxis;

  #arrowRectSize;

  // half the diagonal of the rotated square: how far its corner reaches past
  // the edge it straddles, and so the difference between the gap a caller asks
  // for and the offset the body actually needs
  #arrowReach;

  // the target points here through aria-describedby, so the id has to exist
  // before anything is described and stay put as targets come and go
  #ariaID = `tip-${getID()}`;

  /**
   * @param {Object} [optArg]
   * @param {() => void} [optArg.onPointerEnter] Reached when the pointer moves
   *  onto the tooltip itself. The manager holds the tooltip open for as long as
   *  it does, which is what lets someone magnifying the screen travel to the
   *  tooltip to read it.
   * @param {() => void} [optArg.onPointerLeave]
   * @param {number} [optArg.arrowRectSize] The square's side before rotation.
   *  Defaults to {@link ARROW_RECT_SIZE}.
   */
  constructor({
    onPointerEnter,
    onPointerLeave,
    arrowRectSize = ARROW_RECT_SIZE,
  } = {}) {
    super(
      fe("div.::tooltip::", {
        role: "tooltip",
        on: { pointerenter: onPointerEnter, pointerleave: onPointerLeave },
      }),
    );

    this.#arrowRectSize = arrowRectSize;
    this.#arrowReach = (arrowRectSize * Math.SQRT2) / 2;

    fe(
      this.dom,
      { id: this.#ariaID },
      // a wrapper so the body can clip its own overflow while the arrow, its
      // sibling, still hangs outside it
      fe(
        fe("div"),
        (this.#primaryDOM = fe("div")),
        (this.#secondaryDOM = fe("div")),
      ),
      (this.#arrowDOM = fe("div.::arrow__tooltip::")),
    );

    // the size lives here rather than in the stylesheet, because the arithmetic
    // that places the arrow needs it as a number. Written straight onto the
    // element: an inline style would win over a rule anyway, so putting it
    // through a custom property would only add a second default to keep in step
    this.#arrowDOM.style.width = this.#arrowDOM.style.height =
      `${arrowRectSize}px`;
  }

  /**
   * @returns {boolean}
   */
  get visible() {
    return this.#visible;
  }

  /**
   * Shows the tooltip against a target, moving it there if it is already up.
   *
   * @param {HTMLElement} targetDOM
   * @param {TooltipContent} content
   * @returns {this}
   */
  showFor(
    targetDOM,
    {
      primaryText,
      secondaryText = "",
      placementH = "center",
      placementV = "bottom",
      arrowGap = ARROW_GAP,
    },
  ) {
    const moving = this.#visible;

    // whatever is in flight is abandoned here rather than left to finish, so it
    // cannot land on top of the placement about to be worked out
    this.#stopAnimations();

    // taken before the text changes, and from the live box rather than the
    // inline styles, so a move interrupting a move starts where the tooltip
    // actually is instead of where the last one was heading
    const fromRect = moving ? this.dom.getBoundingClientRect() : undefined;

    if (moving) this.dom.style.width = this.dom.style.height = "";

    this.#setTarget(targetDOM);

    this.#primaryDOM.textContent = primaryText;
    this.#secondaryDOM.textContent = secondaryText;
    this.#secondaryDOM.hidden = !secondaryText;

    // in the layer before being measured, since an element outside the document
    // has no size to read
    if (!moving) this.show();

    // both measured once here and passed down, so nothing below reads layout
    // again after this point
    const targetRect = targetDOM.getBoundingClientRect();
    const popupBox = {
      width: this.dom.offsetWidth,
      height: this.dom.offsetHeight,
    };

    // the gap is to the arrow's tip, so the body has to sit back by however far
    // the arrow reaches past it
    const offset = arrowGap + this.#arrowReach;

    const pos = getPopupPosition(targetRect, popupBox, {
      anchorH: placementH,
      popupH: flipH(placementH),
      anchorV: placementV,
      popupV: flipV(placementV),
      // only the axis the tooltip is offset along has a gap to leave
      offsetH: placementH === "center" ? 0 : offset,
      offsetV: placementV === "center" ? 0 : offset,
    });

    // grows out of the edge or corner nearest the target, so the opening scale
    // reads as the tooltip emerging from it
    this.dom.style.transformOrigin =
      `${flipH(pos.anchorH)} ${flipV(pos.anchorV)}`;

    this.#placeArrow(targetRect, popupBox, pos, moving);

    if (moving) {
      this.#move(fromRect, popupBox, pos);
    } else {
      this.dom.style.left = `${pos.left}px`;
      this.dom.style.top = `${pos.top}px`;

      // nothing to settle: the resting state is what the css already says, so
      // the animation only has to stop holding it
      this.#animation = this.dom.animate(
        [
          { opacity: "0", transform: "scale(0.92)" },
          { opacity: "1", transform: "scale(1)" },
        ],
        { duration: FADE_MS, easing: "linear" },
      );
    }

    this.#visible = true;

    return this;
  }

  /**
   * Fades the tooltip out and takes it back out of the popup layer.
   *
   * @param {Object} [optArg]
   * @param {boolean} [optArg.instant=false] For a dismissal that has to be
   *  believed immediately -- a scroll, a click, the escape key -- where a
   *  tooltip still fading looks like one that did not listen.
   * @returns {this}
   */
  hide({ instant = false } = {}) {
    if (!this.#visible) return this;

    this.#visible = false;

    this.#stopAnimations();
    this.#setTarget(undefined);

    if (instant) {
      super.hide();

      return this;
    }

    const animation = this.dom.animate(
      [
        { opacity: "1", transform: "scale(1)" },
        { opacity: "0", transform: "scale(0.92)" },
      ],
      { duration: FADE_MS, easing: "linear" },
    );

    this.#animation = animation;

    animation.finished
      // a show that interrupts this fade cancels it, and the layer is then
      // exactly where the tooltip needs to stay
      .then(() => {
        if (this.#animation === animation) super.hide();
      })
      .catch(() => {});

    return this;
  }

  destroy() {
    this.#stopAnimations();
    this.#setTarget(undefined);

    super.destroy();
  }

  #move(fromRect, popupBox, pos) {
    // the resting position is written first, so when the animation lets go the
    // element is already where it belongs. Settling afterwards would leave one
    // frame back at the old position
    this.dom.style.left = `${pos.left}px`;
    this.dom.style.top = `${pos.top}px`;

    this.#animation = this.dom.animate(
      [
        {
          left: `${fromRect.left}px`,
          top: `${fromRect.top}px`,
          width: `${fromRect.width}px`,
          height: `${fromRect.height}px`,
        },
        {
          left: `${pos.left}px`,
          top: `${pos.top}px`,
          width: `${popupBox.width}px`,
          height: `${popupBox.height}px`,
        },
      ],
      { duration: MOVE_MS, easing: "linear" },
    );
  }

  #placeArrow(targetRect, popupBox, pos, moving) {
    // known rather than measured, so nothing here reads layout
    const half = this.#arrowRectSize / 2;
    const style = this.#arrowDOM.style;

    const axis = pos.anchorV !== "center" ? "left" : "top";

    // read before the offsets are cleared below, and off the inline style
    // rather than the computed one: what was written last time is exactly what
    // is wanted, and it costs no layout to ask for it
    const from =
      moving && this.#arrowAxis === axis ? style[axis] : undefined;

    style.top = style.right = style.bottom = style.left = "";

    // the face turned toward the target. An axis the tooltip is centered on is
    // not a side of the target at all, so the other one carries the arrow
    const vertical = axis === "left";

    if (vertical) {
      style[pos.anchorV === "bottom" ? "top" : "bottom"] = `-${half}px`;
    } else {
      style[pos.anchorH === "right" ? "left" : "right"] = `-${half}px`;
    }

    // aimed at the middle of the target rather than the middle of the tooltip,
    // which is what keeps it pointing after a slide, a flip, or a corner
    // placement where the two are nowhere near each other
    const center = vertical
      ? targetRect.left + targetRect.width / 2 - pos.left
      : targetRect.top + targetRect.height / 2 - pos.top;

    const span = vertical ? popupBox.width : popupBox.height;

    // the rotated square is wider than its box along the face it sits on, so
    // the corner clearance is measured from its reach, not its half-width
    const near = ARROW_INSET + this.#arrowReach;

    // the far limit is floored at the near one, so a tooltip too small to hold
    // both still resolves rather than inverting
    const offset = Math.min(
      Math.max(center, near),
      Math.max(near, span - near),
    );
    const value = `${offset - half}px`;

    style[axis] = value;
    this.#arrowAxis = axis;

    if (!from) return;

    this.#arrowAnimation = this.#arrowDOM.animate(
      [{ [axis]: from }, { [axis]: value }],
      { duration: MOVE_MS, easing: "linear" },
    );
  }

  #setTarget(targetDOM) {
    this.#targetDOM?.removeAttribute("aria-describedby");
    this.#targetDOM = targetDOM;

    targetDOM?.setAttribute("aria-describedby", this.#ariaID);
  }

  #stopAnimations() {
    this.#animation?.cancel();
    this.#arrowAnimation?.cancel();

    this.#animation = this.#arrowAnimation = undefined;
  }
}

// the point on the tooltip that meets the target is the opposite of the side it
// sits on: a tooltip below the target meets it with its top edge. One per axis
// rather than one shared, so neither can be handed the other's vocabulary
function flipH(placement) {
  if (placement === "left") return "right";
  if (placement === "right") return "left";

  return "center";
}

function flipV(placement) {
  if (placement === "top") return "bottom";
  if (placement === "bottom") return "top";

  return "center";
}
