# Cogent <!-- omit in toc -->

_Cogent_ is a design pattern for JavaScript SPA development.

---

**co·gent** / _adjective_
clear, logical, and convincing

---

## Claude

Add below to the root CLAUDE.md

```
@node_modules/cogent/docs/CLAUDE.md
```

## Type checking

jsconfig.json needs a moduleResolution that reads the `imports` field. The default, `classic`, does not:

```json
{
  "compilerOptions": {
    "checkJs": true,
    "moduleResolution": "bundler" // `node16` and `nodenext` work too; `bundler` is the laxest of the three
  },
  "include": ["**/*", "node_modules/cogent/**/*"], // pull is cogent types
  "exclude": ["node_modules/!(cogent)"]
}
```

## Host contract

Three things cogent needs from whatever project embeds it. None can be enforced, and two of them fail quietly rather than loudly, which is why they are written down here instead of left to be discovered.

**`__DEV__`, from the build.** Several client modules branch on it at runtime to warn that a caller has violated an invariant. They expect the bundler to substitute a literal for the name, through @rollup/plugin-replace or an equivalent.

**`:::name:::` CSS class markers, from the build.** Components write their class names as `:::modal:::` rather than `modal`, and a scoped-class rewrite turns each into a real name in the js and the stylesheets at once. `build/plugins/rollup-scoped-classes.js` is that rewrite, and the build has to install it.

**`mountApp`, at runtime.** `host/app.js` holds what cogent reaches for where it has no wiring site. See `Application` for how to mount managers.
