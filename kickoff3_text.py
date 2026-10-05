#!/usr/bin/env python3
"""Text dumper / inserter / patch maker for Kick Off 3 - European Challenge (SNES, Europe).

Commands:
  dump   ROM OUTDIR                 extract all texts into editable .txt files
  verify ROM TEXTDIR [--repack]     check that the edited texts fit (writes nothing)
  insert ROM TEXTDIR OUT [--pad nul|space] [--repack]
                                    write the edited texts into a COPY of the ROM
  patch  ROM FIXED OUT.(bps|ips)    create a patch from an original and a fixed ROM
  apply  ROM PATCH OUT              apply a .bps/.ips patch
  info   ROM                        check that the ROM is the expected version

The original ROM is never modified. A 512-byte copier header is detected and
stripped automatically; all offsets below refer to the headerless ROM.
"""
import argparse
import glob
import hashlib
import os
import re
import struct
import sys
import zlib

# --- ROM layout (file offsets, headerless) -----------------------------------
EXPECTED_SIZE = 0x100000
EXPECTED_CRC32 = 0x1AC7F523     # Kick Off 3 - European Challenge (Europe) (En,Fr,De,Es,It)
EXPECTED_SHA1 = "7ab7898b0d00fa91e75365a060bd36ddba232f6a"

TABLE_OFF = 0x67378             # index table: 16-bit offsets to the menu texts
TABLE_WORDS = (0x67FFE - TABLE_OFF) >> 1
TEXT_BASE = 0x65F3B             # table offsets are relative to this
TEXT_END = TABLE_OFF            # menu text area ends right before the table
MATCH_START, MATCH_END = 0xC2372, 0xC3138   # in-game texts, fixed width
NAMES_START, NAMES_END = 0xF0001, 0xF7FF9   # player names: 12 chars + 2 data bytes
NAME_LEN, NAME_STRIDE = 12, 14
CHECKSUM_OFF = 0x7FDC           # LoROM header: complement (2) + checksum (2)

LANGS = ("en", "fr", "de", "it", "es")      # order of the language blocks
LANG_NAMES = {"en": "English", "fr": "French", "de": "German",
              "it": "Italian", "es": "Spanish"}
MENU_SECTION = 320              # table entries per language
MATCH_LANG_START, MATCH_LANG_SIZE = 0xC2388, 0x2C0   # 5 blocks of 44 slots
PATTERNS = {
    "menu": "1_menus*.txt",
    "match": "2_ingame*.txt",
    "names": "3_player_names*.txt",
}
LINE_RE = re.compile(r"^([0-9a-fA-F]{6})\s+max=(\d+)\s+\|(.*)\|\s*$")


# --- helpers -----------------------------------------------------------------
def load_rom(path, quiet=False):
    """Return (headerless ROM as bytearray, copier header bytes)."""
    with open(path, "rb") as f:
        data = bytearray(f.read())
    hdr = len(data) % 1024
    if hdr == 512:
        if not quiet:
            print("Note: 512-byte copier header detected and skipped.")
        header, data = bytes(data[:512]), data[512:]
    elif hdr == 0:
        header = b""
    else:
        sys.exit(f"Unexpected file size: {len(data)} bytes")
    if not quiet and not is_expected_rom(data):
        print("WARNING: this is not the expected ROM (Europe, CRC32 "
              f"{EXPECTED_CRC32:08X}). Offsets may be wrong - run 'info' for details.")
    return data, header


def is_expected_rom(rom):
    return len(rom) == EXPECTED_SIZE and zlib.crc32(bytes(rom)) == EXPECTED_CRC32


def esc(raw):
    out = []
    for b in raw:
        c = chr(b)
        if c == "\\":
            out.append("\\\\")
        elif 0x20 <= b <= 0x7E and c != "|":
            out.append(c)
        else:
            out.append(f"\\x{b:02x}")
    return "".join(out)


def unesc(text):
    out = bytearray()
    i = 0
    while i < len(text):
        c = text[i]
        if c == "\\":
            if text[i + 1:i + 2] == "\\":
                out.append(0x5C)
                i += 2
                continue
            m = re.match(r"x([0-9a-fA-F]{2})", text[i + 1:i + 4])
            if not m:
                raise ValueError(f"invalid escape sequence near: {text[i:i+6]!r}")
            out.append(int(m.group(1), 16))
            i += 4
            continue
        if ord(c) > 0x7E:
            raise ValueError(
                f"character {c!r} is not ASCII. The game font uses raw byte values "
                f"for special characters -> write it as \\xNN.")
        out.append(ord(c))
        i += 1
    return bytes(out)


def parse_file(path):
    """Return {offset: (max, bytes)}; validates every line."""
    items = {}
    with open(path, encoding="utf-8") as f:
        lines = f.read().splitlines()
    for n, line in enumerate(lines, 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        m = LINE_RE.match(line)
        if not m:
            sys.exit(f"{os.path.basename(path)}:{n}: cannot parse line: {line!r}")
        try:
            items[int(m.group(1), 16)] = (int(m.group(2)), unesc(m.group(3)))
        except ValueError as e:
            sys.exit(f"{os.path.basename(path)}:{n}: {e}")
    return items


def write_items(path, header, items, stride=None):
    lines = [f"# {h}" for h in header] + [""]
    prev_end = None
    for off, mx, raw in items:
        if prev_end is not None and off != prev_end:
            lines.append("")
        lines.append(f"{off:06x}  max={mx:<3} |{esc(raw)}|")
        prev_end = off + (stride or mx + 1)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


# --- reading the ROM ---------------------------------------------------------
def menu_table(rom):
    """List of (table index, offset) for all valid table entries.

    The table ends at the first run of three zero words (other data follows).
    """
    refs = []
    for i in range(TABLE_WORDS):
        words = [rom[TABLE_OFF + 2 * j] | rom[TABLE_OFF + 2 * j + 1] << 8
                 for j in range(i, i + 3)]
        if i > 100 and words == [0, 0, 0]:
            break
        pos = TEXT_BASE + words[0]
        if TEXT_BASE <= pos < TEXT_END and (pos == TEXT_BASE or rom[pos - 1] == 0):
            refs.append((i, pos))
    return refs


def menu_items(rom):
    items = {}
    for _, pos in menu_table(rom):
        if pos not in items:
            items[pos] = bytes(rom[pos:rom.index(0, pos)])
    return sorted(items.items())


def menu_langs(rom):
    """{offset: set of language indices that reference the text}."""
    langs = {}
    for idx, pos in menu_table(rom):
        langs.setdefault(pos, set()).add(min(idx // MENU_SECTION, len(LANGS) - 1))
    return langs


def match_items(rom):
    out, pos = [], MATCH_START
    while pos < MATCH_END:
        end = rom.index(0, pos)
        s = bytes(rom[pos:end])
        if len(s) in (15, 21) and all(0x20 <= b < 0x7F for b in s):
            out.append((pos, len(s), s))
        pos = end + 1
    return out


def name_items(rom):
    return [(o, NAME_LEN, bytes(rom[o:o + NAME_LEN]).rstrip(b" "))
            for o in range(NAMES_START, NAMES_END, NAME_STRIDE)]


# --- dump --------------------------------------------------------------------
def cmd_dump(args):
    rom, _ = load_rom(args.rom)
    os.makedirs(args.outdir, exist_ok=True)
    common = [
        "Format: <offset>  max=<allowed length> |text|",
        "Only change the text between the vertical bars, never the offset or max.",
        r"Special bytes as \xNN (e.g. \x80), backslash as \\ and | as \x7c.",
    ]
    for pat in PATTERNS.values():       # remove stale files so nothing is loaded twice
        for old in glob.glob(os.path.join(args.outdir, pat)):
            os.remove(old)

    langs = menu_langs(rom)
    groups = {code: [] for code in LANGS}
    groups["shared"] = []
    mi = menu_items(rom)
    for o, sbytes in mi:
        used = langs[o]
        key = LANGS[next(iter(used))] if len(used) == 1 else "shared"
        groups[key].append((o, len(sbytes), sbytes))
    for key, items in groups.items():
        title = ("Menu texts shared by several languages (teams, countries, 'Quit', ...)"
                 if key == "shared" else f"Menu texts - {LANG_NAMES[key]}")
        write_items(
            os.path.join(args.outdir, f"1_menus_{key}.txt"),
            [title] + common
            + ["New text may not be longer than max (unless you use insert --repack)."],
            items)

    mt = match_items(rom)
    for n, code in enumerate(LANGS):
        lo = MATCH_LANG_START + n * MATCH_LANG_SIZE
        write_items(
            os.path.join(args.outdir, f"2_ingame_{code}.txt"),
            [f"In-game texts - {LANG_NAMES[code]} (centered, fixed width)"] + common
            + ["The length must stay exactly the same (count the spaces)."],
            [t for t in mt if lo <= t[0] < lo + MATCH_LANG_SIZE])

    write_items(
        os.path.join(args.outdir, "3_player_names.txt"),
        ["Player names (fixed width 12, padded with spaces on the right)"] + common
        + ["Shorter names are padded automatically."],
        name_items(rom), stride=NAME_STRIDE)
    print(f"{len(mi)} menu texts, {len(mt)} in-game texts, "
          f"{len(name_items(rom))} player names -> {args.outdir}")


# --- insert ------------------------------------------------------------------
def build_changes(rom, textdir, pad, repack):
    changes = {}        # offset -> bytes to write there
    errors, notes = [], []

    def load(key):
        merged = {}
        for p in sorted(glob.glob(os.path.join(textdir, PATTERNS[key]))):
            for off, val in parse_file(p).items():
                if off in merged:
                    errors.append(f"{key}: offset {off:06x} appears in several files "
                                  f"(last in {os.path.basename(p)})")
                merged[off] = val
        return merged

    # menus
    orig = dict(menu_items(rom))
    edited = {}
    for off, (_, raw) in load("menu").items():
        if off not in orig:
            errors.append(f"menu: offset {off:06x} is unknown (line removed or changed?)")
        elif raw != orig[off]:
            if 0 in raw:
                errors.append(f"menu {off:06x}: text contains a 00 byte")
            edited[off] = raw
    too_long = {o: r for o, r in edited.items() if len(r) > len(orig[o])}
    if too_long and not repack:
        for o, r in too_long.items():
            errors.append(f"menu {o:06x}: {len(r)} characters, allowed {len(orig[o])} "
                          f"({esc(orig[o])} -> {esc(r)}). Shorten it or use --repack.")
    if too_long and repack:
        full = {o: edited.get(o, s) for o, s in orig.items()}
        repack_menu(rom, full, changes, errors, notes)
    elif not too_long:
        padb = b"\x00" if pad == "nul" else b" "
        for o, r in edited.items():
            changes[o] = r + padb * (len(orig[o]) - len(r))

    # in-game texts (strictly the same length)
    for off, (mx, raw) in load("match").items():
        if raw == bytes(rom[off:off + mx]):
            continue
        if len(raw) != mx:
            errors.append(f"in-game {off:06x}: length {len(raw)}, must be exactly {mx}")
        else:
            changes[off] = raw

    # player names
    for off, (_, raw) in load("names").items():
        if raw == bytes(rom[off:off + NAME_LEN]).rstrip(b" "):
            continue
        if len(raw) > NAME_LEN:
            errors.append(f"names {off:06x}: {len(raw)} characters, max. {NAME_LEN}")
        else:
            changes[off] = raw.ljust(NAME_LEN, b" ")
    return changes, errors, notes


def repack_menu(rom, full, changes, errors, notes):
    """Repack all menu texts (identical texts share space) and rewrite the table."""
    refs = menu_table(rom)
    slots = sorted((o, len(rom[o:rom.index(0, o)]) + 1) for o in {p for _, p in refs})
    pool = []                       # free space = union of all referenced slots
    for o, n in slots:
        if pool and pool[-1][1] == o:
            pool[-1][1] = o + n
        else:
            pool.append([o, o + n])
    contents = sorted({bytes(v) for v in full.values()}, key=lambda b: (-len(b), b))
    placed, cursor = {}, [list(iv) for iv in pool]
    for c in contents:
        need = len(c) + 1
        for iv in cursor:
            if iv[1] - iv[0] >= need:
                placed[c] = iv[0]
                iv[0] += need
                break
        else:
            free = sum(iv[1] - iv[0] for iv in cursor)
            errors.append(f"menu --repack: no room left for {esc(c)!r} "
                          f"({need} bytes, {free} free). Shorten some texts.")
            return
    for c, o in placed.items():
        changes[o] = c + b"\x00"
    notes.append(("clear", [i for a, b in pool for i in range(a, b)]))
    for idx, pos in refs:
        new = placed[bytes(full[pos])] - TEXT_BASE
        changes[TABLE_OFF + 2 * idx] = bytes((new & 0xFF, new >> 8))
    free = sum(iv[1] - iv[0] for iv in cursor)
    print(f"--repack: {len(contents)} distinct texts, {free} bytes free.")


def fix_checksum(rom):
    rom[CHECKSUM_OFF:CHECKSUM_OFF + 4] = b"\x00\x00\xff\xff"
    s = sum(rom) & 0xFFFF
    rom[CHECKSUM_OFF:CHECKSUM_OFF + 4] = bytes(
        ((s ^ 0xFFFF) & 0xFF, (s ^ 0xFFFF) >> 8, s & 0xFF, s >> 8))


def apply_changes(rom, changes, notes):
    out = bytearray(rom)
    for n in notes:
        if isinstance(n, tuple) and n[0] == "clear":
            for i in n[1]:
                out[i] = 0
    for off, raw in changes.items():
        out[off:off + len(raw)] = raw
    fix_checksum(out)
    return out


def cmd_insert(args, write=True):
    rom, hdr = load_rom(args.rom)
    changes, errors, notes = build_changes(
        rom, args.textdir, getattr(args, "pad", "nul"), getattr(args, "repack", False))
    if errors:
        print("ERRORS - nothing written:")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    texts = [o for o in changes if not TABLE_OFF <= o < TABLE_OFF + 2 * TABLE_WORDS]
    print(f"{len(texts)} places changed.")
    if not write:
        print("Everything fits (check only, nothing written).")
        return
    if os.path.abspath(args.output) == os.path.abspath(args.rom):
        sys.exit("The output file must not be the original ROM.")
    out = apply_changes(rom, changes, notes)
    with open(args.output, "wb") as f:
        f.write(hdr + bytes(out))
    print(f"Written: {args.output} (checksum updated)")


# --- patches (IPS / BPS) -----------------------------------------------------
def diff_runs(a, b):
    """Yield (start, end) of differing regions (a and b have the same length)."""
    i, n = 0, len(a)
    while i < n:
        if a[i] == b[i]:
            i += 1
            continue
        j = i
        while j < n and a[j] != b[j]:
            j += 1
        yield i, j
        i = j


def make_ips(src, dst):
    if len(src) != len(dst):
        sys.exit("IPS export needs two ROMs of the same size.")
    regions = []
    for s, e in diff_runs(src, dst):
        if regions and s - regions[-1][1] <= 5:       # merge close regions
            regions[-1][1] = e
        else:
            regions.append([s, e])
    out = bytearray(b"PATCH")
    for s, e in regions:
        while s < e:
            if s == 0x454F46:                          # would be mistaken for "EOF"
                s -= 1
            n = min(e - s, 0xFFFF)
            out += struct.pack(">I", s)[1:] + struct.pack(">H", n) + bytes(dst[s:s + n])
            s += n
    return bytes(out + b"EOF")


def bps_num(n):
    out = bytearray()
    while True:
        x = n & 0x7F
        n >>= 7
        if n == 0:
            out.append(0x80 | x)
            return bytes(out)
        out.append(x)
        n -= 1


def make_bps(src, dst):
    out = bytearray(b"BPS1")
    out += bps_num(len(src)) + bps_num(len(dst)) + bps_num(0)
    pos, n = 0, len(dst)
    while pos < n:
        same = pos < len(src) and src[pos] == dst[pos]
        end = pos
        while end < n and (end < len(src) and src[end] == dst[end]) == same:
            end += 1
        length = end - pos
        if same:
            out += bps_num(((length - 1) << 2) | 0)                         # SourceRead
        else:
            out += bps_num(((length - 1) << 2) | 1) + bytes(dst[pos:end])   # TargetRead
        pos = end
    out += struct.pack("<I", zlib.crc32(bytes(src)))
    out += struct.pack("<I", zlib.crc32(bytes(dst)))
    out += struct.pack("<I", zlib.crc32(bytes(out)))
    return bytes(out)


def apply_ips(src, patch):
    if patch[:5] != b"PATCH":
        sys.exit("Not an IPS patch.")
    out, i = bytearray(src), 5
    while patch[i:i + 3] != b"EOF":
        off = int.from_bytes(patch[i:i + 3], "big")
        size = int.from_bytes(patch[i + 3:i + 5], "big")
        i += 5
        if size == 0:                                          # RLE record
            rle = int.from_bytes(patch[i:i + 2], "big")
            data = patch[i + 2:i + 3] * rle
            i += 3
        else:
            data = patch[i:i + size]
            i += size
        if off + len(data) > len(out):
            out.extend(b"\x00" * (off + len(data) - len(out)))
        out[off:off + len(data)] = data
    return bytes(out)


def apply_bps(src, patch):
    if patch[:4] != b"BPS1":
        sys.exit("Not a BPS patch.")
    if zlib.crc32(patch[:-4]) != struct.unpack("<I", patch[-4:])[0]:
        sys.exit("Patch is damaged (checksum mismatch).")
    pos = 4

    def num():
        nonlocal pos
        data, shift = 0, 1
        while True:
            x = patch[pos]
            pos += 1
            data += (x & 0x7F) * shift
            if x & 0x80:
                return data
            shift <<= 7
            data += shift

    src_size, dst_size, meta = num(), num(), num()
    pos += meta
    if src_size != len(src) or zlib.crc32(src) != struct.unpack("<I", patch[-12:-8])[0]:
        sys.exit("Wrong source ROM for this patch (size or CRC32 differs).")
    out, end = bytearray(), len(patch) - 12
    src_rel = dst_rel = 0
    while pos < end:
        v = num()
        mode, length = v & 3, (v >> 2) + 1
        if mode == 0:
            out += src[len(out):len(out) + length]
        elif mode == 1:
            out += patch[pos:pos + length]
            pos += length
        else:
            d = num()
            off = (-1 if d & 1 else 1) * (d >> 1)
            if mode == 2:
                src_rel += off
                out += src[src_rel:src_rel + length]
                src_rel += length
            else:
                dst_rel += off
                for _ in range(length):
                    out.append(out[dst_rel])
                    dst_rel += 1
    if len(out) != dst_size or zlib.crc32(bytes(out)) != struct.unpack("<I", patch[-8:-4])[0]:
        sys.exit("Result does not match the patch checksum.")
    return bytes(out)


def cmd_patch(args):
    src, _ = load_rom(args.rom)
    dst, _ = load_rom(args.fixed, quiet=True)
    if args.output.lower().endswith(".ips"):
        data = make_ips(src, dst)
    elif args.output.lower().endswith(".bps"):
        data = make_bps(src, dst)
    else:
        sys.exit("Output file must end in .bps or .ips")
    with open(args.output, "wb") as f:
        f.write(data)
    changed = sum(e - s for s, e in diff_runs(src, dst)) if len(src) == len(dst) else "?"
    print(f"Patch written: {args.output} ({len(data)} bytes, {changed} bytes differ)")
    print(f"Patch is relative to the headerless ROM (CRC32 {zlib.crc32(bytes(src)):08X}).")


def cmd_apply(args):
    src, hdr = load_rom(args.rom)
    with open(args.patch, "rb") as f:
        patch = f.read()
    out = apply_ips(bytes(src), patch) if patch[:5] == b"PATCH" else apply_bps(bytes(src), patch)
    if os.path.abspath(args.output) == os.path.abspath(args.rom):
        sys.exit("The output file must not be the original ROM.")
    with open(args.output, "wb") as f:
        f.write(hdr + out)
    print(f"Written: {args.output}")


def cmd_info(args):
    rom, hdr = load_rom(args.rom, quiet=True)
    crc, sha1 = zlib.crc32(bytes(rom)), hashlib.sha1(bytes(rom)).hexdigest()
    print(f"File size : {len(rom) + len(hdr)} bytes"
          + (" (incl. 512-byte copier header)" if hdr else ""))
    print(f"CRC32     : {crc:08X}   expected {EXPECTED_CRC32:08X}")
    print(f"SHA-1     : {sha1}")
    print(f"            {EXPECTED_SHA1} (expected)")
    ok = is_expected_rom(rom) and sha1 == EXPECTED_SHA1
    print("Result    :", "OK - this is the expected ROM." if ok else
          "DIFFERENT ROM - the offsets in this tool will probably not match.")
    sys.exit(0 if ok else 1)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawTextHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dump")
    d.add_argument("rom")
    d.add_argument("outdir")
    i = sub.add_parser("insert")
    i.add_argument("rom")
    i.add_argument("textdir")
    i.add_argument("output")
    i.add_argument("--pad", choices=("nul", "space"), default="nul")
    i.add_argument("--repack", action="store_true")
    v = sub.add_parser("verify")
    v.add_argument("rom")
    v.add_argument("textdir")
    v.add_argument("--repack", action="store_true")
    p = sub.add_parser("patch")
    p.add_argument("rom")
    p.add_argument("fixed")
    p.add_argument("output")
    a_ = sub.add_parser("apply")
    a_.add_argument("rom")
    a_.add_argument("patch")
    a_.add_argument("output")
    n = sub.add_parser("info")
    n.add_argument("rom")
    a = ap.parse_args()
    if a.cmd == "dump":
        cmd_dump(a)
    elif a.cmd == "insert":
        cmd_insert(a)
    elif a.cmd == "verify":
        a.pad = "nul"
        cmd_insert(a, write=False)
    elif a.cmd == "patch":
        cmd_patch(a)
    elif a.cmd == "apply":
        cmd_apply(a)
    else:
        cmd_info(a)


if __name__ == "__main__":
    main()
