// HTML, CSS and browser script of the local dashboard, served from strings so the bundle needs no asset files.
// The script builds every node with textContent and never uses HTML parsing APIs; stored excerpts are untrusted text.
// show() bumps seq, so a reply or label for an earlier view never draws over the current one; R/W while a label saves are refused aloud.

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

export const APP_CSS = `:root{--bg:#fbfbfa;--fg:#1c1c1a;--muted:#5e5e59;--line:#d9d9d3;--card:#fff;--accent:#1f5fbf;--ok:#1b7a3d;--bad:#b3261e;--warn:#8a5a00;--focus:#1f5fbf}
@media (prefers-color-scheme:dark){:root{--bg:#161615;--fg:#ecece8;--muted:#a3a39c;--line:#363633;--card:#1e1e1c;--accent:#7aa7f0;--ok:#6fcf8f;--bad:#f08a82;--warn:#e3b45c;--focus:#7aa7f0}}
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
select{font:inherit;font-size:15px;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:6px;padding:4px 8px}
.controls{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center;margin:8px 0}
.controls label{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:15px}
h3{font-size:15px;font-weight:600;color:var(--muted);margin:24px 0 0;padding-bottom:4px;border-bottom:2px solid var(--line)}
.flow{padding:12px 0;border-bottom:1px solid var(--line)}
.lane{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1.5fr) minmax(0,.85fr);gap:4px 0;align-items:baseline}
.lane li{padding-right:12px;overflow-wrap:anywhere}
.lane li+li::before{content:"\\2192" / "";color:var(--muted);margin-right:10px}
.when{color:var(--muted);font-variant-numeric:tabular-nums;margin-right:8px}
.cmd{font-weight:600}
.sub{display:block;color:var(--muted);font-size:14px}
.jev{font-variant-numeric:tabular-nums}
.out{font-weight:600}
.v-ok{color:var(--ok)}
.v-bad{color:var(--bad)}
.v-mid{color:var(--warn)}
.flow details{margin:8px 0 0}
.flow summary{cursor:pointer;color:var(--accent);font-size:14px;width:max-content;max-width:100%}
.flow details table{margin-top:4px;font-size:14px}
.flow details td{overflow-wrap:anywhere}
meter{width:72px;height:8px;vertical-align:middle;margin-right:6px}
meter::-webkit-meter-bar{background:var(--line);border:0;border-radius:4px}
meter::-webkit-meter-optimum-value{background:var(--accent);border-radius:4px}
meter::-moz-meter-bar{background:var(--accent)}
.opts{display:block;color:var(--muted);font-size:13px}
@media (max-width:620px){.lane{grid-template-columns:1fr}.lane li+li::before{content:"\\2193" / ""}}
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
var TABS = [["flow", "Flow"], ["queue", "Labelling queue"], ["overview", "Overview"], ["privacy", "Privacy"], ["export", "Export"]];
var current = "flow";
var flowQuery = { days: "7", command: "all" };
var items = [];
var index = 0;
var seq = 0;

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
function int(n) { return typeof n === "number" && Number.isInteger(n) ? String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",") : n; }
function plural(n, one, many) { return int(n) + " " + (n === 1 ? one : many); }
function marksText(m) {
  if (!m) return "";
  var parts = [];
  if (m.truncated_checks > 0) parts.push(plural(m.truncated_checks, "check", "checks") + " with cut-off output");
  if (m.subagent_calls > 0) parts.push(plural(m.subagent_calls, "subagent call", "subagent calls"));
  if (m.subagent_reports > 0) parts.push(plural(m.subagent_reports, "subagent or background task", "subagents or background tasks") + " finished");
  if (m.stale_pass) parts.push("a check passed in the previous turn, none after this turn's edits");
  return parts.length ? "Marks (read in code, not sent to Jev): " + parts.join("; ") : "";
}
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
  var my = ++seq;
  function live(f) { return function (x) { if (my === seq) f(x); }; }
  current = name;
  items = [];
  index = 0;
  renderTabs();
  say("");
  clear(main);
  add(main, el("p", "Loading"));
  if (name === "flow") return getJson("/api/flow?days=" + encodeURIComponent(flowQuery.days) + "&command=" + encodeURIComponent(flowQuery.command)).then(live(renderFlow)).catch(live(fail));
  if (name === "queue") return getJson("/api/queue").then(live(function (d) { items = d.stops; index = 0; renderQueue(d.total); })).catch(live(fail));
  if (name === "overview") return getJson("/api/overview").then(live(renderOverview)).catch(live(fail));
  if (name === "privacy") return getJson("/api/privacy").then(live(renderPrivacy)).catch(live(fail));
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
  card.tabIndex = -1;
  card.setAttribute("aria-label", "Stop " + (index + 1) + " of " + items.length);
  add(card, el("p", "Stop " + (index + 1) + " of " + items.length + " - " + s.ts + " - " + s.edits + (s.edits === 1 ? " edit, " : " edits, ") + s.checks + (s.checks === 1 ? " check" : " checks") + " - done score " + (s.claims_done === null ? "n/a" : s.claims_done.toFixed(2)) + (s.configured ? " - set to " + s.configured + ", not built, ran as shadow" : ""), "meta"));
  var marks = marksText(s.marks);
  if (marks) add(card, el("p", marks, "meta"));
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
  card.focus();
}

function move(step) {
  if (items.length === 0) return;
  index = (index + step + items.length) % items.length;
  renderQueue(items.length);
}

var busy = false;
function labelCurrent(value) {
  if (current !== "queue" || items.length === 0) return;
  if (busy) return say("Still saving the previous label; press " + value[0].toUpperCase() + " again when it is saved.");
  var s = items[index], my = seq;
  busy = true;
  request("/api/label", { method: "POST", body: JSON.stringify({ id: s.id, label: value }) }).then(function () {
    if (my === seq) {
      var i = items.indexOf(s);
      items.splice(i, 1);
      if (i < index) index--;
      renderQueue(items.length);
    }
    say("Stop of " + s.ts + " labelled " + value + "." + (my === seq ? " " + items.length + " left in this view." : ""));
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

window.addEventListener("hashchange", function () {
  var t = new URLSearchParams(location.hash.slice(1)).get("t");
  if (!t) return;
  token = t;
  history.replaceState(null, "", location.pathname);
  show("flow");
});

function pad(n) { return n < 10 ? "0" + n : String(n); }
function day(ts) { var d = new Date(ts); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function clock(ts) { var d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()); }
function p2(v) { return typeof v === "number" ? v.toFixed(2) : "n/a"; }
function msText(v) { return typeof v === "number" ? int(Math.round(v)) + " ms" : ""; }
function tone(v) {
  if (/^(met|supported|clear|pass|passed|ok|yes)$/.test(v)) return "v-ok";
  if (/^(missing|contradicted|unsupported|violated|fail|failed|no|error)$/.test(v)) return "v-bad";
  return "v-mid";
}

function picker(text, value, options, onPick) {
  var wrap = el("label", text);
  var s = el("select");
  options.forEach(function (o) {
    var opt = el("option", o[1]);
    opt.value = o[0];
    if (o[0] === value) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener("change", function () { onPick(s.value); });
  return add(wrap, s);
}

function jevText(e) {
  if (e.error) return "Failed: " + e.error;
  if (e.requests > 0) return "Jev: " + plural(e.requests, "request", "requests") + (e.cached > 0 ? " and " + plural(e.cached, "stored answer", "stored answers") : "") + ", " + int(e.input_tokens) + " tokens, " + msText(e.ms);
  if (e.cached > 0) return "From the cache: " + plural(e.cached, "stored answer", "stored answers") + ", " + msText(e.ms);
  return "Decided in code, nothing sent to Jev, " + msText(e.ms);
}

function stopJevText(e) {
  if (e.skipped) return "Not asked: " + e.skipped.replace(/_/g, " ") + (e.error ? ", error " + e.error : "");
  if (e.error) return "Failed: " + e.error;
  if (e.claims_done === null) return "No answer stored";
  return "Jev: done " + p2(e.claims_done) + ", verified " + p2(e.claims_verified) + ", " + msText(e.ms);
}

function answersBlock(e) {
  var count = 0;
  e.answers.forEach(function (a) { count += a.questions.length; });
  var more = e.answers_more, read = e.answers.length + e.answers_missing;
  if (count === 0 && !e.answers_missing && !more) return null;
  var box = el("details");
  var head = "Jev's answers" + (count ? ": " + plural(count, "question", "questions") : "");
  if (more) head += (count ? ", " : ": ") + plural(more, "stored answer", "stored answers") + " not read";
  add(box, el("summary", head));
  e.answers.forEach(function (a) {
    add(box, el("p", a.model + ", answered " + day(a.answered_at) + " " + clock(a.answered_at), "meta"));
    var t = el("table");
    var hr = el("tr");
    ["Question", "Answer", "Probability of that answer"].forEach(function (h) { var th = el("th", h); th.scope = "col"; hr.appendChild(th); });
    add(t, add(el("thead"), hr));
    var body = el("tbody");
    a.questions.forEach(function (q) {
      var tr = el("tr");
      tr.appendChild(el("td", q.id));
      var answer = el("td", q.value);
      if (q.options.length) add(answer, el("span", q.options.map(function (o) { return o.label + " " + p2(o.p); }).join(", "), "opts"));
      tr.appendChild(answer);
      var prob = el("td", null, "n");
      if (typeof q.p === "number") {
        var m = el("meter");
        m.min = 0;
        m.max = 1;
        m.value = q.p;
        m.setAttribute("aria-hidden", "true");
        add(prob, m, el("span", p2(q.p)));
      } else add(prob, el("span", "n/a"));
      tr.appendChild(prob);
      body.appendChild(tr);
    });
    add(box, add(t, body));
  });
  if (more) add(box, el("p", plural(more, read ? "more stored answer" : "stored answer", read ? "more stored answers" : "stored answers") + " not read. A stored answer holds Jev's reply to one request; the page reads at most 12 per call and 600 per page" + (read < 12 ? ", newest calls first, and the 600 ran out here. Pick this command under Show to leave more for this call." : "."), "meta"));
  if (e.answers_missing) add(box, el("p", plural(e.answers_missing, "stored answer is", "stored answers are") + " gone: expired after 30 days, removed by an overrule, or never written.", "meta"));
  return box;
}

function flowItem(e) {
  var item = el("article", null, "flow");
  var lane = el("ol", null, "lane");
  var first = el("li");
  add(first, el("span", clock(e.ts), "when"));
  var out;
  if (e.kind === "stop") {
    item.setAttribute("aria-label", "Done-gate stop at " + clock(e.ts));
    add(first, el("span", "Done-gate stop", "cmd"), el("span", e.mode + " mode" + (e.configured ? " (set to " + e.configured + ", not built)" : "") + ", " + plural(e.edits, "edit", "edits") + ", " + plural(e.checks, "check", "checks") + (e.session ? ", session " + e.session : ""), "sub"));
    var outText = e.would_block === null ? "skipped" : e.would_block ? "would block" : "would pass";
    if (e.label) outText += ", labelled " + e.label;
    out = el("li", outText, "out " + (e.would_block === null ? "v-mid" : e.would_block ? "v-bad" : "v-ok"));
    add(lane, first, el("li", stopJevText(e), "jev"), out);
    return add(item, lane);
  }
  item.setAttribute("aria-label", e.command + " at " + clock(e.ts));
  var sub = [];
  if (e.pack) sub.push(e.pack + " pack");
  if (e.model) sub.push(e.model);
  if (e.session) sub.push("session " + e.session);
  add(first, el("span", e.command, "cmd"), el("span", sub.join(", "), "sub"));
  var verdict = e.verdict || (e.error ? "error" : "no verdict");
  out = el("li", verdict, "out " + tone(verdict));
  add(lane, first, el("li", jevText(e), "jev"), out);
  add(item, lane);
  if (e.outcome) add(item, el("p", "Outcome: " + e.outcome, "meta"));
  if (e.overruled) add(item, el("p", "Overruled: voided with receipts overrule; its stored answers were deleted.", "meta"));
  var answers = answersBlock(e);
  if (answers) add(item, answers);
  return item;
}

function renderFlow(d) {
  clear(main);
  add(main, el("h2", "What went to Jev and what came back, this project"));
  var controls = el("div", null, "controls");
  add(controls,
    picker("Period", String(d.days), [["1", "Last 24 hours"], ["7", "Last 7 days"], ["30", "Last 30 days"]], function (v) { flowQuery.days = v; show("flow"); }),
    picker("Show", d.command, [["all", "Everything"]].concat(d.commands.map(function (c) { return [c, c === "stop" ? "Done-gate stops" : c]; })), function (v) { flowQuery.command = v; show("flow"); }));
  add(main, controls);
  if (d.total === 0) {
    add(main, el("p", "Nothing in this period. Every claude-referee command run in this project, and every done-gate stop, shows up here; pick a longer period to look further back."));
    say("");
    return;
  }
  var calls = 0, requests = 0, cached = 0, stops = 0;
  d.events.forEach(function (e) { if (e.kind === "stop") stops++; else { calls++; requests += e.requests; cached += e.cached; } });
  var parts = [];
  if (calls) parts.push(plural(calls, "call", "calls") + " (" + plural(requests, "request", "requests") + " to Jev, " + plural(cached, "answer", "answers") + " from the cache)");
  if (stops) parts.push(plural(stops, "done-gate stop", "done-gate stops"));
  var line = parts.join(", ");
  if (d.total > d.shown) line += ". Showing the newest " + int(d.shown) + " of " + int(d.total) + "; pick a command or a shorter period to see the rest.";
  add(main, el("p", line, "meta"));
  var last = "";
  d.events.forEach(function (e) {
    var dd = day(e.ts);
    if (dd !== last) { add(main, el("h3", dd)); last = dd; }
    add(main, flowItem(e));
  });
  say("");
}

function renderOverview(d) {
  clear(main);
  var r = d.receipts;
  var s = d.stops;
  add(main, el("h2", "Receipts, last " + d.days + " days, this project"));
  add(main, table(["Runs", "Requests", "Cache hits", "Input tokens", "Cost (USD)"], [[int(r.runs), int(r.requests), int(r.cached), int(r.input_tokens), r.cost_usd.toFixed(4)]]));
  var cmds = Object.keys(r.by_command).sort();
  if (cmds.length) add(main, table(["Command", "Runs"], cmds.map(function (c) { return [c, int(r.by_command[c])]; })));
  add(main, el("h2", "Done-gate stops"));
  add(main, table(["Measure", "Value", "95% interval"], [
    ["Stops", int(s.stops), ""],
    ["Asked Jev", int(s.asked), ""],
    ["Would block", int(s.would_block), ""],
    ["Labelled (of would block)", int(s.labelled), ""],
    ["Right / wrong", int(s.right) + " / " + int(s.wrong), ""],
    ["Precision", pct(s.precision), ci(s.precision_ci95)],
    ["False block rate", pct(s.false_block_rate), ci(s.false_block_rate_ci95)],
    ["p95 latency, answered (ms)", s.p95_ms === null ? "n/a" : int(s.p95_ms), ""],
    ["Error rate", pct(s.error_rate), ""],
    ["Unlabelled would block", int(s.unlabelled_would_block), ""]
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
    ["Receipts, this project", int(d.counts.receipts_this_project)],
    ["Receipts, all projects", int(d.counts.receipts_all_projects)],
    ["Stops, this project", int(d.counts.stops_this_project)],
    ["Stops, all projects", int(d.counts.stops_all_projects)],
    ["Labelled stops, this project", int(d.counts.labelled_this_project)]
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
  show("flow");
}
})();
`;
