# Cogent <!-- omit in toc -->

_Cogent_ is a simple design pattern for JavaScript frontend development.

---

**co·gent** / _adjective_<br>
clear, logical, and convincing

---

## Components

### Background

One of the primary reasons web app development is challenging is because HTML and CSS are global and not encapsulated. HTML anywhere in the document can be accessed from any code, anywhere. CSS classes can be applied to any content on the page with confusing specificity rules.

I believe that the popularity of React is due to the encapsulation of HTML, CSS, and JavaScript code into the concept of a component, with the JavaScript aspect as the primary face of a component.

Cogent also aims to componentize a web app by unifying HTML, CSS, and JavaScript. Cogent is a pattern and a set of conventions, not a code-based framework. Cogent is simple and prioritizes ease of use but requires greater skill with the underlying browser APIs.

### Components

#### A component is an object that wraps a single HTMLElement. The wrapped HTMLElement is the component's view.

Think of HTML/CSS as the language to describe the view.

#### A component's API is the API exposed by the object wrapper, not the wrapped HTMLElement (view).

However, external code can use the view's API for read operations and adding listeners, but mutation can only be accomplished through the object wrapper API.

Child nodes can only be altered by the component that manages them, which is the closest parent component. A component may allow external code to mutate its inner child nodes by deliberately exposing mutation methods.

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

#### Although read-operations on the view are allowed, the view's inner child nodes are a black box and should not be accessed in any way unless operations on them are exposed via the component's API.

#### An app is a hierarchy of components.

The top-level component is the application component.

### State

#### An application has an application state that is spread throughout all the components that make up the application.

It is the sum of all the individual component states that make up the application at any given time.

#### The first component to use a slice of application state ("state") should be the component responsible for initializing and changing this state. In other words, this component is tasked with managing the state.

For state that is shared between multiple components, management of the state should be lifted up to the closest common ancestor of the components that need to share the state.

#### When application state changes, notifications and reactions to the change must flow downwards from parent to child components.

Child components can read state used higher up in the component hierarchy, but the notification of a state change should flow downwards to each interested component in a top-down manner. This ensures that parent components react to changes before their children.

#### The window and document objects are available to all components.

Think of these objects are OS-level objects.

### Stylistic Conventions and Design Patterns

#### Hang the component's wrapped `HTMLElement` element from the `dom` property of the component object.

Prefer to initialize the DOM towards the top of the constructor.

```javascript
class Button {
  constructor () {
    dom = document.createElement("button");

    ...
  }
}
```

#### Components only take a single object parameter on initialization called `props`.

This technique makes it easy to pass around classes and initialization objects (props).

#### Use [CHESS](https://github.com/jake-knerr/chess) components to style Cogent components.

CHESS complements a component-based architecture.

#### Develop based on screen sizes with feature detection instead of user-agent sniffing.

This technique is ultimately more reliable and future-proof.

#### Prefer desktop-first design.

It is easier to move content panes into modal screens than vice-versa.

#### Prefer to keep CSS files in the same folder as the file that defines the component the CSS files are styling.

This technique makes it easier to find and modify styles.

#### Divide up the app into "screens", meaning content regions that can be the only region displayed based on screen size.

This technique makes it easier to design an application that can accommodate multiple screen sizes and form factors.

## Other

### Shadow DOM

#### Great concept, with the fatal flaw of styling.

Styles must be created either in a `style` tag in each component or a link to a preloaded stylesheet. Parsing an entire stylesheet for every component must have negative performance implications.

A solution is `adopted stylesheets.` However, it does not work in Safari.

Shadow DOM also precludes parents from changing styling in child components, although this may be a feature rather than a bug.

### Custom Elements

#### Another great idea with a fatal flaw.

No children or attributes may be set in the constructor, which is consistent with the behavior of `document.createElement()`. This would preclude a `props` sent to the constructor, which is convenient. Workarounds are clunky and feel inelegant.

Also, custom elements require tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, custom elements put pressure on developers to reflect properties to attributes to be compliant with the standard.
