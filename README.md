# View Component Design Pattern <!-- omit in toc -->

This document describes a simple design pattern for JavaScript frontend development.

---

## Copyright <!-- omit in toc -->

Jake Knerr © Ardisia Labs LLC

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [View Components](#view-components)
- [API](#api)
- [Reactive Store](#reactive-store)
- [Services](#services)

## View Components

For this document, the term "component" refers to a view component.

#### A component wraps a view, which is HTML and CSS. A component can also be a controller, which manages the component's view and any application state that it "owns".

#### An application is a hierarchy of components, with a single root component parenting a tree of child components.

In totality, components present the application state to the user.

#### Application state refers to the totality of state. A subset of application state is referred to henceforth as "state".

#### Parent components create and add child components. In other words, components do not add themselves to the component tree.

This includes adding a child component's view to the display.

This does not necessarily mean that the parent's HTML is the parent element for the child's HTML. For example, assume a child component has a modal view. The modal view is parented by `document.body`, not the parent's HTML. Thus, the parent's view does not strictly parent the child's view. Rather, the parent component is responsible for adding the child's view to the display.

However, typically a parent component's HTML will be the parent element for child component HTML.

#### Component manage the state that they "own". Ownership is determined by where the state is needed in the application. If multiple components need the state and one component parents the others, then the parent component owns the state. Otherwise, the first shared parent component owns the state.

#### Parent components can pass state to child components.

The convention is that `props` refers to the state `Object` passed from parent to child components. It is typically passed in a child component's constructor. State updates are updated using a `#update(props)` method. Note, updates can be atomic, which means that smaller pieces of state can be passed for each update. The entire dataset of the initial `props` object does not need to be sent on updates.

Note, a component may own state that is not needed downstream and not passed to child components.

#### State updates flow uni-directionally to components from the parent that owns the state to the children that need the new state.

#### Components that own state are required to handle updating it and delivering updates to child components.

#### Child components can update state they do not own by calling callbacks passed to them by the parent that owns the state. This is referred to as "lifting state up".

See the section on a reactive store for an alternative technique to lifting state up via callbacks.

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

#### Parent components cannot mutate a child's view directly. Instead they must use the `#update(props)` method of the child component.

**[⬆ Table of Contents](#toc)**

---

## Reactive Store

#### A reactive store is an object that can get/set stored data and supports change listeners on the stored data.

Such a store can be used to store application state.

#### A component that owns stored state can read the state from the store, set such state in the store, and subscribe to changes to the state in the store.

#### A component that does not own state can set such state on the store, but cannot read or subscribe to changes on it.

This ensures that updates flow from the owning component.

#### This is a useful technique because this way parent components do not have to pass state update callbacks down a chain of child components.

A reactive store is most useful when you have components that own state passing update callbacks into deep hierarchies.

## Services

#### Use services to handle well-defined application state changes.

#### Services should not directly affect the view. Services focus on state and data operations.

#### Keep a component's controller thin and delegate to services when feasible.

#### Services can call other services.

**[⬆ Table of Contents](#toc)**

---
