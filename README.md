# View Component Design Pattern <!-- omit in toc -->

This document describes a simple design pattern for JavaScript frontend development.

---

## Copyright <!-- omit in toc -->

Jake Knerr © Ardisia Labs LLC

---

## Table of Contents <a id="toc" name="toc"></a> <!-- omit in toc -->

- [State Management](#state-management)
- [View Components](#view-components)
- [API](#api)

## State Management

#### Applications use a store for state management.

#### The store can be updated or read anywhere in the application.

#### The store is event-based. Handler functions can listen for changes to the store.

This is how the application components can react to state changes.

## View Components

For this document, the term "component" refers to a view component.

#### Application state represents the totality of the state presented to users.

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

This is important because it ensures that parents are added before children, which means that parent components can react to state changes before child components.

#### Components do not need to know anything about their parent component.

#### Components can make changes to the store and react to changes to the store.

#### All component names are nounal.

Components are things, like nouns.

**[⬆ Table of Contents](#toc)**

---

## API

#### Components wrap an HTML element.

#### Each component exposes the `$` property as a reference to the wrapped HTML element.

#### External code can interact with the `$` property.

**[⬆ Table of Contents](#toc)**

---
