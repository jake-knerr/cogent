/**
 * Fires events to components in document order, parents before children.
 *
 * What happens during a dispatch, since a handler can do any of it:
 *
 * `attach` is queued. The handler joins when the outermost dispatch unwinds, so
 * it does not receive the event being dispatched -- the list is snapshotted and
 * sorted once per dispatch, and adding to it midway would leave it out of
 * document order.
 *
 * `detach` takes effect immediately: the record is marked inactive and skipped
 * for the rest of this dispatch even if the loop has not reached it. Only the
 * pruning of the arrays waits, since the loop is walking a snapshot of them.
 *
 * `dispatch` is not queued. A nested one runs inline, to completion, before the
 * outer loop continues -- the depth counter is what keeps the two deferrals
 * above correct through the nesting, not a barrier against it.
 *
 * @template {{ type: string }} [Events={ type: string, [key: string]: any }] The
 *  union an application narrows the dispatcher to, so a handler discriminates
 *  on `type` and reads only the props that variant carries. Defaults wide,
 *  which is what `app.dispatcher` hands back -- an application that wants the
 *  narrowing exports its own instance typed `ComponentDispatcher<ItsEvents>`.
 */
export class ComponentDispatcher {
  #dispatchDepth = 0;
  /** @type {any[]} */
  #handlers = [];
  /** @type {any[]} */
  #queued = [];

  /**
   * @param {Component} component
   * @param {(event: Events) => void} handler
   */
  attach(component, handler) {
    this.#add(component, handler, false);
  }

  /**
   * @param {Component} component
   * @param {(event: Events) => void} handler
   */
  attachOnce(component, handler) {
    this.#add(component, handler, true);
  }

  #add(component, handler, once) {
    const rec = { component, handler, once, active: true };

    if (this.#dispatchDepth > 0) {
      // promoted when the dispatch stack unwinds, which dirties the order there
      this.#queued.push(rec);

      return;
    }

    this.#handlers.push(rec);
  }

  /**
   * @param {Component} component
   */
  detach(component) {
    for (const rec of this.#handlers)
      if (rec.component === component) rec.active = false;

    for (const rec of this.#queued)
      if (rec.component === component) rec.active = false;

    if (this.#dispatchDepth === 0) {
      this.#handlers = this.#handlers.filter((h) => h.active);
      this.#queued = this.#queued.filter((h) => h.active);
    }
  }

  /**
   * @param {Events} event
   */
  dispatch(event) {
    this.#dispatchDepth++;

    try {
      // sorted per dispatch rather than cached: a component or an ancestor
      // moving in the tree cannot be observed by attach/detach, so a cache
      // would go stale silently. measured .13 ms for 200 components.
      const ordered = this.#handlers.filter((h) => h.active).sort(this.#sort);

      for (const rec of ordered) {
        if (!rec.active) continue;

        if (rec.once) rec.active = false;

        try {
          rec.handler(event);
        } catch (error) {
          // isolated so one failing component neither starves the components
          // after it nor surfaces as an error from whatever called dispatch
          console.error(
            `Component handler failed for "${event?.type}":`,
            error,
          );
        }
      }
    } finally {
      this.#dispatchDepth--;

      if (this.#dispatchDepth === 0) {
        this.#handlers = this.#handlers.filter((h) => h.active);

        if (this.#queued.length) {
          this.#handlers.push(...this.#queued.filter((h) => h.active));
          this.#queued = [];
        }
      }
    }
  }

  // one comparePosition call decides everything, because containment is already
  // document order in what it returns. Old technique was running contains and
  // and comparePosition for siblings. A test page in /testing shows the current
  // approach is faster
  //
  // considered a solution where a MutationObserver marks tree dirty if non-text
  // nodes mutated; but current approach is already sub-millisecond for hundreds
  // of components so it is not worth the cost of a mutation observation system
  #sort = ({ component: a }, { component: b }) => {
    if (a === b) return 0;

    if (!a || a.destroyed) return 1;
    if (!b || b.destroyed) return -1;

    const pos = a.comparePosition(b);

    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;

    return 0;
  };
}
