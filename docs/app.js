/* Kick Off 3 Text Studio - user interface. All work happens locally in this page. */
(() => {
  "use strict";
  const K = window.KO3;
  const $ = (id) => document.getElementById(id);
  const PAGE = 100;

  // --- texts -----------------------------------------------------------------
  const I18N = {
    en: {
      privacy: "Your ROM stays in your browser.",
      heroTitle: "Edit the texts of Kick Off 3",
      heroLead: "Load your own ROM, fix typos or translate menus, and save the changed ROM or a patch. Everything runs in your browser, nothing is uploaded.",
      dropTitle: "Drop your ROM here",
      dropOr: "or click to choose a file",
      dropHint: "Kick Off 3 - European Challenge (Europe) · .sfc / .smc",
      tabMenu: "Menus", tabMatch: "In-game", tabNames: "Player names",
      lShared: "shared", search: "Search offset or text…", onlyChanged: "Only changed",
      specials: "Special letters:",
      optSummary: "Options", optRepack: "Allow longer menu texts (--repack, experimental)",
      optRepackHelp: "Re-packs all menu texts (identical texts share space) and rewrites the game's index table. About 500 bytes of headroom. Please test the result in an emulator.",
      optPad: "Pad shorter menu texts with ", padNul: "zero bytes (default)", padSpace: "spaces",
      dlRom: "Download ROM", dlBps: "Patch (.bps)", dlIps: "Patch (.ips)",
      exportBtn: "Save edits…", importBtn: "Load edits…", resetBtn: "Reset all",
      resetConfirm: "Discard all {n} edits?",
      changes: "{n} changed", errorsN: "{n} problems",
      colOff: "Offset", colOrig: "Original", colNew: "New text", colLen: "Length",
      empty: "Nothing to show.", prev: "‹ Prev", next: "Next ›", rows: "{a}–{b} of {c}",
      romOk: "expected ROM ✓", romBad: "different ROM ✗",
      bannerWrong: "This is not the expected ROM (Europe, CRC32 1AC7F523). The offsets are probably wrong. Edit at your own risk and check the result carefully.",
      bannerHeader: "A 512-byte copier header was found. It is kept in the saved ROM; patches are relative to the headerless ROM.",
      loadFailed: "This file does not look like Kick Off 3 (could not find the text tables).",
      tooBig: "That file is too large for a SNES ROM of this game.",
      hLen: "max {max}", hExact: "exactly {max}", hNames: "max {max}",
      btnCenter: "Center", btnReset: "Undo", center: "Center the text in the available width", reset: "Undo changes to this line",
      eBadChar: "“{c}” can not be shown by the game font. Use \\xNN for raw bytes. Known capitals: Ä Ö Ü Ç.",
      eBadEsc: "Invalid escape near “{c}”. Use \\xNN (two hex digits) or \\\\ for a backslash.",
      eTooLong: "{len} characters, only {max} fit. Shorten it or enable longer menu texts in the options.",
      eExact: "{len} characters, must be exactly {max} (count the spaces or use “Center”).",
      eNames: "{len} characters, max {max}.",
      wNeedRepack: "{len} characters, original {max}. Will be re-packed (experimental).",
      eNoRoom: "No room left for “{text}” ({need} bytes needed, {free} free). Shorten some texts.",
      eNul: "Text contains a zero byte.",
      eUnknown: "Unknown entry.",
      errorsTitle: "The ROM was not built:",
      jump: "show",
      toastBuilt: "Done: {n} places changed, checksum fixed, verification passed.",
      toastPatch: "Patch created ({size} bytes).",
      toastNoChange: "No changes yet. Edit some texts first.",
      toastRestored: "Restored {n} edits from your last session.",
      toastImported: "Imported {n} edits.",
      toastImportBad: "That file does not belong to this ROM or is not an edits file.",
      toastVerify: "Safety check failed ({why}). Nothing was saved.",
      footLegal: "Fan tool, not affiliated with the owners of Kick Off 3. No ROM or game data is included, bring your own copy. Nothing you load leaves this page.",
    },
    de: {
      privacy: "Deine ROM bleibt in deinem Browser.",
      heroTitle: "Texte von Kick Off 3 bearbeiten",
      heroLead: "Lade deine eigene ROM, behebe Tippfehler oder übersetze Menüs und speichere die geänderte ROM oder einen Patch. Alles läuft im Browser, nichts wird hochgeladen.",
      dropTitle: "ROM hier ablegen",
      dropOr: "oder klicken, um eine Datei zu wählen",
      dropHint: "Kick Off 3 - European Challenge (Europe) · .sfc / .smc",
      tabMenu: "Menüs", tabMatch: "Im Spiel", tabNames: "Spielernamen",
      lShared: "gemeinsam", search: "Offset oder Text suchen…", onlyChanged: "Nur geänderte",
      specials: "Sonderbuchstaben:",
      optSummary: "Optionen", optRepack: "Längere Menütexte erlauben (--repack, experimentell)",
      optRepackHelp: "Packt alle Menütexte neu (gleiche Texte teilen sich Platz) und schreibt die Index-Tabelle des Spiels um. Etwa 500 Byte Reserve. Bitte das Ergebnis im Emulator testen.",
      optPad: "Kürzere Menütexte auffüllen mit ", padNul: "Nullbytes (Standard)", padSpace: "Leerzeichen",
      dlRom: "ROM herunterladen", dlBps: "Patch (.bps)", dlIps: "Patch (.ips)",
      exportBtn: "Änderungen sichern…", importBtn: "Änderungen laden…", resetBtn: "Alles zurücksetzen",
      resetConfirm: "Alle {n} Änderungen verwerfen?",
      changes: "{n} geändert", errorsN: "{n} Probleme",
      colOff: "Offset", colOrig: "Original", colNew: "Neuer Text", colLen: "Länge",
      empty: "Nichts anzuzeigen.", prev: "‹ Zurück", next: "Weiter ›", rows: "{a}–{b} von {c}",
      romOk: "erwartete ROM ✓", romBad: "andere ROM ✗",
      bannerWrong: "Das ist nicht die erwartete ROM (Europe, CRC32 1AC7F523). Die Offsets stimmen vermutlich nicht. Änderungen auf eigene Gefahr und das Ergebnis genau prüfen.",
      bannerHeader: "Es wurde ein 512-Byte-Copier-Header gefunden. Er bleibt in der gespeicherten ROM erhalten; Patches beziehen sich auf die ROM ohne Header.",
      loadFailed: "Diese Datei sieht nicht nach Kick Off 3 aus (Texttabellen nicht gefunden).",
      tooBig: "Die Datei ist für eine SNES-ROM dieses Spiels zu groß.",
      hLen: "max. {max}", hExact: "genau {max}", hNames: "max. {max}",
      btnCenter: "Zentrieren", btnReset: "Zurück", center: "Text in der verfügbaren Breite zentrieren", reset: "Änderung an dieser Zeile rückgängig machen",
      eBadChar: "„{c}“ kann der Spielfont nicht darstellen. Rohbytes als \\xNN schreiben. Bekannte Großbuchstaben: Ä Ö Ü Ç.",
      eBadEsc: "Ungültige Escape-Folge bei „{c}“. \\xNN (zwei Hex-Ziffern) oder \\\\ für einen Backslash verwenden.",
      eTooLong: "{len} Zeichen, es passen nur {max}. Kürzen oder in den Optionen längere Menütexte erlauben.",
      eExact: "{len} Zeichen, es müssen genau {max} sein (Leerzeichen mitzählen oder „Zentrieren“ verwenden).",
      eNames: "{len} Zeichen, max. {max}.",
      wNeedRepack: "{len} Zeichen, Original {max}. Wird neu gepackt (experimentell).",
      eNoRoom: "Kein Platz mehr für „{text}“ ({need} Byte nötig, {free} frei). Texte kürzen.",
      eNul: "Der Text enthält ein Nullbyte.",
      eUnknown: "Unbekannter Eintrag.",
      errorsTitle: "Die ROM wurde nicht gebaut:",
      jump: "anzeigen",
      toastBuilt: "Fertig: {n} Stellen geändert, Prüfsumme korrigiert, Kontrolle bestanden.",
      toastPatch: "Patch erstellt ({size} Byte).",
      toastNoChange: "Noch keine Änderungen. Bearbeite zuerst ein paar Texte.",
      toastRestored: "{n} Änderungen aus der letzten Sitzung wiederhergestellt.",
      toastImported: "{n} Änderungen geladen.",
      toastImportBad: "Die Datei gehört nicht zu dieser ROM oder ist keine Änderungsdatei.",
      toastVerify: "Sicherheitsprüfung fehlgeschlagen ({why}). Es wurde nichts gespeichert.",
      footLegal: "Fan-Tool ohne Verbindung zu den Rechteinhabern von Kick Off 3. Es sind keine ROM und keine Spieldaten enthalten, bring deine eigene Kopie mit. Nichts, was du lädst, verlässt diese Seite.",
    },
  };
  const LANG_LABEL = { en: "EN", fr: "FR", de: "DE", it: "IT", es: "ES", shared: "★" };
  let ui = (navigator.language || "en").toLowerCase().startsWith("de") ? "de" : "en";
  try { ui = localStorage.getItem("ko3.ui") || ui; } catch (e) { /* storage blocked */ }
  const t = (k, v) => String(I18N[ui][k]).replace(/\{(\w+)\}/g, (_, n) => (v && n in v ? v[n] : ""));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // --- state -----------------------------------------------------------------
  const S = {
    name: "", header: null, rom: null, parsed: null, crc: 0, sha1: "",
    items: { menu: [], match: [], names: [] }, byId: new Map(),
    tab: "menu", lang: { menu: "en", match: "en" }, search: "", onlyChanged: false, page: 0,
    opts: { repack: false, pad: "nul" }, lastInput: null, visible: [],
  };

  // --- static texts ------------------------------------------------------------
  function applyTexts() {
    document.documentElement.lang = ui;
    $("langBtn").textContent = ui === "de" ? "EN" : "DE";
    $("privacyChip").textContent = t("privacy");
    $("heroTitle").innerHTML = t("heroTitle");
    $("heroLead").textContent = t("heroLead");
    $("dropTitle").textContent = t("dropTitle");
    $("dropOr").textContent = t("dropOr");
    $("dropHint").textContent = t("dropHint");
    $("search").placeholder = t("search");
    $("onlyChangedLabel").textContent = t("onlyChanged");
    $("optSummary").textContent = t("optSummary");
    $("optRepackLabel").textContent = t("optRepack");
    $("optRepackHelp").textContent = t("optRepackHelp");
    $("optPadLabel").textContent = t("optPad");
    $("optPad").options[0].textContent = t("padNul");
    $("optPad").options[1].textContent = t("padSpace");
    $("dlRom").textContent = t("dlRom");
    $("dlBps").textContent = t("dlBps");
    $("dlIps").textContent = t("dlIps");
    $("exportBtn").textContent = t("exportBtn");
    $("importBtn").textContent = t("importBtn");
    $("resetBtn").textContent = t("resetBtn");
    $("footLegal").textContent = t("footLegal");
    if (S.rom) { renderTabs(); renderChips(); renderSpecials(); renderInfo(); render(); }
  }

  // --- item helpers ------------------------------------------------------------
  const changed = (it) => it.text !== it.ui;
  const allItems = () => [...S.items.menu, ...S.items.match, ...S.items.names];

  function check(it) {
    if (!changed(it)) return { bytes: it.orig };
    let bytes;
    try { bytes = K.uiToBytes(it.text); }
    catch (e) {
      const [code, c] = String(e.message).split(/:(.*)/s);
      return { err: t(code === "bad-escape" ? "eBadEsc" : "eBadChar", { c }) };
    }
    const len = bytes.length;
    if (it.kind === "menu" && len > it.max)
      return S.opts.repack ? { bytes, warn: t("wNeedRepack", { len, max: it.max }) }
                           : { bytes, err: t("eTooLong", { len, max: it.max }) };
    if (it.kind === "match" && len !== it.max) return { bytes, err: t("eExact", { len, max: it.max }) };
    if (it.kind === "names" && len > it.max) return { bytes, err: t("eNames", { len, max: it.max }) };
    return { bytes };
  }

  function hint(it) {
    return it.kind === "match" ? t("hExact", { max: it.max }) : t(it.kind === "names" ? "hNames" : "hLen", { max: it.max });
  }

  // --- rendering ---------------------------------------------------------------
  function renderTabs() {
    const tabs = [["menu", "tabMenu"], ["match", "tabMatch"], ["names", "tabNames"]];
    $("tabs").innerHTML = tabs.map(([id, k]) =>
      `<button class="tab" role="tab" type="button" data-tab="${id}" aria-selected="${S.tab === id}">${esc(t(k))} <small>${S.items[id].length}</small></button>`).join("");
  }

  function renderChips() {
    const box = $("langChips");
    if (S.tab === "names") { box.innerHTML = ""; return; }
    const list = S.tab === "menu" ? [...K.LANGS, "shared"] : K.LANGS;
    box.innerHTML = list.map((l) =>
      `<button class="lchip" type="button" data-lang="${l}" aria-pressed="${S.lang[S.tab] === l}">${l === "shared" ? esc(t("lShared")) : LANG_LABEL[l]}</button>`).join("");
  }

  function renderSpecials() {
    $("specials").innerHTML = `<span>${esc(t("specials"))}</span>` +
      ["Ä", "Ö", "Ü", "Ç"].map((c) => `<button type="button" class="sp" data-ins="${c}">${c}</button>`).join("");
  }

  function renderInfo() {
    const ok = K.isExpected(S.rom);
    const crc = S.crc.toString(16).toUpperCase().padStart(8, "0");
    const shaOk = S.sha1 && S.sha1 === K.C.EXPECTED_SHA1;
    $("romInfo").innerHTML =
      `<span>${esc(S.name)}</span><span>${(S.rom.length + S.header.length).toLocaleString(ui)} bytes</span>` +
      `<span class="${ok ? "ok" : "bad"}">CRC32 ${crc} · ${esc(t(ok ? "romOk" : "romBad"))}</span>` +
      (S.sha1 ? `<span class="${shaOk ? "ok" : "bad"}">SHA-1 ${S.sha1.slice(0, 10)}… ${shaOk ? "✓" : "✗"}</span>` : "");
    const b = $("romBanner");
    const msgs = [];
    if (!ok) msgs.push(t("bannerWrong"));
    if (S.header.length) msgs.push(t("bannerHeader"));
    b.hidden = !msgs.length;
    b.innerHTML = msgs.map(esc).join("<br>");
  }

  function filtered() {
    const q = S.search.trim().toLowerCase();
    let list = S.items[S.tab];
    if (S.tab !== "names") list = list.filter((it) => it.lang === S.lang[S.tab]);
    if (S.onlyChanged) list = list.filter(changed);
    if (q) list = list.filter((it) => it.ui.toLowerCase().includes(q) || it.text.toLowerCase().includes(q) || K.hex(it.off).includes(q));
    return list;
  }

  function rowHtml(it) {
    return `<div class="row" data-id="${it.id}">` +
      `<span class="off">${K.hex(it.off)}</span>` +
      `<span class="orig" title="${esc(it.ui)}">${esc(it.ui) || "&nbsp;"}</span>` +
      `<input class="txt" data-id="${it.id}" value="${esc(it.text)}" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="${esc(t("colNew"))} ${K.hex(it.off)}">` +
      `<span class="cnt"></span>` +
      `<span class="rbtns">${it.kind === "match" ? `<button type="button" data-act="center" title="${esc(t("center"))}">${esc(t("btnCenter"))}</button>` : ""}` +
      `<button type="button" data-act="reset" title="${esc(t("reset"))}" hidden>${esc(t("btnReset"))}</button></span></div>`;
  }

  function updateRow(row, it) {
    const c = check(it);
    const bytesLen = c.bytes ? c.bytes.length : it.text.length;
    row.classList.toggle("changed", changed(it));
    row.classList.toggle("err", !!c.err);
    row.classList.toggle("warn", !!c.warn);
    row.querySelector(".cnt").textContent = `${bytesLen}/${it.max}`;
    row.querySelector(".cnt").title = hint(it);
    row.querySelector('[data-act="reset"]').hidden = !changed(it);
    let msg = row.querySelector(".rowmsg");
    const text = c.err || c.warn || "";
    if (text) {
      if (!msg) { msg = document.createElement("div"); msg.className = "rowmsg"; row.appendChild(msg); }
      msg.textContent = text;
    } else if (msg) msg.remove();
  }

  function render() {
    const list = filtered();
    S.visible = list;
    const pages = Math.max(1, Math.ceil(list.length / PAGE));
    S.page = Math.min(S.page, pages - 1);
    const slice = list.slice(S.page * PAGE, (S.page + 1) * PAGE);
    const head = `<div class="row head"><span>${esc(t("colOff"))}</span><span>${esc(t("colOrig"))}</span><span>${esc(t("colNew"))}</span><span style="text-align:right">${esc(t("colLen"))}</span><span></span></div>`;
    $("rows").innerHTML = slice.length ? head + slice.map(rowHtml).join("") : `<div class="empty">${esc(t("empty"))}</div>`;
    $("rows").querySelectorAll(".row[data-id]").forEach((row) => updateRow(row, S.byId.get(row.dataset.id)));
    $("pager").innerHTML = list.length > PAGE
      ? `<button class="btn" type="button" data-page="-1" ${S.page === 0 ? "disabled" : ""}>${esc(t("prev"))}</button>` +
        `<span>${esc(t("rows", { a: S.page * PAGE + 1, b: S.page * PAGE + slice.length, c: list.length }))}</span>` +
        `<button class="btn" type="button" data-page="1" ${S.page >= pages - 1 ? "disabled" : ""}>${esc(t("next"))}</button>`
      : "";
    renderSummary();
  }

  function renderSummary() {
    let n = 0, e = 0;
    for (const it of allItems()) if (changed(it)) { n++; if (check(it).err) e++; }
    $("summary").innerHTML = `<b>${esc(t("changes", { n }))}</b>` + (e ? ` · <span class="e">${esc(t("errorsN", { n: e }))}</span>` : "");
    return n;
  }

  // --- autosave / import / export ----------------------------------------------
  const storeKey = () => "ko3.edits." + S.crc.toString(16);
  const editsObject = () => {
    const edits = [];
    for (const it of allItems()) if (changed(it)) edits.push({ k: it.kind, o: it.off, t: it.text });
    return { app: "ko3-text-studio", version: 1, rom_crc32: S.crc.toString(16).toUpperCase().padStart(8, "0"), edits };
  };
  let saveTimer = 0;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const o = editsObject();
        if (o.edits.length) localStorage.setItem(storeKey(), JSON.stringify(o));
        else localStorage.removeItem(storeKey());
      } catch (e) { /* storage blocked: fine */ }
    }, 400);
  }
  function applyEdits(obj) {
    let n = 0;
    for (const e of obj.edits || []) {
      const it = S.byId.get(`${e.k}:${e.o}`);
      if (it && typeof e.t === "string") { it.text = e.t; n++; }
    }
    return n;
  }

  // --- building ----------------------------------------------------------------
  function showErrors(list) {
    const box = $("errors");
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = `<b>${esc(t("errorsTitle"))}</b><ul>` + list.slice(0, 12).map((x, i) =>
      `<li>${x.id ? `<code>${K.hex(S.byId.get(x.id).off)}</code> ` : ""}${esc(x.msg)}` +
      (x.id ? ` <button type="button" class="link" data-jump="${esc(x.id)}">${esc(t("jump"))}</button>` : "") + `</li>`).join("") +
      (list.length > 12 ? `<li>… +${list.length - 12}</li>` : "") + "</ul>";
    box.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function coreMessage(e) {
    const it = e.off !== undefined ? S.byId.get(`${e.kind}:${e.off}`) : null;
    const id = it ? it.id : null;
    switch (e.code) {
      case "too-long": return { id, msg: t(e.kind === "names" ? "eNames" : "eTooLong", e) };
      case "exact": return { id, msg: t("eExact", e) };
      case "no-room": return { id, msg: t("eNoRoom", e) };
      case "nul": return { id, msg: t("eNul") };
      default: return { id, msg: t("eUnknown") };
    }
  }

  function build() {
    const edits = { menu: new Map(), match: new Map(), names: new Map() };
    const problems = [];
    for (const it of allItems()) {
      if (!changed(it)) continue;
      const c = check(it);
      if (c.err) problems.push({ id: it.id, msg: c.err });
      else edits[it.kind].set(it.off, c.bytes);
    }
    if (problems.length) { showErrors(problems); return null; }
    const r = K.buildChanges(S.rom, S.parsed, edits, S.opts);
    if (r.errors.length) { showErrors(r.errors.map(coreMessage)); return null; }
    const out = K.applyChanges(S.rom, r.changes, r.notes);
    const v = K.verifyMenu(out, S.parsed, r.menuFull, edits, S.opts);
    if (!v.ok) { toast(t("toastVerify", { why: v.reason }), true); return null; }
    showErrors([]);
    return { out, count: edits.menu.size + edits.match.size + edits.names.size };
  }

  function download(bytes, name, type) {
    const url = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const baseName = () => S.name.replace(/\.[^.]+$/, "");

  let toastTimer = 0;
  function toast(msg, isErr) {
    const el = $("toast");
    el.textContent = msg; el.className = "toast" + (isErr ? " err" : ""); el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, isErr ? 7000 : 4500);
  }

  // --- loading a ROM -------------------------------------------------------------
  async function sha1Hex(bytes) {
    try {
      if (!(window.crypto && crypto.subtle)) return "";
      const d = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes));
      return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (e) { return ""; }
  }

  function showLoadError(msg) { const b = $("loadError"); b.hidden = !msg; b.textContent = msg || ""; }

  async function loadFile(file) {
    showLoadError("");
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) return showLoadError(t("tooBig"));
    let parts, parsed;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      parts = K.splitHeader(bytes);
      parsed = K.parseRom(parts.rom);
      if (parsed.menu.length < 100 || !parsed.names.length) throw new Error("no tables");
    } catch (e) { return showLoadError(t("loadFailed")); }

    S.name = file.name; S.header = parts.header; S.rom = parts.rom; S.parsed = parsed;
    S.crc = K.crc32(parts.rom);
    S.sha1 = await sha1Hex(parts.rom);
    S.byId = new Map();
    for (const kind of ["menu", "match", "names"]) {
      S.items[kind] = parsed[kind].map((p) => {
        const it = { ...p, id: `${kind}:${p.off}`, ui: K.bytesToUi(p.orig) };
        it.text = it.ui;
        S.byId.set(it.id, it);
        return it;
      });
    }
    S.tab = "menu"; S.page = 0; S.search = ""; $("search").value = "";
    S.lang.menu = S.lang.match = ui === "de" ? "de" : "en";
    let restored = 0;
    try {
      const saved = localStorage.getItem(storeKey());
      if (saved) restored = applyEdits(JSON.parse(saved));
    } catch (e) { /* ignore broken or blocked storage */ }

    $("intro").hidden = true; $("studio").hidden = false;
    showErrors([]);
    renderTabs(); renderChips(); renderSpecials(); renderInfo(); render();
    window.scrollTo({ top: 0 });
    if (restored) toast(t("toastRestored", { n: restored }));
  }

  // --- events --------------------------------------------------------------------
  const drop = $("drop");
  $("file").addEventListener("change", (e) => loadFile(e.target.files[0]));
  drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));
  // dropping a file anywhere else must not make the browser open it
  window.addEventListener("dragover", (e) => e.preventDefault());
  window.addEventListener("drop", (e) => { if (!drop.contains(e.target)) e.preventDefault(); });

  $("langBtn").addEventListener("click", () => {
    ui = ui === "de" ? "en" : "de";
    try { localStorage.setItem("ko3.ui", ui); } catch (e) { /* ignore */ }
    applyTexts();
  });

  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    S.tab = b.dataset.tab; S.page = 0;
    renderTabs(); renderChips(); render();
  });
  $("langChips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (!b) return;
    S.lang[S.tab] = b.dataset.lang; S.page = 0;
    renderChips(); render();
  });
  $("search").addEventListener("input", (e) => { S.search = e.target.value; S.page = 0; render(); });
  $("onlyChanged").addEventListener("change", (e) => { S.onlyChanged = e.target.checked; S.page = 0; render(); });
  $("optRepack").addEventListener("change", (e) => { S.opts.repack = e.target.checked; render(); });
  $("optPad").addEventListener("change", (e) => { S.opts.pad = e.target.value; });
  $("pager").addEventListener("click", (e) => {
    const b = e.target.closest("[data-page]");
    if (!b) return;
    S.page += Number(b.dataset.page);
    render();
    $("rows").scrollIntoView({ block: "start" });
  });

  $("rows").addEventListener("input", (e) => {
    const input = e.target.closest(".txt");
    if (!input) return;
    const it = S.byId.get(input.dataset.id);
    it.text = input.value;
    updateRow(input.closest(".row"), it);
    renderSummary();
    autosave();
  });
  $("rows").addEventListener("focusin", (e) => { if (e.target.classList.contains("txt")) S.lastInput = e.target; });
  $("rows").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const row = b.closest(".row");
    const it = S.byId.get(row.dataset.id);
    if (b.dataset.act === "reset") it.text = it.ui;
    else if (b.dataset.act === "center") {
      const s = it.text.trim();
      const gap = Math.max(0, it.max - s.length);
      const left = Math.floor(gap / 2);
      it.text = " ".repeat(left) + s + " ".repeat(gap - left);
    }
    row.querySelector(".txt").value = it.text;
    updateRow(row, it); renderSummary(); autosave();
    if (S.onlyChanged && b.dataset.act === "reset") render();
  });

  $("specials").addEventListener("mousedown", (e) => { if (e.target.closest("[data-ins]")) e.preventDefault(); });
  $("specials").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ins]");
    const input = S.lastInput;
    if (!b || !input || !document.contains(input)) return;
    const s = input.selectionStart ?? input.value.length, en = input.selectionEnd ?? s;
    input.value = input.value.slice(0, s) + b.dataset.ins + input.value.slice(en);
    input.setSelectionRange(s + 1, s + 1);
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  $("errors").addEventListener("click", (e) => {
    const b = e.target.closest("[data-jump]");
    if (!b) return;
    const it = S.byId.get(b.dataset.jump);
    S.tab = it.kind; if (it.kind !== "names") S.lang[it.kind] = it.lang;
    S.search = ""; $("search").value = ""; S.onlyChanged = false; $("onlyChanged").checked = false;
    const idx = filtered().indexOf(it);
    S.page = Math.max(0, Math.floor(idx / PAGE));
    renderTabs(); renderChips(); render();
    const row = $("rows").querySelector(`.row[data-id="${CSS.escape(it.id)}"]`);
    if (row) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); row.querySelector(".txt").focus(); }
  });

  $("dlRom").addEventListener("click", () => {
    const r = build();
    if (!r) return;
    if (!r.count) return toast(t("toastNoChange"), true);
    const full = new Uint8Array(S.header.length + r.out.length);
    full.set(S.header); full.set(r.out, S.header.length);
    download(full, `${baseName()} - fixed.sfc`);
    toast(t("toastBuilt", { n: r.count }));
  });
  const patchBtn = (id, ext, make) => $(id).addEventListener("click", () => {
    const r = build();
    if (!r) return;
    if (!r.count) return toast(t("toastNoChange"), true);
    const data = make(S.rom, r.out);
    download(data, `${baseName()}.${ext}`);
    toast(t("toastPatch", { size: data.length }));
  });
  patchBtn("dlBps", "bps", K.makeBps);
  patchBtn("dlIps", "ips", K.makeIps);

  $("exportBtn").addEventListener("click", () => {
    const o = editsObject();
    if (!o.edits.length) return toast(t("toastNoChange"), true);
    download(JSON.stringify(o, null, 1), "kickoff3-edits.json", "application/json");
  });
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (o.app !== "ko3-text-studio" || o.rom_crc32 !== S.crc.toString(16).toUpperCase().padStart(8, "0")) throw new Error("mismatch");
      const n = applyEdits(o);
      render(); autosave();
      toast(t("toastImported", { n }));
    } catch (err) { toast(t("toastImportBad"), true); }
  });
  $("resetBtn").addEventListener("click", () => {
    const n = allItems().filter(changed).length;
    if (!n || !window.confirm(t("resetConfirm", { n }))) return;
    for (const it of allItems()) it.text = it.ui;
    showErrors([]); render(); autosave();
  });

  applyTexts();
})();
