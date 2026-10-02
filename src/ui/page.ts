// HTML, CSS and browser script of the local dashboard, served from strings so the bundle needs no asset files.
// The script builds every node with textContent and never uses HTML parsing APIs; stored excerpts are untrusted text.

export const INDEX_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="light dark">
<title>claude-referee</title>
<link rel="stylesheet" href="/app.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header>
<h1>claude-referee</h1>
<nav aria-label="Sections" id="tabs" role="tablist"></nav>
</header>
<main id="main" tabindex="-1"></main>
<p id="status" role="status" aria-live="polite" class="status"></p>
<script src="/app.js"></script>
</body>
</html>
`;

export const APP_CSS = `:root{--bg:#fbfbfa;--fg:#1c1c1a;--muted:#5e5e59;--line:#d9d9d3;--card:#fff;--accent:#1f5fbf;--ok:#1b7a3d;--bad:#b3261e;--focus:#1f5fbf}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecece8;--muted:#a3a39c;--line:#363633;--card:#1e1e1c;--accent:#7aa7f0;--ok:#6fcf8f;--bad:#f08a82;--focus:#7aa7f0}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px 24px;padding:16px;border-bottom:1px solid var(--line)}
h1{font-size:18px;margin:0}
h2{font-size:16px;margin:24px 0 8px}
main{max-width:860px;margin:0 auto;padding:16px}
main:focus{outline:none}
nav{display:flex;gap:4px;flex-wrap:wrap}
nav button{background:none;border:1px solid transparent;border-radius:6px;color:var(--muted);font:inherit;padding:4px 12px;cursor:pointer}
nav button[aria-selected=true]{color:var(--fg);border-color:var(--line);background:var(--card)}
button{font:inherit}
button.act{background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:8px 14px;cursor:pointer}
button.act:hover{border-color:var(--accent)}
button.right{border-color:var(--ok)}
button.wrong{border-color:var(--bad)}
:focus-visible{outline:3px solid var(--focus);outline-offset:2px}
.skip{position:absolute;left:-999px}
.skip:focus{left:8px;top:8px;background:var(--card);padding:4px 8px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:16px;margin:12px 0}
.meta{color:var(--muted);font-size:14px;margin:0 0 8px}
.label{font-size:13px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:12px 0 4px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:8px 12px;margin:0;max-height:240px;overflow:auto;font:14px/1.45 ui-monospace,Menlo,Consolas,monospace}
.hint{border-left:3px solid var(--accent);padding:4px 12px;margin:12px 0;color:var(--muted)}
.row{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
table{border-collapse:collapse;width:100%;font-size:15px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line)}
td.n{font-variant-numeric:tabular-nums}
.status{max-width:860px;margin:0 auto;padding:0 16px 24px;color:var(--muted);min-height:1.5em}
kbd{font:13px ui-monospace,Menlo,monospace;border:1px solid var(--line);border-radius:4px;padding:0 5px;background:var(--bg)}
@media (max-width:520px){main{padding:12px}button.act{flex:1 1 100%}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export const APP_JS = `(function () {
"use strict";
var params = new URLSearchParams(location.hash.slice(1));
var token = params.get("t") || "";
history.replaceState(null, "", location.pathname);

var main = document.getElementById("main");
var statusEl = document.getElementById("status");
var tabsEl = document.getElementById("tabs");
var TABS = [["queue", "Labelling queue"], ["overview", "Overview"], ["privacy", "Privacy"], ["export", "Export"]];
var current = "queue";
var items = [];
var index = 0;

function el(tag, text, cls) {
  var node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (cls) node.className = cls;
  return node;
}
function add(parent) {
  for (var i = 1; i < arguments.length; i++) parent.appendChild(arguments[i]);
  return parent;
}
function say(text) { statusEl.textContent = text; }
function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
function pct(v) { return v === null || v === undefined ? "n/a" : (Math.round(v * 1000) / 10) + "%"; }
function ci(pair) { return pair ? "[" + pct(pair[0]) + ", " + pct(pair[1]) + "]" : "n/a"; }
function bytes(n) { return n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KiB" : (n / 1048576).toFixed(1) + " MiB"; }

function request(path, init) {
  init = init || {};
  var headers = { "X-Referee-Token": token };
  if (init.body) headers["Content-Type"] = "application/json";
  return fetch(path, { method: init.method || "GET", headers: headers, body: init.body, credentials: "omit", cache: "no-store", referrer: "", referrerPolicy: "no-referrer" }).then(function (res) {
    if (res.status === 401) throw new Error("The session token is missing or wrong. Open the URL printed in the terminal again.");
    if (!res.ok) throw new Error("Request failed (" + res.status + ").");
    return res;
  });
}
function getJson(path) { return request(path).then(function (r) { return r.json(); }); }
function fail(error) { clear(main); add(main, el("p", error.message)); say(""); }

function table(head, rows) {
  var t = el("table");
  var thead = el("thead");
  var hr = el("tr");
  head.forEach(function (h) { var th = el("th", h); th.scope = "col"; hr.appendChild(th); });
  add(t, add(thead, hr));
  var body = el("tbody");
  rows.forEach(function (r) {
    var tr = el("tr");
    r.forEach(function (c, i) { tr.appendChild(el("td", c, i > 0 ? "n" : "")); });
    body.appendChild(tr);
  });
  return add(t, body);
}

function renderTabs() {
  clear(tabsEl);
  TABS.forEach(function (t) {
    var b = el("button", t[1]);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", t[0] === current ? "true" : "false");
    b.addEventListener("click", function () { show(t[0]); });
    tabsEl.appendChild(b);
  });
}

function show(name) {
  current = name;
  renderTabs();
  say("");
  clear(main);
  add(main, el("p", "Loading"));
  if (name === "queue") return getJson("/api/queue").then(function (d) { items = d.stops; index = 0; renderQueue(d.total); }).catch(fail);
  if (name === "overview") return getJson("/api/overview").then(renderOverview).catch(fail);
  if (name === "privacy") return getJson("/api/privacy").then(renderPrivacy).catch(fail);
  renderExport();
}

function renderQueue(total) {
  clear(main);
  add(main, el("h2", "Unlabelled stops the gate would have blocked: " + items.length + (total > items.length ? " shown of " + total : "")));
  if (items.length === 0) {
    add(main, el("p", "Nothing to label."));
    return;
  }
  if (index >= items.length) index = items.length - 1;
  if (index < 0) index = 0;
  var s = items[index];
  var card = el("section", null, "card");
  card.setAttribute("aria-label", "Stop " + (index + 1) + " of " + items.length);
  add(card, el("p", "Stop " + (index + 1) + " of " + items.length + " - " + s.ts + " - " + s.edits + " edits, " + s.checks + " checks - done score " + (s.claims_done === null ? "n/a" : s.claims_done.toFixed(2)), "meta"));
  add(card, el("p", "Task (start of the prompt)", "label"), el("pre", s.task_excerpt || "(none stored)"));
  add(card, el("p", "Claude's final message (end)", "label"), el("pre", s.final_excerpt || "(none stored)"));
  if (s.suggestion) {
    var why = s.suggestion.reason === "reported_broken" ? "the next message reports something broken" : "the next message repeats the request";
    add(card, el("p", "Hint, not applied: " + why + ", which would suggest that blocking was right. Decide for yourself.", "hint"));
  }
  var row = el("div", null, "row");
  var right = el("button", "Right: the block was correct (R)", "act right");
  var wrong = el("button", "Wrong: a false block (W)", "act wrong");
  var skip = el("button", "Skip (S)", "act");
  var back = el("button", "Back (B)", "act");
  [right, wrong, skip, back].forEach(function (b) { b.type = "button"; });
  right.addEventListener("click", function () { labelCurrent("right"); });
  wrong.addEventListener("click", function () { labelCurrent("wrong"); });
  skip.addEventListener("click", function () { move(1); });
  back.addEventListener("click", function () { move(-1); });
  add(row, right, wrong, skip, back);
  add(card, row);
  add(main, card);
  add(main, el("p", "Keys: R right, W wrong, S or Right arrow skip, B or Left arrow back.", "meta"));
  right.focus();
}

function move(step) {
  if (items.length === 0) return;
  index = (index + step + items.length) % items.length;
  renderQueue(items.length);
}

var busy = false;
function labelCurrent(value) {
  if (busy || current !== "queue" || items.length === 0) return;
  var s = items[index];
  busy = true;
  request("/api/label", { method: "POST", body: JSON.stringify({ id: s.id, label: value }) }).then(function () {
    items.splice(index, 1);
    say("Stop labelled " + value + ". " + items.length + " left in this view.");
    renderQueue(items.length);
  }).catch(function (e) { say(e.message); }).then(function () { busy = false; });
}

document.addEventListener("keydown", function (e) {
  if (e.ctrlKey || e.metaKey || e.altKey || current !== "queue") return;
  var k = e.key.toLowerCase();
  if (k === "r") labelCurrent("right");
  else if (k === "w") labelCurrent("wrong");
  else if (k === "s" || e.key === "ArrowRight") move(1);
  else if (k === "b" || e.key === "ArrowLeft") move(-1);
  else return;
  e.preventDefault();
});

function renderOverview(d) {
  clear(main);
  var r = d.receipts;
  var s = d.stops;
  add(main, el("h2", "Receipts, last " + d.days + " days, this project"));
  add(main, table(["Runs", "Requests", "Cache hits", "Input tokens", "Cost (USD)"], [[r.runs, r.requests, r.cached, r.input_tokens, r.cost_usd.toFixed(4)]]));
  var cmds = Object.keys(r.by_command).sort();
  if (cmds.length) add(main, table(["Command", "Runs"], cmds.map(function (c) { return [c, r.by_command[c]]; })));
  add(main, el("h2", "Done-gate stops"));
  add(main, table(["Measure", "Value", "95% interval"], [
    ["Stops", s.stops, ""],
    ["Asked Jev", s.asked, ""],
    ["Would block", s.would_block, ""],
    ["Labelled (of would block)", s.labelled, ""],
    ["Right / wrong", s.right + " / " + s.wrong, ""],
    ["Precision", pct(s.precision), ci(s.precision_ci95)],
    ["False block rate", pct(s.false_block_rate), ci(s.false_block_rate_ci95)],
    ["p95 latency, answered (ms)", s.p95_ms === null ? "n/a" : s.p95_ms, ""],
    ["Error rate", pct(s.error_rate), ""],
    ["Unlabelled would block", s.unlabelled_would_block, ""]
  ]));
  var t = d.threshold_suggestion;
  add(main, el("h2", "Threshold suggestion"));
  var line = t.available
    ? (t.suggested === null ? "Enough labels, but no claims_done value reaches the precision target." : "Suggested claims_done: " + t.suggested + " (now " + t.current + "). Nothing is written; set it in .claude/referee.json yourself.")
    : "Not available yet: " + t.have.right + " right and " + t.have.wrong + " wrong labels, at least " + t.need.right + " of each needed. It can only suggest raising the threshold.";
  add(main, el("p", line));
  say("");
}

function renderPrivacy(d) {
  clear(main);
  add(main, el("h2", "What is stored"));
  add(main, el("p", d.data_dir + " - " + bytes(d.total_bytes) + " in total", "meta"));
  add(main, table(["Item", "Size"], d.stored.map(function (f) { return [f.name, bytes(f.bytes)]; })));
  add(main, table(["Count", "Value"], [
    ["Receipts, this project", d.counts.receipts_this_project],
    ["Receipts, all projects", d.counts.receipts_all_projects],
    ["Stops, this project", d.counts.stops_this_project],
    ["Stops, all projects", d.counts.stops_all_projects],
    ["Labelled stops, this project", d.counts.labelled_this_project]
  ]));
  add(main, table(["File", "Holds"], d.stores_text.map(function (x) { return [x.name, x.holds]; })));
  add(main, el("h2", "What would be sent to TypeSafe, and when"));
  add(main, table(["When", "What"], d.would_be_sent.map(function (x) { return [x.when, x.what]; })));
  say("");
}

function renderExport() {
  clear(main);
  add(main, el("h2", "Export, this project"));
  add(main, el("p", "Downloads JSON lines. Stops include prompt and message excerpts, so treat the file like the data directory itself."));
  var row = el("div", null, "row");
  [["receipts", "Receipts"], ["stops", "Stops with excerpts"], ["labels", "Labels only"]].forEach(function (k) {
    var b = el("button", k[1], "act");
    b.type = "button";
    b.addEventListener("click", function () { download(k[0]); });
    row.appendChild(b);
  });
  add(main, row);
}

function download(kind) {
  request("/api/export?kind=" + encodeURIComponent(kind)).then(function (r) { return r.blob(); }).then(function (blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "claude-referee-" + kind + ".jsonl";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    say("Exported " + kind + ".");
  }).catch(function (e) { say(e.message); });
}

if (!token) {
  renderTabs();
  clear(main);
  add(main, el("p", "No session token. Open the URL printed in the terminal by claude-referee ui."));
} else {
  show("queue");
}
})();
`;
