# Cogent <!-- omit in toc -->

_Cogent_ is a simple design pattern for JavaScript frontend development.

---

**co·gent** / _adjective_<br>
clear, logical, and convincing

---

## Components

### Background

One of the primary reasons web app development is challenging is because HTML and CSS are global and not encapsulated. HTML anywhere in the document can be accessed from any code, anywhere. CSS classes can be applied to any content on the page with confusing specificity rules.

I believe that the popularity of React is due to the encapsulation of HTML, CSS, and JavaScript code into the concept of a component, with the JavaScript definition as the primary face of a component.

Cogent also aims to componentize a web app by unifying HTML, CSS, and JavaScript. Cogent is a pattern and a set of conventions, not a code-based framework. Cogent is simple and prioritizes ease of use, but requires greater skill with the underlying browser APIs.

### Overview

#### An app is a hierarchy of components.

The top-level component is the application component.

#### An application is represented by an application state ("state") that can be thought to be represented by all the components that make up the application.

In other words, the application state is the state of the application at any given time. It is the state of all the components that make up the application.

#### A component is an object that wraps a single HTMLElement that is its view.

Think of HTML/CSS as the language to describe the view.

#### A component's API is both the API exposed by the object wrapper and the wrapped HTMLElement (view). External code cannot use the view's API to read or mutate a component's child elements.

HTML elements can only be altered by the component that owns them, which is the closest parent component. To change the internal structure, the component, not the view, must expose methods.

#### The first component to use a slice of state should be the component responsible for initializing and changing this slice of state.

For state slices that are shared between multiple components, management of the state should be lifted up to the closest common ancestor of the components that need to share the state.

#### When application state changes, notifications and reactions to the change must flow downwards from parent to child components.

Child components can read or update state used higher up in the component hierarchy, but the notification of the state change should flow downwards to each interested component in a top-down manner.

All reactions to state changes should be done in the parent components before child components. This ensures that parent components react to changes before their children.

#### Child components can "lift state up" and trigger notifications in parent components by calling callbacks passed to them or by using a global singleton "lift" service.

A lift service could be available to all components and provide a way to read state, update state, and send update notifications in a downward manner. The service may also be used to hang behavior that is shared by multiple components. See below for more information.

### API

#### A component is an object created from a JavaScript class that wraps a DOM element.

The component's API is the methods and properties of the object and the methods and properties of the wrapped DOM element.

#### Hang the component's top-level `HTMLElement` element from the `dom` property of the component object.

Prefer to initialize the DOM towards the top of the constructor.

```javascript
class Button {
  dom = document.createElement("button");
}
```

#### Components only take a single object parameter on initialization called props.

This technique makes it easy to pass around classes and initialization objects (props).

#### Use [CHESS](https://github.com/jake-knerr/chess) components to style Cogent components.

This makes it easy to style components and makes the components look consistent.

### Stylistic Conventions and Design Patterns

#### Develop based on screen sizes with feature detection instead of user-agent sniffing.

This technique is ultimately more reliable and future-proof.

#### Prefer desktop-first design.

It is easier to move content panes into modal screens than vice-versa.

#### Prefer to keep CSS files in the same file as the component.

This technique makes it easier to find and modify styles.

#### Divide up the app into "screens", meaning content regions that can be the only screen displayed based on screen size.

This technique makes it easier to design an application that can accommodate multiple screen sizes and form factors.

### Lift Service

A lift service is accessible to all components in the application and can be used by any component to lift state up and make it accessible to other components. Also, the lift service can be used to send notifications to other components in a top-down manner when the state changes. Also, a lift service can be a way for a component to hang behavior that can be used by other components.

#### The first component to use a shared method or a slice of state on the lift service should be the component to implement or initialize the property on the lift service.

This makes it easy to identify where to initialize the property or method on the lift service. It also makes sure that the properties are initialized in a top-down manner.

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
