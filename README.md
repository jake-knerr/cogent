# View Component Design Pattern <!-- omit in toc -->

This document describes a simple design pattern for JavaScript frontend development. The goal of this design pattern is to provide a technique to build applications/widgets with view components that encapsulate state while keeping the pattern as simple as possible.

---

## Copyright <!-- omit in toc -->

Jake Knerr © Ardisia Labs LLC

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [State Management](#state-management)
- [View Componentss](#view-componentss)
- [API](#api)

## State Management

#### Applications use a store for state management.

#### The store can be updated or read anywhere in the application.

#### The store is event-based. Handler functions can listen for changes to the store.

This is how the application's components can react to state changes.

## View Componentss

For this document, the term "component" refers to a view component.

#### Application state represents the totality of the state presented to users.

In other words, for this document application state refers to the state displayed by the application's "view."

#### Application state can be broken into smaller parts that are individually known as simply _state_.

In other words, for this document _state_ refers to a part of the application state.

#### Application state is presented via a group of components, with a single root component parenting a tree of child components.

All components have a parent component, with the only exception being the root component.

This tree of components is referred to as the "component tree".

#### All components are required to have a view.

#### A component's view is its state representation, its reflection of state to the display.

#### Each component may have its own internal state and controller code distinct from application state.

Components are MVC components.

#### Parent components can manage the state of child components. Components can also manage their own state.

Use whatever technique is more convenient.

#### Parent components handle the process of adding child components to themselves. In other words, components do not add themselves to the component tree.

This includes adding a component's view to the display. A parent component adds a child component's view to the display.

This does not necessarily mean that the parent's HTML is the parent element for the child's HTML. For example, assume a child component has a modal view. The modal view is parented by `document.body`, not the parent's HTML. Thus, the parent's view does not strictly parent the child's view. Rather, the parent component is responsible for adding the child's view to the display.

However, typically a parent component's HTML will be the parent element for child component HTML.

#### Views can make changes to the store and react to changes to the store.

Since child views are always added after parent components, updates from the store should flow down the component tree in a top-down manner.

#### Components do not need to know anything about their parent component.

#### All component names are nounal.

Components are things, like nouns.

**[⬆ Table of Contents](#toc)**

---

## API

#### Components wrap an HTML element.

#### Each component exposes the `$` property as a reference to the wrapped HTML element.

#### External code can interact with the `$` property in read-only manner.

In other words, the `$` property is a read-only public property.

#### Parent view's should not directly mutate a child's HTML/CSS state via the `$` property. They should instead use the child view's API.

**[⬆ Table of Contents](#toc)**

---
