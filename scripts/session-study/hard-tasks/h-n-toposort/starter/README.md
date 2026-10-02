# buildOrder

`buildOrder(graph)` in `src/order.mjs` (named export) puts build tasks in an order that respects their dependencies.

- `graph` is an object that maps a task name to an array of the names it depends on; a dependency that is not itself a key is a task with no dependencies of its own; a repeated dependency counts once
- the result is an array of all task names in which every task comes after all of its dependencies
- the order is deterministic: whenever several tasks are ready (all their dependencies are already in the result), the one whose name is smallest, compared with `<` on the strings, comes next
- when the tasks cannot all be ordered because of a dependency cycle (a task that depends on itself counts), it throws an Error whose message is `cycle: ` followed by the names of every task that could not be placed, sorted and separated by `, `
- the input is not modified
