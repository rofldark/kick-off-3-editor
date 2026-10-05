/*
 * Kick Off 3 Text Studio - core logic (no DOM access).
 * Works in the browser (global KO3) and in Node (require). A direct port of
 * kickoff3_text.py; tests/core.test.js checks both produce identical ROMs.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KO3 = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- ROM layout (file offsets, headerless) ---------------------------------
  const C = {
    EXPECTED_SIZE: 0x100000,
    EXPECTED_CRC32: 0x1ac7f523,
    EXPECTED_SHA1: "7ab7898b0d00fa91e75365a060bd36ddba232f6a",
    TABLE_OFF: 0x67378,
    TABLE_WORDS: (0x67ffe - 0x67378) >> 1,
    TEXT_BASE: 0x65f3b,
    TEXT_END: 0x67378,
    MATCH_START: 0xc2372,
    MATCH_END: 0xc3138,
    NAMES_START: 0xf0001,
    NAMES_END: 0xf7ff9,
    NAME_LEN: 12,
    NAME_STRIDE: 14,
    CHECKSUM_OFF: 0x7fdc,
    MENU_SECTION: 320,
    MATCH_LANG_START: 0xc2388,
    MATCH_LANG_SIZE: 0x2c0,
  };
  const LANGS = ["en", "fr", "de", "it", "es"];

  // Bytes the game font uses for capital letters with diacritics (CP437-like).
  const SPECIAL = { 0x80: "Ç", 0x8e: "Ä", 0x99: "Ö", 0x9a: "Ü" };
  const SPECIAL_REV = { "Ç": 0x80, "Ä": 0x8e, "Ö": 0x99, "Ü": 0x9a };

  // --- helpers ---------------------------------------------------------------
  let crcTable = null;
  function crc32(u8) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crcTable[n] = c >>> 0;
      }
    }
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = crcTable[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function splitHeader(bytes) {
    const r = bytes.length % 1024;
    if (r === 512) return { header: bytes.slice(0, 512), rom: bytes.slice(512) };
    if (r === 0) return { header: new Uint8Array(0), rom: bytes.slice() };
    throw new Error("Unexpected file size: " + bytes.length);
  }

  function isExpected(rom) {
    return rom.length === C.EXPECTED_SIZE && crc32(rom) === C.EXPECTED_CRC32;
  }

  const key = (u8) => String.fromCharCode.apply(null, u8); // bytes -> latin1 string
  const hex = (n, w) => n.toString(16).padStart(w || 6, "0");
  const eqBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const concat = (parts) => {
    const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
    let o = 0;
    for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  };

  // Text <-> bytes. UI text shows known special bytes as letters, others as \xNN.
  function bytesToUi(u8) {
    let s = "";
    for (const b of u8) {
      if (b === 0x5c) s += "\\\\";
      else if (b >= 0x20 && b <= 0x7e) s += String.fromCharCode(b);
      else if (SPECIAL[b]) s += SPECIAL[b];
      else s += "\\x" + hex(b, 2);
    }
    return s;
  }

  function uiToBytes(text) {
    const out = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === "\\") {
        if (text[i + 1] === "\\") { out.push(0x5c); i++; continue; }
        const m = /^x([0-9a-fA-F]{2})/.exec(text.slice(i + 1, i + 4));
        if (!m) throw new Error("bad-escape:" + text.slice(i, i + 4));
        out.push(parseInt(m[1], 16));
        i += 3;
        continue;
      }
      if (SPECIAL_REV[c] !== undefined) { out.push(SPECIAL_REV[c]); continue; }
      const code = c.charCodeAt(0);
      if (code < 0x20 || code > 0x7e) throw new Error("bad-char:" + c);
      out.push(code);
    }
    return Uint8Array.from(out);
  }

  // --- reading the ROM -------------------------------------------------------
  function menuTable(rom) {
    const refs = [];
    const word = (j) => rom[C.TABLE_OFF + 2 * j] | (rom[C.TABLE_OFF + 2 * j + 1] << 8);
    for (let i = 0; i < C.TABLE_WORDS; i++) {
      const w0 = word(i);
      if (i > 100 && w0 === 0 && word(i + 1) === 0 && word(i + 2) === 0) break;
      const pos = C.TEXT_BASE + w0;
      if (pos >= C.TEXT_BASE && pos < C.TEXT_END && (pos === C.TEXT_BASE || rom[pos - 1] === 0))
        refs.push({ idx: i, pos });
    }
    return refs;
  }

  function parseRom(rom) {
    const refs = menuTable(rom);
    const langs = new Map();
    const strings = new Map();
    for (const { idx, pos } of refs) {
      const l = Math.min(Math.floor(idx / C.MENU_SECTION), LANGS.length - 1);
      if (!langs.has(pos)) langs.set(pos, new Set());
      langs.get(pos).add(l);
      if (!strings.has(pos)) {
        const end = rom.indexOf(0, pos);
        if (end < 0) throw new Error("Unterminated string at " + hex(pos));
        strings.set(pos, rom.slice(pos, end));
      }
    }
    const menu = [...strings.keys()].sort((a, b) => a - b).map((off) => {
      const used = langs.get(off);
      return { kind: "menu", off, max: strings.get(off).length, orig: strings.get(off),
               lang: used.size === 1 ? LANGS[[...used][0]] : "shared" };
    });

    const match = [];
    for (let pos = C.MATCH_START; pos < C.MATCH_END; ) {
      const end = rom.indexOf(0, pos);
      if (end < 0) break;
      const s = rom.slice(pos, end);
      const n = Math.floor((pos - C.MATCH_LANG_START) / C.MATCH_LANG_SIZE);
      if ((s.length === 15 || s.length === 21) && s.every((b) => b >= 0x20 && b < 0x7f) &&
          n >= 0 && n < LANGS.length)
        match.push({ kind: "match", off: pos, max: s.length, orig: s, lang: LANGS[n] });
      pos = end + 1;
    }

    const names = [];
    for (let o = C.NAMES_START; o < C.NAMES_END; o += C.NAME_STRIDE) {
      let e = o + C.NAME_LEN;
      while (e > o && rom[e - 1] === 0x20) e--;
      names.push({ kind: "names", off: o, max: C.NAME_LEN, orig: rom.slice(o, e), lang: "all" });
    }
    return { menu, match, names, refs };
  }

  // --- building changes ------------------------------------------------------
  // edits: { menu: Map(off -> Uint8Array), match: Map, names: Map }
  function buildChanges(rom, parsed, edits, opts) {
    opts = opts || {};
    const changes = [];
    const errors = [];
    const notes = [];
    let repackInfo = null;

    const orig = new Map(parsed.menu.map((m) => [m.off, m.orig]));
    const edited = new Map();
    for (const [off, raw] of edits.menu || []) {
      if (!orig.has(off)) errors.push({ kind: "menu", off, code: "unknown" });
      else if (!eqBytes(raw, orig.get(off))) {
        if (raw.includes(0)) errors.push({ kind: "menu", off, code: "nul" });
        edited.set(off, raw);
      }
    }
    const tooLong = [...edited].filter(([o, r]) => r.length > orig.get(o).length);
    if (tooLong.length && !opts.repack) {
      for (const [o, r] of tooLong)
        errors.push({ kind: "menu", off: o, code: "too-long", len: r.length, max: orig.get(o).length });
    }
    let menuFull = null;
    if (tooLong.length && opts.repack) {
      menuFull = new Map([...orig].map(([o, s]) => [o, edited.get(o) || s]));
      repackInfo = repackMenu(rom, parsed.refs, menuFull, changes, errors, notes);
    } else if (!tooLong.length) {
      const pad = opts.pad === "space" ? 0x20 : 0x00;
      for (const [o, r] of edited) {
        const out = new Uint8Array(orig.get(o).length).fill(pad);
        out.set(r);
        changes.push([o, out]);
      }
    }

    for (const [off, raw] of edits.match || []) {
      const item = parsed.match.find((m) => m.off === off);
      if (!item) { errors.push({ kind: "match", off, code: "unknown" }); continue; }
      if (eqBytes(raw, item.orig)) continue;
      if (raw.length !== item.max)
        errors.push({ kind: "match", off, code: "exact", len: raw.length, max: item.max });
      else changes.push([off, raw]);
    }

    for (const [off, raw] of edits.names || []) {
      const item = parsed.names.find((m) => m.off === off);
      if (!item) { errors.push({ kind: "names", off, code: "unknown" }); continue; }
      if (eqBytes(raw, item.orig)) continue;
      if (raw.length > C.NAME_LEN)
        errors.push({ kind: "names", off, code: "too-long", len: raw.length, max: C.NAME_LEN });
      else {
        const out = new Uint8Array(C.NAME_LEN).fill(0x20);
        out.set(raw);
        changes.push([off, out]);
      }
    }
    return { changes, errors, notes, repackInfo, menuFull };
  }

  function repackMenu(rom, refs, full, changes, errors, notes) {
    const starts = [...new Set(refs.map((r) => r.pos))].sort((a, b) => a - b);
    const pool = [];
    for (const o of starts) {
      const n = rom.indexOf(0, o) - o + 1;
      if (pool.length && pool[pool.length - 1][1] === o) pool[pool.length - 1][1] = o + n;
      else pool.push([o, o + n]);
    }
    const uniq = new Map();
    for (const v of full.values()) uniq.set(key(v), v);
    const contents = [...uniq.entries()].sort((a, b) =>
      b[1].length - a[1].length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    const cursor = pool.map((iv) => iv.slice());
    const placed = new Map();
    for (const [k, v] of contents) {
      const need = v.length + 1;
      const iv = cursor.find((c) => c[1] - c[0] >= need);
      if (!iv) {
        const free = cursor.reduce((s, c) => s + c[1] - c[0], 0);
        errors.push({ kind: "menu", code: "no-room", text: bytesToUi(v), need, free });
        return null;
      }
      placed.set(k, iv[0]);
      iv[0] += need;
    }
    const clear = [];
    for (const [a, b] of pool) for (let i = a; i < b; i++) clear.push(i);
    notes.push({ clear });
    for (const [k, v] of contents) changes.push([placed.get(k), concat([v, Uint8Array.of(0)])]);
    for (const { idx, pos } of refs) {
      const nw = placed.get(key(full.get(pos))) - C.TEXT_BASE;
      changes.push([C.TABLE_OFF + 2 * idx, Uint8Array.of(nw & 0xff, nw >> 8)]);
    }
    const free = cursor.reduce((s, c) => s + c[1] - c[0], 0);
    return { distinct: contents.length, free };
  }

  function fixChecksum(rom) {
    rom.set([0x00, 0x00, 0xff, 0xff], C.CHECKSUM_OFF);
    let s = 0;
    for (let i = 0; i < rom.length; i++) s = (s + rom[i]) & 0xffff;
    const x = s ^ 0xffff;
    rom.set([x & 0xff, x >> 8, s & 0xff, s >> 8], C.CHECKSUM_OFF);
  }

  function applyChanges(rom, changes, notes) {
    const out = rom.slice();
    for (const n of notes) if (n.clear) for (const i of n.clear) out[i] = 0;
    for (const [off, raw] of changes) out.set(raw, off);
    fixChecksum(out);
    return out;
  }

  // Safety net: every table index must resolve to exactly the intended text.
  function verifyMenu(out, parsed, menuFull, edits, opts) {
    const refs = menuTable(out);
    if (refs.length !== parsed.refs.length) return { ok: false, reason: "table size changed" };
    const pad = opts && opts.pad === "space" ? 0x20 : 0x00;
    const want = new Map(parsed.menu.map((m) => {
      const e = edits.menu && edits.menu.get(m.off);
      if (!e) return [m.off, m.orig];
      if (pad === 0) return [m.off, e];   // NUL padding is invisible: the text ends at the first NUL
      const padded = new Uint8Array(m.orig.length).fill(pad);
      padded.set(e.slice(0, m.orig.length));
      return [m.off, padded];
    }));
    if (menuFull) for (const [o, v] of menuFull) want.set(o, v);
    for (let i = 0; i < refs.length; i++) {
      const p = refs[i].pos;
      const got = out.slice(p, out.indexOf(0, p));
      if (refs[i].idx !== parsed.refs[i].idx || !eqBytes(got, want.get(parsed.refs[i].pos)))
        return { ok: false, reason: "index " + refs[i].idx };
    }
    return { ok: true };
  }

  // --- patches (IPS / BPS) ---------------------------------------------------
  function* diffRuns(a, b) {
    let i = 0;
    const n = a.length;
    while (i < n) {
      if (a[i] === b[i]) { i++; continue; }
      let j = i;
      while (j < n && a[j] !== b[j]) j++;
      yield [i, j];
      i = j;
    }
  }

  function makeIps(src, dst) {
    if (src.length !== dst.length) throw new Error("IPS needs equal sizes");
    const regions = [];
    for (const [s, e] of diffRuns(src, dst)) {
      if (regions.length && s - regions[regions.length - 1][1] <= 5) regions[regions.length - 1][1] = e;
      else regions.push([s, e]);
    }
    const parts = [new TextEncoder().encode("PATCH")];
    for (let [s, e] of regions) {
      while (s < e) {
        if (s === 0x454f46) s--;
        const n = Math.min(e - s, 0xffff);
        parts.push(Uint8Array.of((s >> 16) & 0xff, (s >> 8) & 0xff, s & 0xff, n >> 8, n & 0xff), dst.slice(s, s + n));
        s += n;
      }
    }
    parts.push(new TextEncoder().encode("EOF"));
    return concat(parts);
  }

  function bpsNum(n) {
    const out = [];
    for (;;) {
      const x = n & 0x7f;
      n = Math.floor(n / 128);
      if (n === 0) { out.push(0x80 | x); return Uint8Array.from(out); }
      out.push(x);
      n -= 1;
    }
  }

  const le32 = (v) => Uint8Array.of(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff);

  function makeBps(src, dst) {
    const parts = [new TextEncoder().encode("BPS1"), bpsNum(src.length), bpsNum(dst.length), bpsNum(0)];
    let pos = 0;
    const n = dst.length;
    while (pos < n) {
      const same = pos < src.length && src[pos] === dst[pos];
      let end = pos;
      while (end < n && (end < src.length && src[end] === dst[end]) === same) end++;
      const len = end - pos;
      if (same) parts.push(bpsNum((len - 1) * 4));
      else parts.push(bpsNum((len - 1) * 4 + 1), dst.slice(pos, end));
      pos = end;
    }
    parts.push(le32(crc32(src)), le32(crc32(dst)));
    const body = concat(parts);
    return concat([body, le32(crc32(body))]);
  }

  function applyIps(src, patch) {
    if (key(patch.slice(0, 5)) !== "PATCH") throw new Error("Not an IPS patch");
    let out = src.slice();
    let i = 5;
    while (key(patch.slice(i, i + 3)) !== "EOF") {
      const off = (patch[i] << 16) | (patch[i + 1] << 8) | patch[i + 2];
      const size = (patch[i + 3] << 8) | patch[i + 4];
      i += 5;
      let data;
      if (size === 0) {
        const rle = (patch[i] << 8) | patch[i + 1];
        data = new Uint8Array(rle).fill(patch[i + 2]);
        i += 3;
      } else { data = patch.slice(i, i + size); i += size; }
      if (off + data.length > out.length) { const g = new Uint8Array(off + data.length); g.set(out); out = g; }
      out.set(data, off);
    }
    return out;
  }

  const readLe32 = (a, o) => (a[o] | (a[o + 1] << 8) | (a[o + 2] << 16) | (a[o + 3] << 24)) >>> 0;

  function applyBps(src, patch) {
    if (key(patch.slice(0, 4)) !== "BPS1") throw new Error("Not a BPS patch");
    if (crc32(patch.slice(0, -4)) !== readLe32(patch, patch.length - 4)) throw new Error("Patch is damaged");
    let pos = 4;
    const num = () => {
      let data = 0, shift = 1;
      for (;;) {
        const x = patch[pos++];
        data += (x & 0x7f) * shift;
        if (x & 0x80) return data;
        shift *= 128;
        data += shift;
      }
    };
    const srcSize = num(), dstSize = num(), meta = num();
    pos += meta;
    if (srcSize !== src.length || crc32(src) !== readLe32(patch, patch.length - 12))
      throw new Error("Wrong source ROM for this patch");
    const out = new Uint8Array(dstSize);
    let o = 0, srcRel = 0, dstRel = 0;
    const end = patch.length - 12;
    while (pos < end) {
      const v = num();
      const mode = v & 3, len = (v >> 2) + 1;
      if (mode === 0) { out.set(src.slice(o, o + len), o); o += len; }
      else if (mode === 1) { out.set(patch.slice(pos, pos + len), o); pos += len; o += len; }
      else {
        const d = num();
        const off = (d & 1 ? -1 : 1) * (d >> 1);
        if (mode === 2) { srcRel += off; out.set(src.slice(srcRel, srcRel + len), o); srcRel += len; o += len; }
        else { dstRel += off; for (let k = 0; k < len; k++) out[o++] = out[dstRel++]; }
      }
    }
    if (o !== dstSize || crc32(out) !== readLe32(patch, patch.length - 8)) throw new Error("Result checksum mismatch");
    return out;
  }

  return {
    C, LANGS, crc32, splitHeader, isExpected, bytesToUi, uiToBytes, menuTable, parseRom,
    buildChanges, applyChanges, verifyMenu, fixChecksum, makeIps, makeBps, applyIps, applyBps,
    diffRuns, hex, eqBytes,
  };
});
