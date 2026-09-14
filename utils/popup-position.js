/**
 * Physical. Nothing here mirrors for a right-to-left document -- the axis
 * solver is direction-neutral, so that would go back in at the two boundaries
 * naming these alignments, and nowhere else.
 *
 * @typedef {"left"|"center"|"right"} HorizontalAlignment
 */

/**
 * @typedef {"top"|"center"|"bottom"} VerticalAlignment
 */

/**
 * The part of a `DOMRect` that is read, so a caller can pass a point -- a
 * cursor, a caret, a drop target -- as a zero-sized rect without building a
 * real one.
 *
 * @typedef {{left: number, top: number, width: number, height: number}} Rect
 */

/**
 * @typedef {{width: number, height: number}} Size
 */

/**
 * Where a popup ends up, and everything about how it got there that a caller
 * might need to draw the rest of it.
 *
 * @typedef {Object} PopupPosition
 * @prop {number} left Viewport coordinates, the same space
 *  `getBoundingClientRect` reports in, so they drop straight into a
 *  `position: fixed` popup. Anything positioned inside a scrolled container has
 *  to add that container's scroll back.
 * @prop {number} top
 * @prop {HorizontalAlignment} anchorH The alignments actually used, which are
 *  the ones asked for unless that axis flipped. Whatever points at the anchor
 *  -- a tooltip's arrow, a transform origin -- reads these rather than the
 *  request.
 * @prop {VerticalAlignment} anchorV
 * @prop {HorizontalAlignment} popupH
 * @prop {VerticalAlignment} popupV
 * @prop {boolean} flippedH Whether that axis was turned around to fit.
 * @prop {boolean} flippedV
 * @prop {number} shiftH How far the popup was moved off its alignment to stay
 *  inside the bounds, negative toward the left edge. An arrow subtracts this to
 *  keep pointing at the anchor.
 * @prop {number} shiftV Zero on either axis when the popup fit where it was
 *  asked to go.
 * @prop {number} overflowH How much of the popup is still outside the bounds
 *  once everything above has been tried, which is nothing unless the popup is
 *  bigger than the bounds. Subtract it from the measured size for a max-width
 *  or max-height that fits.
 * @prop {number} overflowV
 */

/**
 * Places a popup so the named point on it meets the named point on its anchor,
 * turning it around and then sliding it if that would put it outside the
 * bounds.
 *
 * The two axes are solved separately and identically, so every combination
 * behaves the same way: a dropdown aligned to its anchor's left edge flips to
 * the right edge when it runs out of room, while one centered under its anchor
 * has no flip to make and slides instead.
 *
 * A flip is taken only when it leaves less of the popup outside than the
 * request did, so an anchor with no room on either side keeps the side that was
 * asked for rather than trading one bad placement for another.
 *
 * Everything past the measuring is arithmetic. The only other dom it reads is
 * the document element, for the default bounds, and only when none are given --
 * so a caller handing over plain rects touches no layout at all.
 *
 * @param {Element|Component|Range|Rect} anchor What the popup is placed
 *  against. Measured with `getBoundingClientRect`, so anything carrying one
 *  works -- a `Range` included, for hanging a popup off a run of selected text.
 *  A plain rect is taken as given.
 * @param {Element|Component|Size} popup Only its size is read; wherever it sits
 *  right now does not matter. Measured with `offsetWidth`/`offsetHeight` where
 *  those exist, which is the laid-out size rather than the painted one, so
 *  measuring partway through an opening scale does not feed the animation back
 *  into the math.
 * @param {Object} [optArg]
 * @param {HorizontalAlignment} [optArg.anchorH="center"] The point on the
 *  anchor the popup is placed against.
 * @param {VerticalAlignment} [optArg.anchorV="bottom"]
 * @param {HorizontalAlignment} [optArg.popupH="center"] The point on the popup
 *  that meets it. The defaults hang the popup below its anchor, centered.
 * @param {VerticalAlignment} [optArg.popupV="top"]
 * @param {number} [optArg.offsetH=0] Pushes the popup further from the anchor
 *  along that axis, and turns around with the axis when it flips. Ignored on an
 *  axis whose popup alignment is `center`, which has no side to be pushed away
 *  from.
 * @param {number} [optArg.offsetV=0]
 * @param {Element|Component|Range|Rect} [optArg.boundRect] What the popup has
 *  to stay inside of, measured the same way the anchor is. A scroll container
 *  goes in directly. Defaults to the viewport, scrollbars excluded.
 * @param {number} [optArg.boundPadding=8] Held clear inside those bounds.
 * @param {boolean} [optArg.flip=true]
 * @param {boolean} [optArg.contain=true] Whether to slide the popup back inside
 *  the bounds. Turning it off leaves the alignment exact and reports what fell
 *  outside.
 * @returns {PopupPosition}
 */
export function getPopupPosition(
  anchor,
  popup,
  {
    anchorH = "center",
    anchorV = "bottom",
    popupH = "center",
    popupV = "top",
    offsetH = 0,
    offsetV = 0,
    boundRect,
    boundPadding = 8,
    flip = true,
    contain = true,
  } = {},
) {
  const anchorRect = getRect(anchor, "anchor");
  const popupSize = getSize(popup, "popup");
  const bounds = getBounds(boundRect, boundPadding);

  // one solver serves both axes by working in a neutral start-to-end
  // vocabulary, running left to right and top to bottom. The alignments are
  // renamed into it on the way in and back out of it on the way out
  const h = solveAxis({
    anchorStart: anchorRect.left,
    anchorSize: anchorRect.width,
    popupSize: popupSize.width,
    anchorAlign: getAxisAlignment(anchorH),
    popupAlign: getAxisAlignment(popupH),
    offset: offsetH,
    boundStart: bounds.left,
    boundEnd: bounds.right,
    flip,
    contain,
  });

  const v = solveAxis({
    anchorStart: anchorRect.top,
    anchorSize: anchorRect.height,
    popupSize: popupSize.height,
    anchorAlign: getAxisAlignment(anchorV),
    popupAlign: getAxisAlignment(popupV),
    offset: offsetV,
    boundStart: bounds.top,
    boundEnd: bounds.bottom,
    flip,
    contain,
  });

  return {
    left: h.pos,
    top: v.pos,
    anchorH: getHorizontalAlignment(h.anchorAlign),
    anchorV: getVerticalAlignment(v.anchorAlign),
    popupH: getHorizontalAlignment(h.popupAlign),
    popupV: getVerticalAlignment(v.popupAlign),
    flippedH: h.flipped,
    flippedV: v.flipped,
    shiftH: h.shift,
    shiftV: v.shift,
    overflowH: h.overflow,
    overflowV: v.overflow,
  };
}

function getRect(target, name) {
  const rect =
    typeof target?.getBoundingClientRect === "function"
      ? target.getBoundingClientRect()
      : target;

  // catches nothing at all as well as a component that has been destroyed,
  // which has no element left to measure and says so by handing back nothing.
  // Both would otherwise surface as a property read on undefined, several
  // frames down inside the arithmetic
  if (!rect)
    throw new Error(
      `getPopupPosition() could not measure the ${name} it was given. A component that has been destroyed has no element left to measure.`,
    );

  return rect;
}

// the laid-out size rather than the painted one. A plain size the caller
// measured stands as it is, and an svg root, having no offset sizes, falls back
// to its painted box
function getSize(target, name) {
  if (typeof target?.offsetWidth === "number")
    return { width: target.offsetWidth, height: target.offsetHeight };

  return getRect(target, name);
}

function getBounds(boundRect, padding) {
  const rect = boundRect
    ? getRect(boundRect, "boundRect")
    : {
        left: 0,
        top: 0,
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      };

  return {
    left: rect.left + padding,
    right: rect.left + rect.width - padding,
    top: rect.top + padding,
    bottom: rect.top + rect.height - padding,
  };
}

// one function for both axes, since the two vocabularies do not collide
function getAxisAlignment(alignment) {
  if (alignment === "left" || alignment === "top") return "start";
  if (alignment === "right" || alignment === "bottom") return "end";

  // anything unrecognized centers, which is a placement rather than a failure,
  // and so goes by unnoticed. Worth saying out loud: this took `start` and
  // `end` until recently, and both now land here
  if (__DEV__ && alignment !== "center")
    console.warn(
      `Unknown popup alignment "${alignment}", placed as "center". Horizontal takes left/center/right, vertical top/center/bottom.`,
    );

  return "center";
}

function solveAxis({
  anchorStart,
  anchorSize,
  popupSize,
  anchorAlign,
  popupAlign,
  offset,
  boundStart,
  boundEnd,
  flip,
  contain,
}) {
  let pos = placeAxis(
    anchorStart,
    anchorSize,
    popupSize,
    anchorAlign,
    popupAlign,
    offset,
  );

  let overflow = measureOverflow(pos, popupSize, boundStart, boundEnd);
  let flipped = false;

  // an axis centered at both ends lands in the same place turned around, so
  // there is nothing to try
  const flippable = anchorAlign !== "center" || popupAlign !== "center";

  if (flip && overflow > 0 && flippable) {
    const otherAnchor = flipAlignment(anchorAlign);
    const otherPopup = flipAlignment(popupAlign);
    const otherPos = placeAxis(
      anchorStart,
      anchorSize,
      popupSize,
      otherAnchor,
      otherPopup,
      offset,
    );

    const otherOverflow = measureOverflow(
      otherPos,
      popupSize,
      boundStart,
      boundEnd,
    );

    // strictly better, so a tie -- an anchor with equally little room on both
    // sides -- keeps the side that was asked for
    if (otherOverflow < overflow) {
      pos = otherPos;
      overflow = otherOverflow;
      anchorAlign = otherAnchor;
      popupAlign = otherPopup;
      flipped = true;
    }
  }

  let shift = 0;

  if (contain && overflow > 0) {
    if (pos + popupSize > boundEnd) shift = boundEnd - (pos + popupSize);

    // second, and unconditional, so a popup larger than its bounds is pinned to
    // the start edge with the remainder hanging off the end rather than the
    // other way around
    if (pos + shift < boundStart) shift = boundStart - pos;

    pos += shift;
    overflow = measureOverflow(pos, popupSize, boundStart, boundEnd);
  }

  return { pos, anchorAlign, popupAlign, flipped, shift, overflow };
}

function placeAxis(
  anchorStart,
  anchorSize,
  popupSize,
  anchorAlign,
  popupAlign,
  offset,
) {
  let pos;

  if (anchorAlign === "start") {
    pos = anchorStart;
  } else if (anchorAlign === "end") {
    pos = anchorStart + anchorSize;
  } else {
    pos = anchorStart + anchorSize / 2;
  }

  if (popupAlign === "start") {
    pos += offset;
  } else if (popupAlign === "end") {
    pos -= popupSize + offset;
  } else {
    pos -= popupSize / 2;
  }

  return pos;
}

// both terms at once, so a popup wider than its bounds is reported as worse
// than one hanging off a single edge
function measureOverflow(pos, size, boundStart, boundEnd) {
  return Math.max(0, boundStart - pos) + Math.max(0, pos + size - boundEnd);
}

function flipAlignment(alignment) {
  if (alignment === "start") return "end";
  if (alignment === "end") return "start";

  return alignment;
}

function getHorizontalAlignment(alignment) {
  if (alignment === "start") return "left";
  if (alignment === "end") return "right";

  return "center";
}

function getVerticalAlignment(alignment) {
  if (alignment === "start") return "top";
  if (alignment === "end") return "bottom";

  return "center";
}
