import { app } from "../host/app.js";
import { getID } from "../utils/id.js";

import { normalizePath } from "../utils/url.js";

export const RouterEventTypes = /** @type {const} */ ({
  NAVIGATE: "router:navigate",
  DISMISS_MODAL: "router:dismiss-modal",
});

/**
 * @template State
 * @typedef {Object} RouterNavigateEvent
 * @prop {RouterEventTypes["NAVIGATE"]} type
 * @prop {State} state
 * @prop {State} previousState
 */

/**
 * Sent when the back button reaches a modal, or when `navigate` closes one.
 *
 * @typedef {Object} RouterDismissModalEvent
 * @prop {RouterEventTypes["DISMISS_MODAL"]} type
 * @prop {string} id The id `addModal` handed out.
 */

/**
 * Reads the url into a state object the app declares, and writes it back on
 * navigation. Reports both through `app.dispatcher`, so a component
 * listens for `router:navigate` the same way it listens for anything else and
 * is released with the rest of its teardown.
 *
 * A route is entered by calling `navigate`, or by an ordinary `<a href>` once
 * `handleLinks` is on -- an intercepted click calls `navigate` itself, so a
 * link and a call are the same navigation and neither needs to know about the
 * other.
 *
 * Knows of a modal only that it owns a history entry -- not what one looks
 * like, holds, or does. Whatever wants one registers through `addModal`, which
 * pushes the entry a back press lands on, and closes on `router:dismiss-modal`,
 * which spends it.
 *
 * In cogent that is `AutoModal`. A plain `Modal` never registers and the router
 * never hears of it, which is why an application with no routing can still put
 * a dialog on the screen.
 *
 * Nothing about a tracked modal reaches the url, and none survive a reload: a
 * modal worth linking to is a route.
 *
 * @template State
 */
export class Router {
  /** @type {State} */
  #state;

  // kept beside `#state` because every comparison needs it, and the state it
  // describes has not changed since the last one was made
  #stateJSON;

  /** @type {string[]} Modal ids, oldest first. */
  #modals = [];

  #parseUrlState;

  #buildStateURL;

  #prefix;

  #disabled = false;

  // set only across the window where a navigation has decided where it is going
  // but has not written it yet
  #navigating = false;

  // entries spent this turn that no traversal has taken yet
  #pendingTraversal = 0;

  /**
   * @param {Object} arg
   * @param {(url: string) => State} arg.parseUrlState Given the url relative
   *  to the prefix, path and query and hash -- the same string `navigate` takes
   *  and `buildStateURL` answers with, so all three sides agree. `getPaths` and
   *  `getQuery` in `utils/url.js` do the tedious half for a parser that wants
   *  segments rather than the raw string.
   *
   *  Must answer with a plain object of JSON-representable values. It is
   *  compared against the previous state to decide whether a route moved, and
   *  anything JSON cannot carry -- a Date, a Set, a function -- compares as
   *  something it is not. Key order does not matter.
   * @param {(state: State) => string} [arg.buildStateURL] The inverse, and the
   *  only reason `navigate` can take a state object. Answers with a url
   *  relative to the prefix, query included -- the same thing `navigate` takes
   *  as a string, so the two ways in converge immediately.
   * @param {string} [arg.prefix] Not parsed; prepended to all routes navigated
   *  to.
   * @param {boolean} [arg.handleLinks] Turns link interception on as the router
   *  is built, for an app that wants it from the start. Off by default: a
   *  router that begins swallowing clicks the moment it exists would be a
   *  surprise to anyone who only wanted to read the url.
   */
  constructor({
    parseUrlState,
    buildStateURL,
    prefix = "",
    handleLinks = false,
  }) {
    // a trailing slash would leave `#stripPrefix` cutting one character too
    // many, so a route came out without its leading slash, and would break the
    // boundary check in `#inPrefix`. "/" normalizes to no prefix at all, which
    // is what it means
    this.#prefix = normalizePath(prefix).replace(/\/+$/, "");
    this.#parseUrlState = parseUrlState;
    this.#buildStateURL = buildStateURL;

    addEventListener("pageshow", this.#onPageShow);
    addEventListener("popstate", this.#onPopState);

    // an entry counting modals from an earlier load. Nothing is restored, so
    // it can only be describing a stack that no longer exists
    if (history.state?.modals) history.replaceState(null, "", location.href);

    this.#state = this.#getState(location.href);
    this.#stateJSON = serializeState(this.#state);

    if (handleLinks) this.handleLinks();
  }

  /**
   * The current router state. Read-only: it is derived from the url, and a
   * value written over it would last only until the next navigation while
   * quietly breaking the comparison that decides whether one happened.
   *
   * @returns {State}
   */
  get state() {
    return this.#state;
  }

  /**
   * The ids of the modals currently open, oldest first.
   *
   * @returns {string[]}
   */
  get modalIDs() {
    return [...this.#modals];
  }

  /**
   * Goes to a route, dispatching `router:navigate` when the state changes.
   *
   * Reached by a click on an `<a href>` as well, when `handleLinks` is on.
   *
   * Navigating with open tracked modals closes every tracked one, and replaces
   * it. There is no way to ask it not to.
   *
   * That is what keeps every entry carrying a modal count at the same url as
   * the entry below it, which is the whole reason a landed entry's depth is
   * enough to settle the stack. A modal allowed to write the url and stay open
   * breaks it: its entry no longer matches the one beneath, so a back press
   * lands somewhere the depth alone cannot describe, and closing the modal
   * spends only the newest of the entries it made -- leaving the rest behind as
   * back presses that rewind a modal that is no longer there. A view that must
   * survive a url change is a plain `Modal`, which the router never hears of.
   *
   * A stack deeper than one still leaves the rest behind: each is one more back
   * press, landing on the route the stack was opened over, and after the first
   * of them nothing further changes. Collapsing them would take `history.go`,
   * which does count entries exactly -- the skipping browsers do is a back
   * button behavior and never reaches the api -- but answers in a later task.
   * The route would then have to be written from the `popstate` that follows,
   * and writing history from inside a history event is the part that is
   * genuinely unreliable, on ios most of all. So they are left rather than
   * traded for that. Opening a modal over a modal and then navigating is how it
   * is reached -- a dropdown inside a dialog whose item navigates, most often.
   *
   * @param {string|State} target A url relative to the prefix, or a state
   *  object for `buildStateURL` to turn into one. A state states the whole
   *  route, so changing one thing about the current one is a spread --
   *  `navigate({ ...router.state, tab: "2" })` -- which is checked against
   *  `State` and leaves nothing implied.
   * @param {"push"|"replace"} [type] `push` for a route a user asked for,
   *  `replace` for one the app decided on -- a redirect after a save, a
   *  canonicalized path. Forced to `replace` when a modal's entry is being
   *  spent on the route.
   *
   *  Every engine skips back-button stops at entries pushed without a gesture
   *  behind them, so a programmatic push can be quietly unreachable, and it has
   *  no business on the back stack regardless.
   */
  navigate(target, type = "push") {
    if (this.#disabled) return;

    if (this.#navigating) {
      if (__DEV__)
        console.warn(
          "Router: navigate() reached from inside a navigation, most likely a modal closing. Ignored, since this navigation is about to overwrite it.",
        );

      return;
    }

    const url =
      typeof target === "string" ? target : this.#buildStateURL?.(target);

    if (url === undefined) {
      if (__DEV__)
        console.warn(
          "Router: a state object needs a buildStateURL to navigate by. Ignored.",
        );

      return;
    }

    // parsed before normalizing, so collapsing repeated slashes reaches the
    // path and not a query value that legitimately holds them
    const nextURL = new URL(`${this.#prefix}${url}`, location.origin);

    nextURL.pathname = normalizePath(nextURL.pathname);

    const previousState = this.#state;
    const state = this.#getState(nextURL.href);
    const stateJSON = serializeState(state);

    // a route that lands where it started would only add a history entry, and
    // that entry is an implementation detail rather than part of the api
    const moved = stateJSON !== this.#stateJSON;

    // whether a modal's entry is being consumed by this route
    const spent = this.#modals.length > 0;

    // read before the dismissals empty it. Not a mistake and not avoidable --
    // only the current entry can be replaced -- but the symptom shows up much
    // later, looks like nothing at all, and is otherwise a long afternoon
    if (__DEV__ && this.#modals.length > 1)
      console.warn(
        `Router: navigated with ${this.#modals.length} modals open. Only the newest one's history entry can be spent on a route, so the rest are left behind -- each an extra back press that changes nothing. Expected; see navigate().`,
      );

    // closing a modal reaches app code, and app code can navigate. Held only
    // across the dismissals and the history write, because an inner call
    // landing there would be overwritten by this one a moment later --
    // silently, and reporting a previousState from before either of them.
    //
    // A navigate from a `router:navigate` listener is a different thing and
    // stays allowed: `#commit` is the last of this, so an inner call's writes
    // simply land after and win, which is what a redirecting listener wants
    this.#navigating = true;

    try {
      // navigating closes what is open, even when it lands where it started
      this.#dismissModals(0);

      // the entry the top modal pushed is spent on the route rather than
      // stacked on top of
      if (spent) type = "replace";

      if (moved || spent) this.#writeHistoryState(type, nextURL.href);
    } finally {
      this.#navigating = false;
    }

    if (moved) this.#commit(state, stateJSON, previousState);
  }

  /**
   * Routes clicks on ordinary `<a href>` elements through `navigate`, so a view
   * can be reached by a link rather than only by a call. Safe to call twice.
   *
   * Only takes a click the browser would have used to navigate this tab to a
   * route of this app: left button, unmodified, same origin, inside the prefix.
   * A modified click, a `target`, a `download`, `rel="external"`, a bare
   * fragment, or a `data-native` attribute all fall through to the browser
   * untouched, as does a click something else has already handled. A
   * `data-replace` attribute routes without stacking a history entry.
   */
  handleLinks() {
    addEventListener("click", this.#onLinkClick);
  }

  /**
   * Registers a modal, so a back press closes it rather than navigating.
   *
   * Pushes a history entry, which is what a back press lands on. Open the
   * modal from a user gesture and push it in the same turn: an entry a
   * browser judges to be unbacked by interaction is skipped by the back button,
   * and the modal would then be passed over rather than closed.
   *
   * @returns {string|undefined} The modal id, to close it with and to
   *  recognize it by on `router:dismiss-modal`. Undefined when disabled.
   */
  addModal() {
    if (this.#disabled) return;

    const id = getID();

    this.#modals.push(id);

    this.#writeHistoryState("push");

    return id;
  }

  /**
   * Drops the modal on top, spending the history entry it pushed. No
   * `router:dismiss-modal` follows, since the owner is the one saying so.
   *
   * An id already gone is not an error: the router drops a modal before
   * announcing it, so an owner that answers a dismissal by calling this finds
   * nothing and spends nothing.
   *
   * Several in the same turn -- a stack being closed at once -- spend their
   * entries on one traversal rather than a run of separate ones.
   *
   * @param {string} [id] Only the newest modal can be dropped. Modal depth
   *  and history depth are the same number, and every close spends exactly one
   *  entry -- closing from underneath would put the two out of step and leave
   *  the depth on each entry describing a stack that never existed.
   */
  removeModal(id) {
    if (this.#disabled) return;

    const index = this.#modals.indexOf(id);

    if (index === -1) return;

    if (index !== this.#modals.length - 1) {
      if (__DEV__)
        console.warn(
          `Router: ${id} is not the newest modal, and only the newest can be removed. Ignored.`,
        );

      return;
    }

    this.#modals.pop();

    this.#spendEntries();
  }

  /**
   * Freezes the router. Nothing routes and no modal reaches history again,
   * for an app that has hit a state it cannot recover from.
   */
  disable() {
    this.#disabled = true;
  }

  /**
   * Releases the listeners the router holds on the window, and freezes it. For
   * a router that outlives its app -- a test, an embedded view -- rather than
   * the usual one that lives as long as the document.
   */
  destroy() {
    removeEventListener("pageshow", this.#onPageShow);
    removeEventListener("popstate", this.#onPopState);

    // a no-op when handleLinks was never called
    removeEventListener("click", this.#onLinkClick);

    this.#disabled = true;
  }

  // -------------------------------------------------------
  // internals
  // -------------------------------------------------------

  // discard state frozen into the bfcache and reload for a fresh one. Only
  // reachable on the way back from an external site, since a reload never
  // restores from the bfcache; an ios problem, of course
  #onPageShow = (event) => {
    if (event.persisted) location.reload();
  };

  // `popstate` fires once the entry is already current, so the entry reached is
  // the one to settle against, whether it was reached backward or forward
  #onPopState = () => {
    if (this.#disabled) return;

    const target = history.state?.modals ?? 0;

    this.#dismissModals(Math.min(target, this.#modals.length));

    // an entry counting more modals than are open was reached going forward,
    // or by a reload; nothing is restored, so it is describing a stack that is
    // gone. The entry stays, being only an extra back press, but it stops
    // claiming to hold anything
    if (target > this.#modals.length) this.#writeHistoryState("replace");

    this.#syncRoute();
  };

  #onLinkClick = (event) => {
    if (this.#disabled) return;

    // already spoken for, or the user asking for a new tab, a download, or the
    // context menu -- none of which are ours to take
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;

    const anchor = event.target?.closest?.("a[href]");

    if (!anchor || anchor.hasAttribute("download")) return;
    if (anchor.dataset.native !== undefined) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.relList.contains("external")) return;

    // resolved by the dom rather than read off the attribute, so a relative
    // href arrives absolute and a malformed one never reaches the URL parser
    const url = new URL(anchor.href);

    if (url.origin !== location.origin) return;

    const path = normalizePath(url.pathname);

    // another app's route; the browser has to load it
    if (!this.#inPrefix(path)) return;

    // a link to a fragment of the page already showing. Routing it would
    // swallow the scroll the browser is about to do, and nothing would change
    if (
      url.hash &&
      url.search === location.search &&
      path === normalizePath(location.pathname)
    )
      return;

    event.preventDefault();

    this.navigate(
      `${this.#stripPrefix(path)}${url.search}${url.hash}`,
      anchor.dataset.replace === undefined ? "push" : "replace",
    );
  };

  // the browser has already moved, so history is not ours to write here; only
  // the state has to catch up with where it landed
  #syncRoute() {
    const previousState = this.#state;
    const state = this.#getState(location.href);
    const stateJSON = serializeState(state);

    if (stateJSON === this.#stateJSON) return;

    // nothing is dismissed here. The entry landed on already said how many
    // modals belong at it and `#onPopState` applied that a moment ago, so a
    // second pass on the grounds that the route moved too could only contradict
    // it -- and would be unreachable anyway, since a modal's entry carries the
    // url of the entry below it and landing on one never moves the route
    this.#commit(state, stateJSON, previousState);
  }

  #commit(state, stateJSON, previousState) {
    this.#state = state;
    this.#stateJSON = stateJSON;

    app.dispatcher.dispatch(
      /** @type {RouterNavigateEvent<State>} */ ({
        type: RouterEventTypes.NAVIGATE,
        state,
        previousState,
      }),
    );
  }

  // a modal leaves the stack before its listener runs, so an owner that
  // answers by calling removeModal finds nothing and spends no history
  #dismissModals(keep) {
    // newest first, so a stack unwinds in the reverse of the order it was built
    while (this.#modals.length > keep) {
      const id = this.#modals.pop();

      app.dispatcher.dispatch(
        /** @type {RouterDismissModalEvent} */ ({
          type: RouterEventTypes.DISMISS_MODAL,
          id,
        }),
      );
    }
  }

  // one traversal for however many entries were spent this turn. A run of
  // `history.back()` calls is not that: browsers coalesce them, so a stack of
  // five lands somewhere between five and one entry down, and only the depth
  // check on the entry reached puts it right afterwards. `history.go(-n)`
  // counts exactly -- the skipping browsers do is a back button behavior and
  // never reaches the api -- and answers with a single `popstate`.
  //
  // Deferred to a microtask, which is still inside the task the gesture began,
  // so the traversal stands with the browser exactly as an immediate one would
  #spendEntries() {
    if (this.#pendingTraversal++) return;

    queueMicrotask(() => {
      const delta = this.#pendingTraversal;

      this.#pendingTraversal = 0;

      // a router frozen between the close and here. Nothing it holds should
      // move history any more, and the entries are no worse off than the ones
      // an unclosed modal leaves behind
      if (this.#disabled) return;

      history.go(-delta);
    });
  }

  #writeHistoryState(type, url = location.href) {
    const open = this.#modals.length;

    history[type === "push" ? "pushState" : "replaceState"](
      open ? { modals: open } : null,
      "",
      url,
    );
  }

  // the prefix is the router's business, so the parser is handed what is left
  // of the url once it is gone -- the same shape it would pass to `navigate`
  #getState(url) {
    const { pathname, search, hash } = new URL(url);

    const path = this.#stripPrefix(normalizePath(pathname)) || "/";

    return this.#parseUrlState(`${path}${search}${hash}`);
  }

  // the prefix has to end on a segment boundary. A bare `startsWith` counts
  // /application as being inside /app, which strips it to "lication" and,
  // worse, takes a click on a link belonging to another app on this origin
  #inPrefix(pathname) {
    return (
      !this.#prefix ||
      pathname === this.#prefix ||
      pathname.startsWith(`${this.#prefix}/`)
    );
  }

  // anchored to the front, so a prefix appearing again further along the path
  // -- /app/thing/app/other -- is left where it is
  #stripPrefix(pathname) {
    return this.#inPrefix(pathname)
      ? pathname.slice(this.#prefix.length)
      : pathname;
  }
}

// key order is an artifact of how the parser happened to build its object
// rather than a difference in the route, so the keys are sorted on the way out.
// The replacer runs on every object JSON.stringify reaches, so nesting is
// covered without walking it here
function serializeState(value) {
  return JSON.stringify(value, (_key, nested) =>
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? Object.fromEntries(
          Object.keys(nested)
            .sort()
            .map((key) => [key, nested[key]]),
        )
      : nested,
  );
}
