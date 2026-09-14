/**
 * What cogent needs from whatever application is hosting it, and the shared
 * instances its own classes reach for.
 *
 * It lives under `host/` rather than beside the components or the managers
 * because it is not a category of thing -- it is the boundary. Everything else
 * in cogent sorts by what it is; this sorts by whose it is.
 *
 * It imports nothing, and must not. That is what keeps it a leaf in the module
 * graph, and a leaf cannot take part in a cycle no matter who reaches for it --
 * which is the whole reason anything here is safe to grab from a component six
 * levels down. `@import` is a comment and leaves no runtime edge, so types are
 * free.
 *
 * A stable object with replaceable members rather than a mutable binding, so
 * there is no window where `app` itself is undefined.
 *
 * There are two audiences and only one of them is here. Cogent reaches for
 * `app` where it has no wiring site: a component being destroyed, a modal
 * closing itself, a tooltip looking for the layer above the page. It never
 * needs the application's own types to do any of that, which is why the slots
 * are annotated loosely.
 *
 * Application code should import its typed instances instead -- whatever module
 * created them. `app.router` hands back a `Router<any>`, so reaching for it
 * from app code trades away the state typing an ordinary import would have
 * kept, and does it silently. Convenience is the whole risk: it is right there,
 * and nothing complains.
 *
 * Members come in two kinds, and the difference is deliberate:
 *
 * The **slots** -- `dispatcher` and `router` -- throw when read without
 * having been mounted. Nothing is required to mount them: an application with
 * no routing simply never supplies a router, and only the code that actually
 * reaches for one finds out. Reaching for a slot you did not mount is a
 * programming error, and saying so by name beats a `TypeError` three frames in.
 *
 * The **host callbacks** carry their own answer for not being mounted, because
 * some of them run during teardown, where throwing turns a missing mount into a
 * failed cleanup. `addPopup` throws -- a popup with nowhere to go is broken.
 * `removePopup` and `setStaticLayerInert` stay silent -- there is nothing to
 * undo. Do not "fix" that asymmetry; it is the point.
 */

/** @import {ComponentDispatcher} from "../managers/component-dispatcher.js" */
/** @import {Router} from "../managers/spa-router.js" */
/** @import {TooltipManager} from "../managers/tooltips.js" */

/** @type {Object.<string, any>} */
const mounted = {};

// every name the host has supplied, callbacks included -- the slots above only
// record values, and a callback replaced by `Object.assign` leaves no trace
/** @type {Set<string>} */
const supplied = new Set();

// registration is a phase, not an ongoing capability. Who calls `mountApp` is
// not enforceable in javascript -- anything can import it -- but when they call
// it is, and swapping a capability out from under a running application is the
// mistake worth stopping
let sealed = false;

export const app = {
  /**
   * Fires events to components in document order. Every application has one.
   *
   * @returns {ComponentDispatcher}
   */
  get dispatcher() {
    return required("dispatcher");
  },

  set dispatcher(value) {
    mounted.dispatcher = value;
  },

  /**
   * Reads the url into the application's own state object, and writes it back.
   * Absent in an application that does not route.
   *
   * @returns {Router<any>}
   */
  get router() {
    return required("router");
  },

  set router(value) {
    mounted.router = value;
  },

  /**
   * The one shared tooltip, and the targets that raise it. Absent in an
   * application that does not use tooltips, which is why `Component.setTooltip`
   * says so by name rather than doing nothing.
   *
   * @returns {TooltipManager}
   */
  get tooltips() {
    return required("tooltips");
  },

  set tooltips(value) {
    mounted.tooltips = value;
  },

  /**
   * Puts a popup in the layer above the application.
   *
   * @param {Component} popup
   * @returns {void} Stated, or the throwing stub infers `never` and nothing
   *  real can be assigned over it.
   */
  addPopup(popup) {
    throw new Error(
      "app.addPopup() was reached before mountApp(), so a popup has nowhere to go.",
    );
  },

  /**
   * Takes one back out. The application put it there, so the application is
   * what removes it -- anything it tracks gets a chance to be undone.
   *
   * @param {Component} popup
   */
  removePopup(popup) {},

  /**
   * Puts everything behind the popup layer out of reach, or lets it back.
   *
   * @param {boolean} inert
   */
  setStaticLayerInert(inert) {},
};

/**
 * Fills in what the host provides. Called in pieces as they become available --
 * the shared instances at module load, the application's own capabilities once
 * it exists -- rather than all at once.
 *
 * @param {Partial<typeof app>} parts
 */
export function mountApp(parts) {
  if (sealed)
    throw new Error(
      "mountApp() is closed. The host registers during Application.create(), through setup(), and not afterwards.",
    );

  for (const key of Object.keys(parts)) {
    // filled twice is almost always two of something meant to be one, and the
    // second silently becomes what everything reaches for
    if (__DEV__ && supplied.has(key))
      console.warn(`app.${key} was already mounted, and has been replaced.`);

    supplied.add(key);
  }

  // runs the setters above, so a slot lands in the private store rather than
  // shadowing its own getter
  Object.assign(app, parts);
}

/**
 * Closes registration. `Application.create` calls it once `setup` has run and
 * the required names are accounted for.
 */
export function sealApp() {
  sealed = true;
}

/**
 * Whether the host has supplied a name. For a startup that wants to fail on a
 * missing one rather than wait for the first thing to reach for it.
 *
 * @param {string} name
 * @returns {boolean}
 */
export function isMounted(name) {
  return supplied.has(name);
}

/** @param {string} name */
function required(name) {
  const value = mounted[name];

  if (!value)
    throw new Error(
      `No ${name} on \`app\`. Supply one with mountApp({ ${name} }).`,
    );

  return value;
}
