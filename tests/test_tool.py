r"""Tests for kickoff3_text.py.

Tests that need a ROM are skipped unless KO3_ROM points to your own copy:

    set KO3_ROM=C:\path\to\Kick Off 3.sfc          (Windows cmd)
    export KO3_ROM="/path/to/Kick Off 3.sfc"       (Linux/macOS)
    python -m unittest discover tests
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import kickoff3_text as k  # noqa: E402

ROM = os.environ.get("KO3_ROM")


class Args:
    def __init__(self, **kw):
        self.__dict__.update({"pad": "nul", "repack": False, **kw})


def edit(path, old, new):
    with open(path, encoding="utf-8") as f:
        s = f.read()
    assert old in s, old
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(s.replace(old, new, 1))


@unittest.skipUnless(ROM and os.path.exists(ROM), "set KO3_ROM to your ROM to run")
class RomTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp, True)
        self.text = os.path.join(self.tmp, "texte")
        k.cmd_dump(Args(rom=ROM, outdir=self.text))
        with open(ROM, "rb") as f:
            self.orig = f.read()

    def insert(self, **kw):
        out = os.path.join(self.tmp, "out.sfc")
        k.cmd_insert(Args(rom=ROM, textdir=self.text, output=out, **kw))
        with open(out, "rb") as f:
            return f.read()

    def test_expected_rom(self):
        rom, _ = k.load_rom(ROM, quiet=True)
        self.assertTrue(k.is_expected_rom(rom))

    def test_unchanged_roundtrip_is_identical(self):
        self.assertEqual(self.insert(), self.orig)

    def test_inplace_edit(self):
        edit(os.path.join(self.text, "1_menus_de.txt"), "|DEUTSCHE|", "|DEUTSCH|")
        new = self.insert()
        changed = [i for i in range(len(new)) if new[i] != self.orig[i]]
        self.assertIn(0x66A78, changed)                  # 'E' -> NUL
        self.assertTrue(all(i == 0x66A78 or i == 0x66B7E or 0x7FDC <= i < 0x7FE0
                            for i in changed))

    def test_too_long_needs_repack(self):
        edit(os.path.join(self.text, "1_menus_shared.txt"), "|Samporia|", "|Sampdoria|")
        with self.assertRaises(SystemExit):
            self.insert()
        new = self.insert(repack=True)
        rom, _ = k.load_rom(ROM, quiet=True)
        newrom = bytearray(new)
        got = {pos: bytes(newrom[pos:newrom.index(0, pos)])
               for pos in {TEXT for _, TEXT in k.menu_table(newrom)}}
        self.assertIn(b"Sampdoria", got.values())
        self.assertNotIn(b"Samporia", got.values())

    def test_checksum_is_valid(self):
        edit(os.path.join(self.text, "3_player_names.txt"), "|E.Seeman|", "|D.Seaman|")
        new = self.insert()
        self.assertEqual(sum(new) & 0xFFFF, new[k.CHECKSUM_OFF + 2] | new[k.CHECKSUM_OFF + 3] << 8)

    def test_ingame_text_must_keep_length(self):
        edit(os.path.join(self.text, "2_ingame_de.txt"), "|    abseits    |", "|    abseits   |")
        with self.assertRaises(SystemExit):
            self.insert()

    def test_patch_roundtrip(self):
        edit(os.path.join(self.text, "1_menus_de.txt"), "|DEUTSCHE|", "|DEUTSCH|")
        fixed = os.path.join(self.tmp, "fixed.sfc")
        k.cmd_insert(Args(rom=ROM, textdir=self.text, output=fixed))
        with open(fixed, "rb") as f:
            want = f.read()
        for ext in ("bps", "ips"):
            patch = os.path.join(self.tmp, f"p.{ext}")
            k.cmd_patch(Args(rom=ROM, fixed=fixed, output=patch))
            out = os.path.join(self.tmp, f"from_{ext}.sfc")
            k.cmd_apply(Args(rom=ROM, patch=patch, output=out))
            with open(out, "rb") as f:
                self.assertEqual(f.read(), want, ext)


class UnitTests(unittest.TestCase):
    def test_escape_roundtrip(self):
        raw = bytes(range(1, 256))
        self.assertEqual(k.unesc(k.esc(raw)), raw)

    def test_bps_ips_without_rom(self):
        src = bytes(range(256)) * 40
        dst = bytearray(src)
        dst[10] ^= 0xFF
        dst[5000:5003] = b"abc"
        dst = bytes(dst)
        self.assertEqual(k.apply_bps(src, k.make_bps(src, dst)), dst)
        self.assertEqual(k.apply_ips(src, k.make_ips(src, dst)), dst)


if __name__ == "__main__":
    unittest.main()
