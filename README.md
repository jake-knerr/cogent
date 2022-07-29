# View Component Design Pattern <!-- omit in toc -->

This document describes a simple design pattern for JavaScript frontend development.

---

## Copyright <!-- omit in toc -->

Jake Knerr © Ardisia Labs LLC

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [View Components](#view-components)
- [API](#api)
- [Services](#services)
- [Lifting State Up](#lifting-state-up)

## View Components

For this document, the term "component" refers to a view component.

#### A component wraps a view, which is HTML and CSS. A component can also be a controller, which manages the component's view and any application state that it "owns".

#### An application is a hierarchy of components, with a single root component parenting a tree of child components.

In totality, components present the application state to the user.

#### Application state refers to the totality of state. A subset of application state is referred to henceforth as "state".

#### Component manage the state that they "own". Ownership is determined by where the state is needed in the view. If multiple components need the state and one component parents the others, then the parent component owns the state. Otherwise, the first shared parent component owns the state.

Ownership of state means that the owning component is the only component that can change state or react to changes on the state. Only the owning component can propagate the state or changes to the state to child components.

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

## API

#### Components wrap an HTML element.

#### Each component exposes the read-only `$` property as a reference to the wrapped HTML element.

#### Parent components cannot mutate a child's view directly. Instead they must use the `#setProps(props: Object)` method of the child component.

**[⬆ Table of Contents](#toc)**

---

## Services

#### Use services to manage well-defined aspects of application state.

#### The component that owns the state that is passed to a service must initialize the service, and is the only component that can react to changes to the state made by the service.

#### Services should not directly change the view. Services focus on state and data operations.

Read view operations on the view are fine.

#### Keep a component's controller thin and delegate to services when feasible.

#### Services can call other services.

**[⬆ Table of Contents](#toc)**

---

## Lifting State Up

#### When a child component triggers an update to state owned by a parent component, this is called "lifting state up".

#### One way to lift state up is for parent components to pass callbacks to child components to handle state updates.

#### Another technique is to use a shared event bus with the child firing a request and the parent fulfilling the request.

Often, using services as an event bus is a good implementation. The service listens for requests and fulfills them. State changes Are then propagated to the parent, state owning component.

#### Remember that only the component that owns state can handle updates and pass the values to child components.

A child components can trigger an update to state, but can only work with the value that is passed to it by a parent component.

**[⬆ Table of Contents](#toc)**

---
