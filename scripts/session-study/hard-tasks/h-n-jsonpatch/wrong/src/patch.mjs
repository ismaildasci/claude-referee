import { isDeepStrictEqual } from "node:util";

function tokens(pointer) {
  if (typeof pointer !== "string") throw new Error("pointer must be a string");
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new Error("pointer must start with /");
  return pointer
    .slice(1)
    .split("/")
    .map((t) => {
      if (/~(?![01])/.test(t)) throw new Error("bad escape");
      return t.replace(/~1/g, "/").replace(/~0/g, "~");
    });
}

function key(container, token, adding) {
  if (Array.isArray(container)) {
    if (adding && token === "-") return container.length;
    if (!/^(0|[1-9]\d*)$/.test(token)) throw new Error(`bad array index ${token}`);
    const i = Number(token);
    if (adding ? i > container.length : i >= container.length) throw new Error("index out of range");
    return i;
  }
  if (container !== null && typeof container === "object") {
    if (!adding && !Object.hasOwn(container, token)) throw new Error(`missing member ${token}`);
    return token;
  }
  throw new Error("parent is not a container");
}

function locate(root, parts, adding) {
  let cur = root;
  for (const t of parts.slice(0, -1)) cur = cur[key(cur, t, false)];
  return [cur, key(cur, parts.at(-1), adding)];
}

const read = (root, parts) => {
  if (parts.length === 0) return root;
  const [parent, k] = locate(root, parts, false);
  return parent[k];
};

function add(root, parts, value) {
  if (parts.length === 0) return value;
  const [parent, k] = locate(root, parts, true);
  if (Array.isArray(parent)) parent.splice(k, 0, value);
  else parent[k] = value;
  return root;
}

function remove(root, parts) {
  if (parts.length === 0) throw new Error("cannot remove the document");
  const [parent, k] = locate(root, parts, false);
  if (Array.isArray(parent)) parent.splice(k, 1);
  else delete parent[k];
  return root;
}

function applyOne(root, op) {
  const path = tokens(op.path);
  switch (op.op) {
    case "add":
      return add(root, path, structuredClone(op.value));
    case "remove":
      return remove(root, path);
    case "replace": {
      if (path.length === 0) return structuredClone(op.value);
      const [parent, k] = locate(root, path, false);
      parent[k] = structuredClone(op.value);
      return root;
    }
    case "move": {
      const from = tokens(op.from);
      if (path.length > from.length && from.every((t, i) => t === path[i])) throw new Error("cannot move into own child");
      const value = read(root, from);
      return add(remove(root, from), path, value);
    }
    case "copy":
      return add(root, path, structuredClone(read(root, tokens(op.from))));
    case "test":
      if (!isDeepStrictEqual(read(root, path), op.value)) throw new Error("test failed");
      return root;
    default:
      throw new Error(`unknown op ${op.op}`);
  }
}

export function applyPatch(doc, ops) {
  let root = doc;
  ops.forEach((op, n) => {
    try {
      root = applyOne(root, op);
    } catch (error) {
      throw new Error(`op ${n}: ${error.message}`);
    }
  });
  return root;
}
