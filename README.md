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

Cogent also aims to componentize a web app by unifying HTML, CSS, and JavaScript, while also providing a state management pattern. Cogent is a pattern and a set of conventions, not a code-based framework. Cogent is simple and prioritizes ease of use at the cost of more boilerplate and less "magic".

### Overview

#### An app is a hierarchy of components.

#### A component "owns" a slice of the application state if it is the first component that needs the state, or is the shared parent of the components that need the state.

"State" is any data used or displayed by the application.

#### Components that own state are the only component that can mutate the state.

They can expose public methods that can be called by other components that affect the state, but external code cannot change the state otherwise.

#### A component is an object that wraps a single HTMLElement that is its view.

Think of HTML/CSS as the language to describe the view.

#### A component's API is both the API exposed by the object wrapper and the wrapped HTMLElement (view).

#### External code cannot use the view's API to read or mutate a component's child or descendent Nodes.

To change the internal structure, the component must expose methods to do so using methods on the object wrapper.

#### Notifications of state updates flow downwards from the owning component.

Child components can read or update state-owned higher up, but the notification of the state change should flow downwards to each interested component in a top-down manner.

This ensures that parents react to changes before children.

#### Child components can "lift state up" by calling callbacks passed to them or by using the service pattern.

More on the service pattern later.

### API

#### A component is an object created from a JavaScript class.

#### Hang the component's top-level `HTMLElement` element from the `dom` property of the component object.

#### Components only take a single object parameter on initialization called props.

This technique makes it easy to pass around classes and initialization objects (props), and use mixins.

#### A nice pattern to add event listeners on initialization is to have a `on` prop that accepts an object with keys for the event name and handlers for the value.

Also, listeners could always be explicitly defined as a prop.

#### Each component is a CHESS component as well.

Extended classes are a new composite CHESS component.

#### There is a one-to-one mapping between JavaScript classes and CHESS classes.

In other words, if you want a composite, then you need a new JavaScript class and vice-versa.

#### child/children pattern - When passing a component to a parent component, use "child" and "children"

## Service Pattern

### Overview

#### A single component may delegate to a "service" the management of an aspect(s) of state-owned by the initializing component, and/or expose methods for child components to lift state up and dispatch updates.

Delegation can simply be intent. There is no need to explicitly pass the state-owning component to the service.

#### Services can do anything that the delegating component can.

Services can directly interact with components via their API.

#### Notifications of updates must flow downwards through all the notified components from the owning component.

Services can automatically send notifications based on a tree structure, which ensures a top-down flow.

#### That's it. Don't overthink it.

## Other

### Shadow DOM

#### Great concept, with the fatal flaw of styling.

Styles must be created either in a `style` tag in each component or a link to a preloaded stylesheet. Parsing an entire stylesheet for every component must have negative performance implications.

A solution is `adopted stylesheets.` However, it does not work in Safari.

Shadow DOM also precludes parents from changing styling in child components, although this may be a feature rather than a bug.

### Custom Elements

#### Another great idea with a fatal flaw.

No children or attributes may be set in the constructor, which is consistent with the behavior of `document.createElement()`. This would preclude a `props` sent to the constructor, which is convenient.

Also, custom elements require tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, custom elements create pressure to reflect properties to attributes.
