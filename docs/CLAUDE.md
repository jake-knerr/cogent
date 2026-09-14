Use American English spelling and grammar.

Tmp:
Every script you write for your own use — probes, type checks, benchmarks,
verification harnesses, one-offs — goes under /tmp. This applies even to a
throwaway you plan to delete: write it to /tmp in the first place. Only files I
asked you to produce belong in the working tree.

General Code Order:

- imports first: css, newline, node modules, newline, node_modules, newline, #lib imports,
  newline, then local imports.
- For node modules, use the `node:` prefix.
- @typedefs/@import next, then exported variables/consts, then module
  variables/consts, then functions.
- Module private variables tightly scoped to a function are defined above the
  function.

When creating functions, I prefer to have all exported functions
towards the top of the file. I dislike single-use helper functions, but they are
allowed if there is a good exception. Helper functions should be defined below
the exported functions in the order they are called.

Code Order For Routers:
For router files that serve http req/res, define get routes then post routes.
Define a @typedef for the return payload (if any) and place it directly above
the route that returns it. This differs from the general rule of defining
@typedef at the top of the module. A consumer imports that typedef with @import
rather than redeclaring it -- the route that sends the payload is the one
definition of its shape. A JSDoc import is erased at build, so client code may
name a server type this way without the bundles touching.

Naming:
Functions should start with a verb, like handleXXX, and onXXX is allowed
for event handlers. Data should be nouns. Service layer files related to
business data should use getXXX, addXXX, setXXX, removeXXX prefixes, arranged
is the previous order (get function, then set functions, etc.) For data layer
functions that retrieve data from a store (files, redis, mysql, etc) use CRUD
prefixes, so createXXX, readXXX, updateXXX, deleteXXX. These functions should
have the read functions at the top of the file, then create then update then
delete. handleXXX is used for middleware that handles a http response or calls
the NextFunction. processXXX for middleware that performs work but doesn't
handle the response or the NextFunction. onXXX for event handlers.
handleValidateXXX for middleware that performs validation. DOM elements should
be referenced via variables with a DOM postfix. So buttonDOM. Import native node
libraries with the "node:xxx" prefix. Abbreviations and initialisms stay
uppercase only at the end of a compound name: buildStateURL, getID, buttonDOM.
Anywhere else they are capitalized like an ordinary word — parseUrlState,
createCssPlugin, not parseURLState or createCSSPlugin.

Folders:
I prefer a server first system where clear domains are placed in top-level
folders. /utils is for functions that are generalized and are either
cross-domain or could become cross-domain so I know where to look for them. A
date parsing function could go in /utils. Otherwise, functions should be placed
in clear domain specific folders. I use a /helpers folder to break-out code that
is only used in a single other file for housekeeping only. For shared code among
multiple files intra-domain, I prefer /common.

Type Annotations:
Add full JSDocs to exported functions. Do not add JSDoc to non-exported
functions unless there is a clear exception like trying to clear a type checking
error or the return type is novel or confusing.

Types:
Global types go a root /types folder. Files exporting constants or enums go into
the types folder with a `-enums` postfix to the filename. Define types where
they are implemented, but promote them to a file in /types when it would be
useful to have an easy place for a consumer to find them. A router's return
payload is the exception: it stays above its route, and consumers import it from
there.

Comments:
Inline comments (E.G. // in JavaScript) use lowercase in prose and capitals only
when it is necessary for clarity, like referring to a class. Other comments
can use normal punctuation.

Syntax:
For `if` statements that are coupled with `elseif/else` statements, always
enclose each block `{}`. E.G. always `if (...) {} else () {}`. Standalone `if`
statements without `{}` are preferred if possible.

Leave a blank line before a return statement.

Server:
When creating deploy server config and optimization assume a DigitalOcean deploy
with 16Gb of memory and 8 cores.

Frontend:

CSS: lowercase using hyphens to distinguish words. Components have a root class
name that tracks the JavaScript class name. E.G. `class RedButton` is
`.red-button`. Use CSS nesting to style html fragments inside the component.
E.G. `.red-button {div:first-child {}}`. If internal structure is targeted by a
CSS class rather than the cascade, use an identifier plus two underscores and
the component class name. E.G. `.price__red-button`. For state classes that are
used for styling that changes at runtime, either through configuration or state
changes, create a `&& {}` nested block inside the root or fragment being styled.
State classes use an identifier plus two hyphens: E.G.
`.red-button {&& {&.selected--red-button}}`.

Components: subclass `Component` for anything with behavior or a lifetime, and
use `fe` alone for markup that has neither. Build the interior with
`fe(this.dom, ...)` from inside the constructor, and take content in as a
parameter rather than reaching into another component to place it.
`lib/cogent/components/component.js` is the source of truth for what its
boundary permits; add a member to the public surface when something needs one
rather than in advance, and treat a call to `unsafeDOM` as something to justify.

Anything that lives above the application rather than inside it -- a tooltip, a
toast, a dialog -- extends `Popup`, so that mounting and unmounting go through
the application's popup layer instead of the document.

Name the root with the scoped marker in the spec string, E.G.
`fe("div.:::red-button:::")`, which the stylesheet then targets as plain
`.red-button`. Keep a component's css in components/styles and import it at the
top of the component file.

Event handlers are arrow-function class fields, so the reference stays stable
enough to remove again: `#onKeydown = (event) => {}`. Listeners on the document
or the window are added when they start mattering and removed when they stop,
rather than for the life of the component.

An override of `destroy` ends with `super.destroy()`, and releases what the dom
will not: timers, animations in flight, and listeners on anything outside the
component's own root. Forgetting the call leaks everything the base would have
released, including the walk that destroys nested components. Do not keep a node
or a component across a destroy.

Reach a shared manager through `app` in /host when a component needs one and has
no wiring site. Import the created instance instead when its typing matters,
since `app` is annotated loosely on purpose.
