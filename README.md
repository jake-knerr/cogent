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

Cogent also aims to componentize a web app by unifying HTML, CSS, and JavaScript. Cogent is a pattern and a set of conventions, not a code-based framework. Cogent is simple and prioritizes ease of use at the cost of more boilerplate and less "magic".

### Overview

#### An app is a hierarchy of components.

The top-level component is the application component.

#### A component is an object that wraps a single HTMLElement that is its view.

Think of HTML/CSS as the language to describe the view.

#### A component's API is both the API exposed by the object wrapper and the wrapped HTMLElement (view). External code cannot use the view's API to read or mutate a component's child elements.

Child elements of the wrapped HTMLElement are not part of the API. They are private to the component. To change the internal structure, the component must expose methods to do so using methods on the object wrapper.

#### When application state changes, notifications and reactions to the change must flow downwards from parent to child components.

Child components can read or update state used higher up in the component hierarchy, but the notification of the state change should flow downwards to each interested component in a top-down manner.

This ensures that parent components react to changes before their children.

#### Child components can "lift state up" and trigger notifications in parent components by calling callbacks passed to them or by using an application store service.

A store service could be available to all components and provide a way to read state, update state, and send update notifications in a downwards manner.

### API

#### A component is an object created from a JavaScript class.

#### Hang the component's top-level `HTMLElement` element from the `dom` property of the component object.

#### Components only take a single object parameter on initialization called props.

This technique makes it easy to pass around classes and initialization objects (props), and use mixins.

#### A nice pattern to add event listeners on initialization is to have a `on` prop that accepts an object with keys for the event name and handlers for the value.

Also, listeners could always be explicitly defined as a prop.

#### Each component is a [CHESS](https://github.com/jake-knerr/chess) component as well.

Extended classes are a new composite CHESS component.

#### child/children pattern - When passing a component to a parent component, use "child" and "children" as the prop names.

## Application Service Pattern

### Overview

The application component should be available to all components as a global variable. The application component can provide a useful API to child components. A way to prevent the application component from becoming bloated is to use a service pattern, which is to hang services off of the application component via service classes.

#### A common application service is the store.

The store is a service that provides a way to read and update application state. The store can also provide a way to register callbacks to be called when state changes. Callbacks are called in the component hierarchy order.

## Other

### Shadow DOM

#### Great concept, with the fatal flaw of styling.

Styles must be created either in a `style` tag in each component or a link to a preloaded stylesheet. Parsing an entire stylesheet for every component must have negative performance implications.

A solution is `adopted stylesheets.` However, it does not work in Safari.

Shadow DOM also precludes parents from changing styling in child components, although this may be a feature rather than a bug.

### Custom Elements

#### Another great idea with a fatal flaw.

No children or attributes may be set in the constructor, which is consistent with the behavior of `document.createElement()`. This would preclude a `props` sent to the constructor, which is convenient.

Also, custom elements require tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, custom elements put pressure on developers to reflect properties to attributes to be compliant with the standard.
