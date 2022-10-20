# Cogent <!-- omit in toc -->

_Cogent_ is a simple design pattern for JavaScript frontend development.

---

**co·gent** / _adjective_<br>
clear, logical, and convincing

---

## Components

### Overview

#### An app is a hierarchy of components.

#### A component "owns" a slice of the application state if it is the first component that needs the state, or is the shared parent of the components that need the state.

"State" is any data used or displayed by the application.

#### A component has a view that is parented by a single top-level HTMLElement.

Think of HTML/CSS as the language to describe the view.

#### Each component is a CHESS component as well.

#### External code can read or mutate the top-level view element using the element's API or the component's API. However, external code cannot change the top-level element's internal HTML structure directly through the top-level element. Only the component API can change the top-level element's internal HTML structure.

Think of the internal structure as a closed shadow DOM. Only component-level APIs can change internal structure.

#### Any component can read state from anywhere.

For this reason, the document object is always available for read-only operations.

#### Notifications of state updates flow downwards from the owning component.

Child components can read or update state owned higher up, but the notification of the state change should flow downwards to each interested component in a top-down manner.

This ensures that parents react to changes before children.

#### Child components can "lift state up" by calling callbacks passed to them or by using the service pattern.

More on the service pattern later.

### API

#### A component is an object.

#### Hang the component's top-level `HTMLElement` element from the `$` property of the component object.

#### Components only take a single object parameter on initialization called props.

This technique makes it easy to pass around classes, initialization objects (props), and use mixins.

Any properties on the props object not used by the component API are sent to the underlying view element's properties, attributes, or methods. This is convenient.

## Service Pattern

### Overview

#### A single component may delegate to a "service" the management of an aspect of state owned by the initializing component, and/or expose methods for child components to lift state up and dispatch updates.

Delegation can simply be intent. There is no need to explicitly pass the owning component to the service.

#### Services can do anything that the delegator can.

#### Services can be registered and used by any component to update or read state. Notifications of updates must flow downwards through all the notified components from the owning component.

Services can automatically send notifications based on a tree structure, which ensures a top-down flow.

That's it. Don't overthink it.

## Other

### Shadow DOM

#### Great concept, with the fatal flaw of styling.

Styles must be created either in a `style` tag in each component or a link to a preloaded stylesheet. Parsing an entire stylesheet for every component must have negative performance implications.

A solution is `adopted stylesheets.` However, it does not work in Safari.

Shadow DOM also precludes parents from changing styling in child fragments, although this may be a feature rather than a bug.

### Custom Elements

#### Another great idea with a fatal flaw.

No children or attributes may be set in the constructor, like a normal `document.createElement()`. This would preclude a `props` sent to the constructor, which is convenient.

Also, custom elements require tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, custom elements create pressure to reflect properties to attributes.
