# Emitter

`new Emitter()` in `src/emitter.mjs` (named export) is a small synchronous event emitter.

- `on(event, fn)` registers `fn` and returns a function that removes exactly that registration (calling it again does nothing); `fn` that is not a function throws a TypeError
- `once(event, fn)` is like `on`, but the registration is removed right before `fn` is called, so even a nested `emit` of the same event from inside `fn` does not call it twice
- `off(event, fn)` removes one registration of `fn` for the event, the earliest one when it was registered several times; nothing happens when there is none
- `emit(event, ...args)` calls the handlers of the event with `args`, in registration order, and returns `true` when the event had at least one handler when `emit` started, otherwise `false`
- a handler registered while an emit is running is not called by that emit; a handler that is removed while an emit is running, before its turn, is not called by it either
- when a handler throws, the remaining handlers are still called; after the last one, a single thrown error is rethrown as it is and several are thrown together as an `AggregateError` whose `errors` are in the order they were thrown
- `listenerCount(event)` returns the number of registrations of the event
