# Cogent <!-- omit in toc -->

_Cogent_ is a design pattern for JavaScript SPA development.

---

**co·gent** / _adjective_
clear, logical, and convincing

---

## Claude

Add below to the root CLAUDE.md

```
@node_modules/cogent/docs/CLAUDE.md
```

## Type checking

jsconfig.json needs a moduleResolution that reads the `imports` field. The default, `classic`, does not:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "moduleResolution": "bundler" // `node16` and `nodenext` work too; `bundler` is the laxest of the three
  },
  "include": ["**/*", "node_modules/cogent/**/*"], // pull is cogent types
  "exclude": ["node_modules/!(cogent)"]
}
```

## Host contract

Three things cogent needs from whatever project embeds it. None can be enforced, and two of them fail quietly rather than loudly, which is why they are written down here instead of left to be discovered.

**`__DEV__`, from the build.** Several client modules branch on it at runtime to warn that a caller has violated an invariant. They expect the bundler to substitute a literal for the name, through @rollup/plugin-replace or an equivalent.

**`:::name:::` CSS class markers, from the build.** Components write their class names as `:::modal:::` rather than `modal`, and a scoped-class rewrite turns each into a real name in the js and the stylesheets at once. `build/plugins/rollup-scoped-classes.js` is that rewrite, and the build has to install it. Skip it and the markers reach the dom as literal class names no stylesheet matches, so the failure is an unstyled component rather than an error -- the quietest of the three.

**`mountApp`, at runtime.** `host/app.js` holds what cogent reaches for where it has no wiring site. See `Application` for how to mount managers.

## Components

#### A component is an object that wraps a single HTMLElement. The wrapped HTMLElement is the component's view.

Think of HTML/CSS as the language to describe the view.

#### A component's API is the API exposed by the object wrapper.

Child nodes can only be altered by the component that manages them, which is the closest parent component. A component may allow external code to mutate its inner child nodes by deliberately exposing mutation methods.

If another component or scope gets access to a component's wrapped DOM element, it is legal to perform zero-side-effect operations on the element. The primary purpose here to avoid mutation without explicit consent.

```javascript
class Button {
  dom = document.createElement("button");
  setText(value) {
    this.dom.textContent = value;
  }
}

// avoid; external code changing inner child nodes via the wrapped HTMLElement
new Button().dom.textContent = "Click me";

// good; using the component's api
new Button().setText("Click me");
```

### Stylistic Conventions and Design Patterns

#### Hang the component's wrapped `HTMLElement` element from the `dom` property of the component object.

Prefer to initialize the DOM towards the top of the constructor.

```javascript
class Button {
  /** @protected */
  dom = document.createElement("button");
}
```

#### Components only take a single object parameter on initialization.

This technique makes it easy to pass around classes and initialization objects (props).

#### Use [CHESS](https://github.com/jake-knerr/chess) components to style Cogent components.

CHESS complements a component-based architecture.
