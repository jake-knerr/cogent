# Cogent <!-- omit in toc -->

_Cogent_ is a simple design pattern for JavaScript frontend development.

---

**co·gent** / _adjective_<br>
clear, logical, and convincing

---

## To-dos

- Consider creating a component that automatically ties into stateManager and detaches from it when destroy() is called.

## Components

### Background

One of the primary reasons web app development is challenging is because HTML and CSS are global and not encapsulated. HTML anywhere in the document can be accessed from any code, anywhere. CSS classes can be applied to any content on the page with confusing specificity rules.

I believe that the popularity of React is due to the encapsulation of HTML, CSS, and JavaScript code into the concept of a component, with the JavaScript aspect as the primary face of a component.

Cogent also aims to componentize a web app by unifying HTML, CSS, and JavaScript. Cogent is a pattern and a set of conventions, not a code-based framework. Cogent is simple and prioritizes ease of use but requires greater skill with the underlying browser APIs.

### Components

#### A component is an object that wraps a single HTMLElement. The wrapped HTMLElement is the component's view.

Think of HTML/CSS as the language to describe the view.

#### An app is a hierarchy of components.

The top-level component is the application component.

#### A component's API is the API exposed by the object wrapper, not the wrapped HTMLElement (view).

However, external code can use the view's API for read operations and adding listeners, but mutation can only be accomplished through the object wrapper API.

Child nodes can only be altered by the component that manages them, which is the closest parent component. A component may allow external code to mutate its inner child nodes by deliberately exposing mutation methods.

> Discussion: It would be preferable for a component to deliberately expose all public methods and properties instead of exposing the wrapped HTMLElement's API. However, wrapping methods and properties of the underlying HTMLElement creates a lot of boilerplate without any benefit. This is undesirable. Cogent uses a compromise to allow read operations on the top-level node, but mutation requires deliberate intent by the component. This compromise cuts down on boilerplate and since mutation requires the component's API, encapsulation is preserved.

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

### State

#### An application has an application state that is spread throughout all the components that make up the application.

It is the sum of all the individual component states that make up the application at any given time.

#### A Component's internal state is state that is not shared with other components.

#### For application state that is shared among different components, any component can mutate said state, but notifications and reactions to the change must flow downwards from parent to child components.

A parent can choose to not react to the change, but it should have the opportunity to do so before any child components if it so desires.

This ensures that parent components react to changes before their children. Thus, even if a component changes a slice of state, it cannot react to it until it's ancestor nodes have.

> Discussion: Originally, I required that a slice of state be managed by a single component, which would expose methods to change said slice of state. This proved to be very burdensome because it required so many methods and devs are forced to figure out what component manages the aspect of state they are working with. It is much easier to allow state to be changed anywhere, but reactions flow downwards. This way, devs do not need to worry about what component interacts with each aspect of state and can still manage how the application reacts to changes.

#### The window and document objects are available to all components.

Think of these objects are OS-level objects.

#### Broadly speaking, there are 2 distinct types of states: business data and view-related state. Keep business data and logic in the services and keep all the other state in the components and state managers.

Use a router to communicate view-state related data between different components and to capture a reloadable state.

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
