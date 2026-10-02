import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
const script = join(dir, "rotate.sh");
const run = (args, cwd) => {
  const r = spawnSync("bash", [script, ...args], { encoding: "utf8", cwd, timeout: 20000 });
  return { out: r.stdout, err: r.stderr, status: r.status };
};
const make = (files, extra = () => {}) => {
  const d = mkdtempSync(join(tmpdir(), "rotate-"));
  for (const [name, t] of Object.entries(files)) {
    writeFileSync(join(d, name), "x");
    utimesSync(join(d, name), t, t);
  }
  extra(d);
  return d;
};
const left = (d) => readdirSync(d).sort();
{
  const d = make({ "a.log": 100, "b.log": 200, "c.log": 300, "d.txt": 50 });
  assert.deepEqual(run([d, "2"], dir), { out: "removed a.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["b.log", "c.log", "d.txt"]);
}
{
  const d = make({ "my app.log": 100, "old file.log": 50, "new one.log": 300, "mid  dle.log": 200 });
  assert.deepEqual(run([d, "2"], dir), { out: "removed old file.log\nremoved my app.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["mid  dle.log", "new one.log"]);
}
{
  const d = make({ "x.log": 100, "y.log": 100, "z.log": 100 });
  assert.deepEqual(run([d, "1"], dir), { out: "removed x.log\nremoved y.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["z.log"]);
}
{
  const d = make({ "B.log": 100, "a.log": 100, "_.log": 100 });
  assert.deepEqual(run([d, "1"], dir), { out: "removed B.log\nremoved _.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["a.log"]);
}
{
  const d = make({ ".hidden.log": 1, "a.log": 100, "b.log": 200 }, (p) => {
    mkdirSync(join(p, "sub.log"));
    mkdirSync(join(p, "sub"));
    writeFileSync(join(p, "sub", "deep.log"), "x");
    utimesSync(join(p, "sub.log"), 1, 1);
    symlinkSync(join(p, "b.log"), join(p, "link.log"));
  });
  assert.deepEqual(run([d, "1"], dir), { out: "removed a.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), [".hidden.log", "b.log", "link.log", "sub", "sub.log"]);
  assert.deepEqual(run([d, "0"], dir), { out: "removed b.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), [".hidden.log", "link.log", "sub", "sub.log"]);
}
{
  const d = make({ "-n.log": 10, "a*b.log": 20, "a1b.log": 30, "[x].log": 15, "q?.log": 40, "qz.log": 50 });
  assert.deepEqual(run([d, "2"], dir), { out: "removed -n.log\nremoved [x].log\nremoved a*b.log\nremoved a1b.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["q?.log", "qz.log"]);
}
{
  const d = make({ "a.log": 1, "b.log": 2 });
  assert.deepEqual(run([d, "5"], dir), { out: "", err: "", status: 0 });
  assert.deepEqual(run([d, "2"], dir), { out: "", err: "", status: 0 });
  assert.deepEqual(left(d), ["a.log", "b.log"]);
  assert.deepEqual(run([d, "007"], dir), { out: "", err: "", status: 0 });
  assert.deepEqual(run([d, "0"], dir), { out: "removed a.log\nremoved b.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), []);
  assert.deepEqual(run([d, "0"], dir), { out: "", err: "", status: 0 });
}
{
  const d = make({ "a.log": 1, "b.log": 2, "c.log": 3 });
  assert.deepEqual(run([d, "1", "--dry-run"], dir), { out: "would remove a.log\nwould remove b.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["a.log", "b.log", "c.log"]);
}
{
  const d = make({ "a.log": 1, "b.log": 2, "c.log": 3 });
  const rel = d.slice(d.lastIndexOf("/") + 1);
  assert.deepEqual(run([`${rel}/`, "2"], tmpdir()), { out: "removed a.log\n", err: "", status: 0 });
  assert.deepEqual(left(d), ["b.log", "c.log"]);
}
{
  const d = make({ "a.log": 1, "b.log": 2 });
  for (const args of [[], [d], [d, "1", "--dry-run", "x"], [d, "1", "--force"], [d, "abc"], [d, "-1"], [d, "1.5"], [d, ""], [d, "1 "], [join(d, "missing"), "1"], [join(d, "a.log"), "1"]]) {
    const r = run(args, dir);
    assert.equal(r.status, 2, JSON.stringify(args));
    assert.equal(r.out, "", JSON.stringify(args));
    assert.match(r.err, /^usage:/, JSON.stringify(args));
  }
  assert.deepEqual(left(d), ["a.log", "b.log"]);
}
