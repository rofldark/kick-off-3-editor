# ROM notes – Kick Off 3: European Challenge (Europe)

Technical notes for people who want to understand or extend the tool.
All offsets are **file offsets in the headerless ROM** (strip a 512-byte copier header first;
the tool does that automatically).

| | |
|---|---|
| ROM | *Kick Off 3 - European Challenge (Europe) (En,Fr,De,Es,It)* |
| Size | 1 048 576 bytes (8 Mbit) |
| Mapping | LoROM (header at `0x7FC0`, title `KICKOFF3`) |
| CRC32 | `1AC7F523` |
| SHA-1 | `7ab7898b0d00fa91e75365a060bd36ddba232f6a` |

SNES address of a file offset in LoROM: `((off >> 15) << 16) | 0x8000 | (off & 0x7FFF)`.

## Encoding

Plain ASCII, **null-terminated** strings. Special characters are raw byte values of the
game's own font. For capital letters the layout resembles CP437:

| Byte | Char |
|---|---|
| `0x80` | Ç |
| `0x8E` | Ä |
| `0x99` | Ö |
| `0x9A` | Ü |

Lowercase accented letters have not been checked (use an emulator tile viewer). The German
in-game texts avoid umlauts altogether (`ruckpass`, `schuesse`).

## Menu texts

- Text area: `0x65F3B` – `0x67378`, all five languages back to back.
- **Index table** at `0x67378`: 16-bit little-endian offsets, **relative to `0x65F3B`**.
  About 1600 entries in five sections of 320 (order: **en, fr, de, it, es**). Teams, countries
  and some option names are referenced from all sections, language-specific names only from
  their own. The table ends at the first run of three zero words (other data follows).
- No fixed pointers to the strings were found in the code; the game addresses them through
  this table (found with a difference search for consecutive string starts, not by tracing
  the code).
- Free space is scarce: around 500 bytes can be gained by sharing identical strings (this is what
  `--repack` does). There is no usable free area within 64 KiB of the text base.

## In-game texts

- `0xC2372` – `0xC3138`: strings of fixed width (15 characters, centered with spaces),
  null-terminated; 44 slots (`0x2C0` bytes) per language starting at `0xC2388`
  (en, fr, de, it, es). The first slot (`0xC2372`) has a few non-text bytes in front.
- Texts: on/off, foul, offside, injuries, free kick, statistics, tactics, formations, …

## Player names

- `0xF0001` – `0xF7FF9`: 2340 records of 14 bytes: **12 characters** (space padded) + **2 data bytes**.
- The names are deliberately altered versions of real players (licensing): `E.Seeman`,
  `A.Dicon`, `S.Winterbern` … Those are not typos.

## Header checksum

LoROM header at `0x7FC0`; complement at `0x7FDC`, checksum at `0x7FDE` (sum of all bytes,
16-bit). The tool recalculates both after every write. Emulators ignore them; flash carts or
the real console may not.

## Not covered (yet)

- Text rendered as graphics (tiles), password strings, anything compressed.
- Other regions or revisions of the game (the tool warns when the CRC32 differs).
- Which exact glyphs exist in the font for lowercase accents.

## How the table was found (for the curious)

1. `strings`-style scan: plain ASCII text around `0x66000` (`England`, `Germany`, `FRANCE`).
2. Searching for 16-bit values equal to the text addresses found nothing useful (hits were
   noise: in a 1 MB ROM every 16-bit value appears ~16 times).
3. Searching for *runs of words whose differences equal the differences between consecutive
   string starts* revealed the table directly behind the text area.
