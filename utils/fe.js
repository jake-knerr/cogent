import { Component } from "../components/component.js";

/**
 * Properties, methods, and attributes of a DOM element.
 *
 * If the key is a method on the element, the value is the argument or an array
 * of arguments. If the key is "on", the value maps event names to handlers. If
 * the key is "addClass", the value is a class name or an array of them.
 *
 * `Partial<HTMLElement>` gives the standard properties real types and
 * autocomplete. The index signature is still needed for attributes and for
 * element-specific properties like `min` or `placeholder`, so a misspelled key
 * is accepted and forwarded to setAttribute rather than flagged. Catching that
 * would require `fe` to be generic over the element type.
 *
 * Keying `on` to HTMLElementEventMap hands each handler its real event type and
 * pins `currentTarget` to the element, which the DOM lib types as
 * `EventTarget|null` on every event. Handlers that need a specific element read
 * it as `DOMEvent<HTMLInputElement>` rather than rebuilding the intersection.
 *
 * @typedef {Partial<HTMLElement> & {
 *  [key: string]: any,
 *  on?: { [K in keyof HTMLElementEventMap]?: (this: HTMLElement, event: HTMLElementEventMap[K] & { currentTarget: HTMLElement }) => void },
 *  addClass?: string | string[]
 * }} ComponentProps
 */

/**
 * An event whose `currentTarget` is the element the handler is attached to.
 *
 * @template {HTMLElement} [T=HTMLElement]
 * @typedef {Event & { currentTarget: T }} DOMEvent
 */

/**
 * @typedef {InsertPosition|string|Node|Component|ComponentProps|((parent: HTMLElement) => void)} FEArg
 */

// insertAdjacentElement takes an Element, so a text node or a fragment -- both
// of them FEArgs -- fails its idl conversion rather than being inserted. These
// four cover the same positions and accept any node
const INSERT_METHODS = {
  beforebegin: "before",
  afterbegin: "prepend",
  beforeend: "append",
  afterend: "after",
};

/**
 * General-purpose element forging, for html that is not a component: build a
 * node from a spec string, apply props, nest raw elements.
 *
 * Components may be passed as arguments — they mount themselves through the
 * public `appendTo`, so no privileged access is needed. A component may NOT be
 * the parent: its interior belongs to it, and opening one from outside is the
 * thing the boundary exists to prevent.
 *
 * @param {string|Element} parent
 * @param {...FEArg} args
 * @returns {(HTMLElement & Object.<string, any>)|undefined}
 */
export function fe(parent, ...args) {
  if (parent instanceof Component)
    throw new Error(
      "fe cannot take a Component as a parent; a component composes its own interior with fe(this.dom, ...).",
    );

  const dom = parentDOM(parent);

  if (!dom) return undefined;

  let insertType = "beforeend";

  for (const arg of args) {
    if (!arg) continue;

    if (typeof arg === "string") {
      if (
        arg === "beforebegin" ||
        arg === "afterbegin" ||
        arg === "beforeend" ||
        arg === "afterend"
      ) {
        insertType = arg;

        continue;
      }

      dom.insertAdjacentHTML(insertType, arg);
    } else if (typeof arg === "function") {
      arg(dom);
    } else if (arg instanceof Component) {
      arg.appendTo(dom, /** @type {InsertPosition} */ (insertType));
    } else if (arg instanceof Node) {
      dom[INSERT_METHODS[insertType]](arg);
    } else {
      applyProps(dom, arg);
    }

    insertType = "beforeend";
  }

  return dom;
}

function applyProps(obj, arg) {
  if (!obj) return;

  for (const key of Object.keys(arg)) {
    // event listeners
    if (key === "on") {
      for (const eventName of Object.keys(arg["on"]))
        obj.addEventListener(eventName, arg[key][eventName]);
    } else if (key === "addClass") {
      if (Array.isArray(arg[key])) {
        obj.classList.add(...arg[key]);
      } else if (arg[key]) {
        obj.classList.add(arg[key]);
      }
    } else if (key === "style") {
      obj.style.cssText += arg[key];
    } else if (key in obj) {
      if (typeof obj[key] === "function") {
        obj[key](...(Array.isArray(arg[key]) ? arg[key] : [arg[key]]));
      } else {
        // can have a type of object and be undefined
        if (typeof obj[key] === "object" && obj[key]) {
          applyProps(obj[key], arg[key]);
        } else {
          obj[key] = arg[key];
        }
      }

      // add/remove html attributes
    } else if (typeof obj.setAttribute === "function") {
      if (arg[key] === undefined || arg[key] === null) {
        obj.removeAttribute(key);
      } else {
        obj.setAttribute(key, String(arg[key]));
      }

      // nested objects reached by the recursion above have no attribute api;
      // assigning is what callers want there anyway, e.g. dataset
    } else {
      obj[key] = arg[key];
    }
  }
}

/**
 * Turns what a caller offers into a node: a spec string (`div#id.a.b`), a
 * string of html with a single root, or an element that is already one.
 */
function parentDOM(element) {
  if (element instanceof Node) return element;

  if (typeof element !== "string") return undefined;

  const trimmed = element.trim();

  if (trimmed.charAt(0) === "<") {
    const template = document.createElement("div");

    template.innerHTML = trimmed;

    // only firstChild would be returned, so extra roots would vanish silently;
    // whitespace between roots counts as a text node here
    if (template.childNodes.length !== 1)
      throw new Error(
        `fe expects one root node, parsed ${template.childNodes.length} from: ${trimmed}`,
      );

    return template.firstChild;
  }

  const { className, id, tag } = parseElementString(trimmed);
  const node = document.createElement(tag);

  if (id) node.id = id;
  if (className) node.className = className;

  return node;
}


const DOT = 46;
const HASH = 35;

// scanned in one pass rather than split on a regex: fe runs on every element
// built, and most specs are a bare tag, which now allocates nothing beyond the
// result. Empty segments ("div..a") collapse instead of producing a className
// with a stray space, which the regex version did
function parseElementString(str) {
  const length = str.length;

  let index = 0;

  while (index < length) {
    const code = str.charCodeAt(index);

    if (code === DOT || code === HASH) break;

    index++;
  }

  if (index === length)
    return { tag: length ? str : undefined, id: "", className: undefined };

  const tag = index === 0 ? undefined : str.slice(0, index);

  let id = "";
  let className = "";

  while (index < length) {
    const delimiter = str.charCodeAt(index);

    let end = index + 1;

    while (end < length) {
      const code = str.charCodeAt(end);

      if (code === DOT || code === HASH) break;

      end++;
    }

    const value = str.slice(index + 1, end);

    if (delimiter === HASH) id = value;
    else if (value) className = className ? `${className} ${value}` : value;

    index = end;
  }

  return { tag, id, className: className || undefined };
}
