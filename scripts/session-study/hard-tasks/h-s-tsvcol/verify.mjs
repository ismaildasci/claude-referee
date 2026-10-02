import { spawnSync } from "node:child_process";
const script = join(dir, "tsvcol.sh");
const run = (args, input) => {
  const r = spawnSync("bash", [script, ...args], { input, encoding: "utf8", cwd: dir, timeout: 20000 });
  return { out: r.stdout, err: r.stderr, status: r.status };
};
const ok = (col, input, out) => assert.deepEqual(run([col], input), { out, err: "", status: 0 }, `${col} ${JSON.stringify(input)}`);
const table = "id\tname\tnote\n1\tann\tfirst\n2\t\tsecond\n3\tcy\t\n\tdee\tlast";
ok("name", table, "ann\n\ncy\ndee\n");
ok("id", table, "1\n2\n3\n\n");
ok("note", table, "first\nsecond\n\nlast\n");
ok("name", table.replace(/\n/g, "\r\n") + "\r\n", "ann\n\ncy\ndee\n");
ok("note", table.replace(/\n/g, "\r\n"), "first\nsecond\n\nlast\n");
ok("name", "id\tname\tnote\n1\tann\tx\n\n\n2\tbob\ty\n\n", "ann\nbob\n");
ok("note", "id\tname\tnote\n1\tann\n2\tbob\tx\ty\tz\n", "\nx\n");
ok("name", "id\tname\tnote\n6\t a b \tC:\\temp\\new\n", " a b \n");
ok("note", "id\tname\tnote\n6\t a b \tC:\\temp\\new\n", "C:\\temp\\new\n");
ok("a\\tb", "x\ta\\tb\n1\t2\n3\t4\n", "2\n4\n");
ok("a\\nb", "a\\nb\tz\nq\tr\n", "q\n");
ok("Unit Price", "Item\tUnit Price\nA\t1.50\nB\t\n", "1.50\n\n");
ok("v", "v\n \n\nx\n", " \nx\n");
ok("dup", "dup\tx\tdup\n1\t2\t3\n", "1\n");
ok("x", "id\tx\n", "");
ok("x", "id\tx", "");
ok("b", "a\tb\n\t\n\t\n", "\n\n");
ok("c", "a\tb\tc\n\t\t\n\t\tz\n", "\nz\n");
const missing = (col, input) => assert.deepEqual(run([col], input), { out: "", err: `no such column: ${col}\n`, status: 3 }, `${col} ${JSON.stringify(input)}`);
missing("nope", table);
missing("Name", table);
missing("name", "");
missing("name", "id\tother\n1\t2\n");
for (const args of [[], ["a", "b"]]) {
  const r = run(args, table);
  assert.equal(r.status, 2);
  assert.equal(r.out, "");
  assert.match(r.err, /^usage:/);
}
