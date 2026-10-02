# render

`render(template, data)` in `src/render.mjs` (named export) fills a small mustache-like template with data and returns a string.

- `{{path}}` inserts the value HTML-escaped (`&` `<` `>` `"` `'` become `&amp;` `&lt;` `&gt;` `&quot;` `&#39;`); `{{{path}}}` inserts it unescaped; spaces just inside the braces are ignored (`{{ name }}`)
- `path` is names separated by dots (`user.address.city`, `items.0.name`); only own properties are read, so `{{constructor}}` or `{{toString}}` give nothing
- a path that does not exist, `null` and `undefined` insert an empty string; every other value is inserted as `String(value)` (so `0` gives `0` and `false` gives `false`)
- `{{#if path}}...{{/if}}` renders its body when the value is truthy, and `{{#if path}}...{{else}}...{{/if}}` renders the part after `{{else}}` otherwise. Falsy values are `false`, `null`, `undefined`, `0`, `NaN`, `""` and the empty array `[]`; everything else is truthy (`"0"`, `{}` and `[0]` are truthy)
- `{{#each path}}...{{/each}}` renders its body once per element of an array, nothing for an empty array or a value that is not an array. Inside it `{{this}}` is the element and `{{@index}}` its zero-based position
- a name is looked up in the current element first when the element is an object that has it as an own property, then in the enclosing element, and so on out to `data`; `this.name` always means the current element
- blocks can be nested
- `\{{` in the template produces a literal `{{` and is not a tag
- an unknown block, a closing tag that does not match, or a block that is never closed throws a SyntaxError
