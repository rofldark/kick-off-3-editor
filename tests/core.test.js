// Tests for docs/core.js (the browser version of the tool).
//   KO3_ROM="path/to/Kick Off 3.sfc" node --test tests/
// Without KO3_ROM only the ROM-independent tests run. With Python available, the results
// are also compared byte for byte with the Python tool (kickoff3_text.py).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const K = require("../docs/core.js");

const ROM = process.env.KO3_ROM;
const haveRom = ROM && fs.existsSync(ROM);
const py = ["python", "python3", "py"].find((c) => spawnSync(c, ["--version"]).status === 0);

function load() {
  const { rom } = K.splitHeader(new Uint8Array(fs.readFileSync(ROM)));
  return { rom, parsed: K.parseRom(rom) };
}

function run(rom, parsed, edit, opts) {
  const edits = { menu: new Map(), match: new Map(), names: new Map() };
  edit(edits, parsed);
  const r = K.buildChanges(rom, parsed, edits, opts || {});
  if (r.errors.length) return { errors: r.errors };
  const out = K.applyChanges(rom, r.changes, r.notes);
  return { out, edits, r };
}

const setMenu = (parsed, edits, from, to) => {
  const it = parsed.menu.find((m) => K.bytesToUi(m.orig) === from);
  assert.ok(it, "menu text not found: " + from);
  edits.menu.set(it.off, K.uiToBytes(to));
};

test("text escaping round trip", () => {
  const raw = Uint8Array.from({ length: 255 }, (_, i) => i + 1);
  assert.deepStrictEqual(K.uiToBytes(K.bytesToUi(raw)), raw);
  assert.deepStrictEqual(K.uiToBytes("NÄCHSTES"), Uint8Array.from([78, 0x8e, 67, 72, 83, 84, 69, 83]));
  assert.throws(() => K.uiToBytes("ä"));
});

test("BPS and IPS without a ROM", () => {
  const src = Uint8Array.from({ length: 10240 }, (_, i) => i & 255);
  const dst = src.slice();
  dst[10] ^= 0xff;
  dst.set([97, 98, 99], 5000);
  assert.deepStrictEqual(K.applyBps(src, K.makeBps(src, dst)), dst);
  assert.deepStrictEqual(K.applyIps(src, K.makeIps(src, dst)), dst);
});

test("expected ROM", { skip: !haveRom }, () => {
  const { rom, parsed } = load();
  assert.ok(K.isExpected(rom));
  assert.strictEqual(parsed.menu.length, 688);
  assert.strictEqual(parsed.match.length, 219);
  assert.strictEqual(parsed.names.length, 2340);
});

test("unchanged build is identical", { skip: !haveRom }, () => {
  const { rom, parsed } = load();
  const { out } = run(rom, parsed, () => {});
  assert.deepStrictEqual(out, rom);
});

test("in-place fix, patch round trip", { skip: !haveRom }, () => {
  const { rom, parsed } = load();
  const { out, edits, r } = run(rom, parsed, (e, p) => {
    setMenu(p, e, "DEUTSCHE", "DEUTSCH");
  });
  assert.ok(out);
  assert.ok(K.verifyMenu(out, parsed, r.menuFull, edits).ok);
  assert.deepStrictEqual(K.applyBps(rom, K.makeBps(rom, out)), out);
  assert.deepStrictEqual(K.applyIps(rom, K.makeIps(rom, out)), out);
});

test("too long text is an error without repack", { skip: !haveRom }, () => {
  const { rom, parsed } = load();
  const res = run(rom, parsed, (e, p) => setMenu(p, e, "Samporia", "Sampdoria"));
  assert.ok(res.errors && res.errors[0].code === "too-long");
});

test("in-game text needs exact length, names are padded", { skip: !haveRom }, () => {
  const { rom, parsed } = load();
  const bad = run(rom, parsed, (e, p) => {
    const it = p.match.find((m) => K.bytesToUi(m.orig) === "    abseits    ");
    e.match.set(it.off, K.uiToBytes("    abseits   "));
  });
  assert.ok(bad.errors);
  const ok = run(rom, parsed, (e, p) => e.names.set(p.names[0].off, K.uiToBytes("D.Seaman")));
  assert.strictEqual(new TextDecoder().decode(ok.out.slice(0xf0001, 0xf0001 + 14).slice(0, 12)), "D.Seaman    ");
});

// --- cross-check with the Python tool --------------------------------------------
function pythonReference(edit, extra) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ko3-"));
  const script = path.join(__dirname, "..", "kickoff3_text.py");
  const dir = path.join(tmp, "texte");
  const sh = (...a) => {
    const r = spawnSync(py, [script, ...a], { encoding: "utf8" });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  };
  sh("dump", ROM, dir);
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    edit(p, fs.readFileSync(p, "utf8"));
  }
  sh("insert", ROM, dir, path.join(tmp, "out.sfc"), ...(extra || []));
  return new Uint8Array(fs.readFileSync(path.join(tmp, "out.sfc")));
}
const sub = (a, b) => (p, s) => { if (s.includes(a)) fs.writeFileSync(p, s.replace(a, b)); };

test("matches the Python tool: in place", { skip: !haveRom || !py }, () => {
  const { rom, parsed } = load();
  const ref = pythonReference((p, s) => {
    sub("|DEUTSCHE|", "|DEUTSCH|")(p, s);
    sub("|Bilbad|", "|Bilbao|")(p, fs.readFileSync(p, "utf8"));
    sub("|    abseits    |", "|    Abseits    |")(p, fs.readFileSync(p, "utf8"));
  });
  const { out } = run(rom, parsed, (e, pp) => {
    setMenu(pp, e, "DEUTSCHE", "DEUTSCH");
    setMenu(pp, e, "Bilbad", "Bilbao");
    const it = pp.match.find((m) => K.bytesToUi(m.orig) === "    abseits    ");
    e.match.set(it.off, K.uiToBytes("    Abseits    "));
  });
  assert.deepStrictEqual(out, ref);
});

test("matches the Python tool: --repack", { skip: !haveRom || !py }, () => {
  const { rom, parsed } = load();
  const ref = pythonReference((p, s) => {
    sub("|Samporia|", "|Sampdoria|")(p, s);
    sub("|Assesment|", "|Assessment|")(p, fs.readFileSync(p, "utf8"));
  }, ["--repack"]);
  const { out, edits, r } = run(rom, parsed, (e, pp) => {
    setMenu(pp, e, "Samporia", "Sampdoria");
    setMenu(pp, e, "Assesment", "Assessment");
  }, { repack: true });
  assert.ok(out, JSON.stringify(r && r.errors));
  assert.deepStrictEqual(out, ref);
  assert.ok(K.verifyMenu(out, parsed, r.menuFull, edits).ok);
});
