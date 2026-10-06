# Changelog

Alle nennenswerten Änderungen an diesem Projekt. Format nach
[Keep a Changelog](https://keepachangelog.com/de/1.1.0/).

## [Unreleased]

### Added
- Web-App „Kick Off 3 Editor“ in `docs/` (HTML/CSS/JS ohne Build, für GitHub Pages): ROM im Browser laden,
  Texte bearbeiten, korrigierte ROM bzw. `.bps`/`.ips` speichern, Änderungen als JSON sichern/laden,
  Autosave im Browser, Oberfläche Deutsch/Englisch. Die ROM verlässt den Browser nie
  (CSP `connect-src 'none'`).
- `docs/core.js`: JavaScript-Portierung der Tool-Logik; `tests/core.test.js` vergleicht sie
  byte-genau mit dem Python-Tool (auch `--repack`)
- `kickoff3_text.py` mit den Befehlen `dump`, `insert`, `verify`, `patch`, `apply` und `info`
- Auslesen von Menütexten (688), Match-Texten (219) und Spielernamen (2340),
  nach Sprache getrennt (`1_menus_<sprache>.txt`, `1_menus_shared.txt`, `2_ingame_<sprache>.txt`,
  `3_player_names.txt`)
- Optionales `--repack`, damit Menütexte länger als im Original werden können
- Erzeugen und Anwenden von `.bps`- und `.ips`-Patches
- Prüfung der ROM per CRC32/SHA-1 (`info`, Warnung bei abweichender ROM)
- Automatische Korrektur der SNES-Prüfsumme
- Tests (`tests/`), `docs/ROM_NOTES.md`, englisches und deutsches README, MIT-Lizenz, `.gitignore`

### Changed
- Projekt umbenannt in „Kick Off 3 Editor“ (GitHub-Repo `kick-off-3-editor`) für bessere Auffindbarkeit
- Neues, eigenes Titelbild (inspiriert vom Spiel, keine Kopie) statt eines Spiel-Screenshots
- Für die Veröffentlichung vorbereitet: Ausgabe und Dateinamen auf Englisch, Textdumps
  (`texte/`) und ROMs sind per `.gitignore` ausgeschlossen
