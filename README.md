# View Component Design Pattern <!-- omit in toc -->

A simple design pattern for JavaScript frontend development. The goal of this design pattern is to provide a technique to build applications or complex components that encapsulate UI states while keeping the pattern as simple as possible.

---

## Copyright <!-- omit in toc -->

© Jake Knerr at Blotli.

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [Components](#components)
- [View Components](#view-components)

### Components

#### UI state is composed of a series of components, with a single root component that parents a tree of child components.

#### Each component may have its own state, controller code, and a view or is responsible for adding another component's view to the display.

Components are MVC components.

#### A component can be a higher-order component tasked with returning another component.

#### Parent components manage the UI state for child components. They pass the child component its state and they modify their child components' states.

This does not necessarily mean that the parent view wraps an HTML element that is the parent element for the child component's HTML. For example, assume a parent component parents another component whose view is a modal. The modal's wrapped HTML element is parented by `document.body`, not the parent component. Thus, the parent component view does not strictly parent the child component view. Rather, it parents the child's UI state and is responsible for passing the child its state.

#### Parent components add child components. Components do not add themselves.

#### Components do not need to know anything about their parent component.

#### A component should only change the application state if it manages that part of the state.

A particular state should be managed by the component that is (1) closest to where the state is _used_ and also (2) parents all the other components that use the state. This way, if the component managing state mutates said state, it can handle sending the updates to all of the children who depend on the state.

Note that what matters is where the state is _used_. State may be stored higher up in the component tree, but it is where it is actually used that counts when determining what component can mutate the state. For example, data may be stored on the root component, but where it is used determines what component manages it and can mutate it.

#### Updates flow from component to component in a top-down, parent to child manner. Don't skip the line.

It's easy to reason about this unidirectional system.

#### Parent components can handle state changes in children by passing callbacks into child/grandchild components. The passed callbacks can be called by child components to return state management back to the parent component.

#### All component names are nounal.

Components are things, like nouns.

**[⬆ Table of Contents](#toc)**

---

### View Components

#### Components that have a view are view components (Views).

#### Views are components that wrap an HTML element.

#### Each view exposes the `$` property as a reference to the wrapped HTML element.

#### External code can interact with the view's `$` property.

In other words, the `$` property is public. This prevents creating redundant wrapper code to interact with the DOM element when the DOM already provides an extensive API.

**[⬆ Table of Contents](#toc)**

---
