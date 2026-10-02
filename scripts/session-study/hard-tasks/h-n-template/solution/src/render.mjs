const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ESC[c]);

function parse(template) {
  const root = [];
  const stack = [{ kind: "root", body: root }];
  const top = () => stack.at(-1);
  const re = /\\\{\{|\{\{\{(.*?)\}\}\}|\{\{(.*?)\}\}/gs;
  let last = 0;
  let m;
  const text = (s) => s && top().body.push({ type: "text", value: s });
  while ((m = re.exec(template))) {
    text(template.slice(last, m.index));
    last = re.lastIndex;
    if (m[0] === "\\{{") {
      text("{{");
      continue;
    }
    if (m[1] !== undefined) {
      top().body.push({ type: "var", path: m[1].trim(), raw: true });
      continue;
    }
    const tag = m[2].trim();
    let b;
    if ((b = /^#(if|each)\s+(\S+)$/.exec(tag))) {
      const node = { type: b[1], path: b[2], body: [], other: [] };
      top().body.push(node);
      stack.push({ kind: b[1], node, body: node.body });
    } else if (tag === "else") {
      if (top().kind !== "if" || top().node.inElse) throw new SyntaxError("unexpected else");
      top().node.inElse = true;
      top().body = top().node.other;
    } else if ((b = /^\/(if|each)$/.exec(tag))) {
      if (top().kind !== b[1]) throw new SyntaxError(`unexpected /${b[1]}`);
      stack.pop();
    } else if (tag.startsWith("#") || tag.startsWith("/")) throw new SyntaxError(`unknown block ${tag}`);
    else top().body.push({ type: "var", path: tag, raw: false });
  }
  text(template.slice(last));
  if (stack.length > 1) throw new SyntaxError("unclosed block");
  return root;
}

const own = (o, k) => o !== null && o !== undefined && (typeof o === "object" || typeof o === "string") && Object.hasOwn(Object(o), k);

function lookup(frames, path) {
  const [first, ...rest] = path.split(".");
  let cur;
  if (first === "@index") cur = frames.at(-1).index;
  else if (first === "this") cur = frames.at(-1).value;
  else {
    let found = false;
    for (let i = frames.length - 1; i >= 0 && !found; i--) {
      const v = frames[i].value;
      if (v !== null && typeof v === "object" && own(v, first)) {
        cur = v[first];
        found = true;
      }
    }
    if (!found) return undefined;
  }
  for (const seg of rest) {
    if (!own(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

const truthy = (v) => !(v === false || v === null || v === undefined || v === 0 || Number.isNaN(v) || v === "" || (Array.isArray(v) && v.length === 0));

function run(nodes, frames) {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += n.value;
    else if (n.type === "var") {
      const v = lookup(frames, n.path);
      const s = v === null || v === undefined ? "" : String(v);
      out += n.raw ? s : escapeHtml(s);
    } else if (n.type === "if") out += run(truthy(lookup(frames, n.path)) ? n.body : n.other, frames);
    else {
      const list = lookup(frames, n.path);
      if (Array.isArray(list)) list.forEach((value, index) => (out += run(n.body, [...frames, { value, index }])));
    }
  }
  return out;
}

export function render(template, data) {
  return run(parse(template), [{ value: data, index: undefined }]);
}
