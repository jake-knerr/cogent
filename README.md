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

HTML elements can only be altered by the component that owns them, which is the closest parent component. To change internal structure, the component, not the view, must expose methods.

#### When application state changes, notifications and reactions to the change must flow downwards from parent to child components.

Child components can read or update state used higher up in the component hierarchy, but the notification of the state change should flow downwards to each interested component in a top-down manner.

All reactions to state changes should be done in the parent components before child components. This ensures that parent components react to changes before their children.

#### Child components can "lift state up" and trigger notifications in parent components by calling callbacks passed to them or by using an application engine service.

An engine service could be available to all components and provide a way to read state, update state, and send update notifications in a downwards manner. The engine may also be used to hang behavior that is shared by multiple components.

### API

#### A component is an object created from a JavaScript class that wraps a DOM element.

#### Hang the component's top-level `HTMLElement` element from the `dom` property of the component object.

Prefer to initialize the DOM towards the top of the constructor.

```javascript
class Button {
  dom = document.createElement("button");
}
```

#### Components only take a single object parameter on initialization called props.

This technique makes it easy to pass around classes and initialization objects (props).

#### A nice pattern to add event listeners on initialization is to have a `on` prop that accepts an object with keys for the event name and handlers for the value.

Also, listeners could always be explicitly defined as a prop.

#### Use [CHESS](https://github.com/jake-knerr/chess) components to style Cogent components.

### Stylistic Conventions and Design Patterns

#### child/children pattern - When passing a component to a parent component, use "child" and "children" as the prop names.

#### Develop based on screen sizes with feature detection instead of user-agent sniffing.

#### Prefer desktop-first design.

It is easier to move content panes into modal screens than vice-versa.

#### Prefer to keep CSS files in the same file as the component.

#### Divide up app into "screens", meaning content regions that can be the only screen displayed based on screen size.

### Engine Service

#### The first component to use a method or property of state should be the component to implement or initialize the property.

## Other

### Shadow DOM

#### Great concept, with the fatal flaw of styling.

Styles must be created either in a `style` tag in each component or a link to a preloaded stylesheet. Parsing an entire stylesheet for every component must have negative performance implications.

A solution is `adopted stylesheets.` However, it does not work in Safari.

Shadow DOM also precludes parents from changing styling in child components, although this may be a feature rather than a bug.

### Custom Elements

#### Another great idea with a fatal flaw.

No children or attributes may be set in the constructor, which is consistent with the behavior of `document.createElement()`. This would preclude a `props` sent to the constructor, which is convenient. Work-arounds are clunky and feel inelegant.

Also, custom elements require tracking when the component mounts or when properties change, etc. Render becomes indeterminate. Also, custom elements put pressure on developers to reflect properties to attributes to be compliant with the standard.
