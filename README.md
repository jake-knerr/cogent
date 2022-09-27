- TODO

- # Principles

  - App is a hierarchy of components.
  - A component has a view which is parented by a single top-level HTMLElement.
    - HTML/CSS is a way to describe view.
    - Hang the top-level node off the `$` property of the component.
    - Each component is a CHESS component as well.
    - External code can read or mutate the top-level view node using the node's API or the component's API. However, external code cannot change the top-level node's internal HTML structure directly through the top-level node, only the component API can.
      - Think of the internal structure as a closed shadow DOM. Only component level APIs can change the internal structure.
  - A component "owns" state if it is the first component that needs the state, or is the shared parent of the components that need the state.
    - State is any data used or displayed by the application.
  - Notifications of state updates flow downwards from the owning component.
  - Child components can "lift state up" by calling callbacks passed to them or by using the service pattern.
    - Child components can update state owned higher up, but the notification of the state change should flow downwards to each interested component in a top-down manner.
      - This ensures that parent react to changes before children.
  - API
    - Components only take a single object parameter on initialization called props.
      - This way it is easy to pass around classes and use mixins.
    - Any properties on the props object that are not used by the component API are set to the underlying view element.

- ## Service Pattern

  - A single component may delegate to a service the management of an aspect of state owned by the initializing component, and/or creates methods for child components to lift state up and dispatch updates.
    - Delegation can simply be intent, no need to explicitly pass owning component to service if unnecessary. Although, typically the delegating component will pass itself in.
  - Service can do anything that the delegator can.
  - Services can be registered and then used by any component to update state or read state. Updates need to flow downwards through all the notified components from the owning component.
  - Service can automatically send notifications based on tree structure, which ensures a top-down flow.
  - That's it. Don't overthink it.

- Shadow DOM

  - Great concept, with the fatal flaw of styling. Styles must be created either in a `style` tag in each fucking component or link to to a preloaded stylesheet. This sucks.
  - A solution is `adopted stylesheets`. However, it does not work in Safari.
  - Shadow DOM also precludes parents from changing styling in child fragments, although this may be a feature rather than a bug.
  - If this gets resolved, components could simply become HTMLElements and drop the `$` property altogether.

- Custom Elements

- No children or attributes may be set in the constructor, like a normal `document.createElement()`.
  - This is fatal because it requires tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, pressure to reflect properties to attributes.

# Cogent <!-- omit in toc -->

_Cogent_ is a simple design pattern for JavaScript frontend development.

See below for further explanation.

---

**co·gent** / _adjective_<br>
clear, logical, and convincing

---

## Copyright <!-- omit in toc -->

Jake Knerr © Ardisia Labs LLC

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [Overview](#overview)
- [Application State](#application-state)
- [View Components](#view-components)
  - [View API](#view-api)
- [Services](#services)
- [Lifting State Up](#lifting-state-up)
- [Core](#core)
- [Utilities](#utilities)

## Overview

Applications are built using four different types of components:

1. _view_
1. _services_
1. _core_, and
1. _utilities_

## Application State

## View Components

#### A _view component_ ("component") wraps a _view_, which is HTML and CSS. A component can also be a controller that manages the component's view and any internal state.

_A simple view component._

```javascript
class ViewComponent {
  $ = document.createElement("div"); // view

  constructor() {
    this.$.onclick = () => console.log("click"); // controller code
  }
}
```

#### The visual aspect of an application is a hierarchy of components, with a single root component parenting a tree of child components.

In totality, components present the application state to the user.

#### Application state refers to the totality of state. A subset of application state is referred to henceforth as "state".

#### Component manage the state that they "own". Ownership is determined by where the state is needed in the view. If multiple components need the state and one component parents the others, then the parent component owns the state. Otherwise, the first shared parent component owns the state.

Ownership of state means that the owning component is the only component that can access the state without having it passed to it by a parent component. Only the owning component can propagate the state or changes to the state to child components.

#### Parent components create and add child components. In other words, components do not add themselves to the component tree.

This includes adding a child component's view to the display.

This does not necessarily mean that the parent's HTML is the parent element for the child's HTML. For example, assume a child component has a modal view. The modal view is parented by `document.body`, not the parent's HTML. Thus, the parent's view does not strictly parent the child's view. Rather, the parent component is responsible for adding the child's view to the display.

However, typically a parent component's HTML will be the parent element for child component HTML.

#### Parent components can pass state to child components.

The convention is that `props` refers to the state `Object` passed from parent to child components. `props` are only passed to a child component via the child's `#setProps(props: Object)` method. Note, updates can be atomic, which means that smaller pieces of state can be passed for each update. The entire dataset of the initial `props` object does not need to be sent on updates.

Note, a component may own state that is not needed downstream and not passed to child components.

#### State updates flow uni-directionally to components from the parent that owns the state to the children that need the new state.

#### Components that own state are required to handle updating it and delivering updates to child components.

#### Parent components can only interact with a child's view directly by either adding or removing it from display.

All other communication is through `props`.

#### Components do not need to know anything about their parent component.

#### All component names are nounal.

Components are things, like nouns.

**[⬆ Table of Contents](#toc)**

---

### View API

#### Components wrap an HTML element.

#### Each component exposes the read-only `$` property as a reference to the wrapped HTML element.

#### Parent components cannot mutate a child's view directly. Instead they must use the `#setProps(props: Object)` method of the child component.

**[⬆ Table of Contents](#toc)**

---

## Services

#### Use services to manage well-defined aspects of application state.

#### The component that owns the state that is managed by a service is the only component that can react to changes to the state made by the service.

If multiple components own state that is managed by the service than the service has grown too large.

#### Components can only read data from a service if they own the data.

#### Services should not directly change the view. Read view operations on the view are fine.

#### Services can be used to trigger view-related changes by asking the service to pass the request to the

#### Keep a component's controller thin and delegate to services when feasible.

#### Services can call other services.

**[⬆ Table of Contents](#toc)**

---

## Lifting State Up

#### When a child component triggers an update to state owned by a parent component, this is called "lifting state up".

#### One way to lift state up is for parent components to pass callbacks to child components to handle state updates.

#### Another technique is for child components to call update methods on a service, with the changes propagating to the state's owner.

Services should emit events that pass changed data to owning component, or fire requests to fulfill state changes.

#### Remember that only the component that owns state can handle updates and pass the values to child components.

A child components can trigger an update to state, but can only work with the value that is passed to it by a parent component.

**[⬆ Table of Contents](#toc)**

---

## Core

**[⬆ Table of Contents](#toc)**

---

## Utilities

**[⬆ Table of Contents](#toc)**
