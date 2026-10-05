<div align="center">

# ⚽ Kick Off 3 – Text Tools

**Dump, fix and re-insert every text of the SNES classic *Kick Off 3: European Challenge* –
and finally correct those typos that bugged you as a kid.**

![Python](https://img.shields.io/badge/python-3.9%2B-3776AB?logo=python&logoColor=white)
![Dependencies](https://img.shields.io/badge/dependencies-none-success)
![Platform](https://img.shields.io/badge/ROM-SNES%20LoROM-8A2BE2)
![License](https://img.shields.io/badge/license-MIT-blue)

[Deutsch](README.de.md) · [Quick start](#-quick-start) · [Known typos](#-known-typos--help-wanted) · [ROM notes](docs/ROM_NOTES.md)

</div>

---

> *"DEUTSCHE" in the language menu, "Yuventus" instead of Juventus, "Assesment" in the
> team screen…* Every kid who played this game noticed. Now you can fix it in five minutes.

## ✨ Features

- 📤 **Dump** all game texts into plain text files – split **by language** (EN / FR / DE / IT / ES)
- ✏️ **Edit** them in any editor, one line per text, with the allowed length shown
- 📥 **Insert** them back into a *copy* of your ROM (the original is never touched)
- 🔓 **Longer texts?** `--repack` re-packs the text area and rewrites the game's index table
- 🩹 **Patch maker**: create `.bps` / `.ips` patches to share your fixes **without sharing the ROM**
- ✅ **Safe**: strict length checks, nothing is written on errors, SNES checksum is fixed automatically
- 🧪 Unit tests, no dependencies – just Python

## 🚀 Quick start

You need **Python 3.9+** and **your own ROM**: *Kick Off 3 - European Challenge (Europe) (En,Fr,De,Es,It)*.
(This repository does **not** contain any ROM. Please don't ask for one.)

```bash
# 0. Is it the right ROM? (CRC32 1AC7F523)
python kickoff3_text.py info "Kick Off 3.sfc"

# 1. Dump all texts into ./texte
python kickoff3_text.py dump "Kick Off 3.sfc" texte

# 2. Edit e.g. texte/1_menus_de.txt  (see "The text files" below)

# 3. Dry run – only checks that everything fits
python kickoff3_text.py verify "Kick Off 3.sfc" texte

# 4. Write the fixed ROM (a copy!)
python kickoff3_text.py insert "Kick Off 3.sfc" texte "Kick Off 3 - fixed.sfc"

# 5. Optional: make a shareable patch from your changes
python kickoff3_text.py patch "Kick Off 3.sfc" "Kick Off 3 - fixed.sfc" my-fixes.bps
```

Patches from step 5 can be applied by anyone with their own ROM – with this tool
(`python kickoff3_text.py apply ROM my-fixes.bps OUT.sfc`) or any BPS/IPS patcher
such as *Floating IPS* or *RomPatcher.js* (in the browser).

## 📝 The text files

`dump` creates one file per language and kind of text:

| File | Content | Rule |
|---|---|---|
| `1_menus_en/fr/de/it/es.txt` | menus and options per language | length ≤ `max` (longer with `--repack`) |
| `1_menus_shared.txt` | texts shared between languages (teams, countries, "Quit" …) | same |
| `2_ingame_en/fr/de/it/es.txt` | texts during the match ("offside", "penalty!" …), centered | length must stay **exactly** the same |
| `3_player_names.txt` | 2340 player names (language independent) | ≤ 12 characters, padded automatically |

Each line looks like this:

```text
066a71  max=8   |DEUTSCHE|
```

Change only the text between the bars. Fixing it is as simple as:

```text
066a71  max=8   |DEUTSCH|
```

- You can work on a single file (e.g. only `*_de.txt`); untouched lines stay as they are.
- Special characters are raw font bytes: write them as `\xNN` (e.g. `FRAN\x80AISE`).
  Observed for capitals (matches CP437): `\x80` = Ç, `\x8e` = Ä, `\x99` = Ö, `\x9a` = Ü.
- `\\` is a backslash, `\x7c` is a `|`.
- A second `dump` into the same folder overwrites your edits – copy them away first.

### `insert` options

| Option | Effect |
|---|---|
| `--pad nul` (default) | shorter menu texts are padded with zero bytes (works fine in-game) |
| `--pad space` | pad with spaces instead |
| `--repack` | **experimental** – menu texts may become longer. All texts are re-packed (identical texts share space) and the index table is rewritten. About 500 bytes of headroom. Please test in an emulator. |

## 🐛 Known typos – help wanted

Found so far in the European ROM (✅ = fixed in the tool's test setup, others are open):

| Where | Original | Should be | Needs |
|---|---|---|---|
| Language menu (DE) | `DEUTSCHE` | `DEUTSCH` | ✅ in place |
| Language list (DE) | `SPANISCHE` | `SPANISCH` | ✅ in place |
| Teams | `Bilbad` | `Bilbao` | in place |
| Teams | `Yuventus` | `Juventus` | in place |
| Teams | `Nurenberg` | `Nuremberg` / `Nürnberg` | in place (`Nuremberg`) |
| Teams | `Samporia` | `Sampdoria` | `--repack` (+1 char) |
| Team screen | `Assesment` | `Assessment` | `--repack` (+1 char) |
| Menu (IT) | `SPANGNOLO` | `SPAGNOLO` | in place |
| In-game (IT) | `esplulso` | `espulso` | in place |
| In-game (FR) | `hors jeus` | `hors jeu` (invariable) | in place |
| Teams | `Koln` | `Köln` | needs a font check (umlaut as raw byte) |

Found more? Open an issue or a pull request with the offsets from your dump.

## 🔧 How it works (short version)

The game stores its menu texts as plain ASCII in the ROM and addresses them through a
**16-bit index table** (`0x67378`) – five blocks of 320 entries, one per language.
In-game texts are fixed-width strings, player names are 12-character records.
That makes this ROM unusually friendly to edit. All details, offsets and the
reverse-engineering notes are in [docs/ROM_NOTES.md](docs/ROM_NOTES.md).

## 🧪 Tests

```bash
python -m unittest discover tests                 # unit tests only
KO3_ROM="Kick Off 3.sfc" python -m unittest discover tests   # full tests with your ROM
```

(PowerShell: `$env:KO3_ROM="Kick Off 3.sfc"`.)

## ⚖️ Legal

This project contains **only tools and documentation**, no ROM, no game text dumps and no
copyrighted game data. You need your own legally obtained copy of the game.
*Kick Off 3* is a trademark/copyright of its respective owners;
this is a fan project and not affiliated with them. Patches you create contain
only the differences to the original ROM.

## 🤝 Contributing

Ideas, typo reports, support for other regions/versions or other games are welcome.
Please never attach ROMs or full text dumps to issues or pull requests.

## 📄 License

[MIT](LICENSE) – for the tools and documentation in this repository.
