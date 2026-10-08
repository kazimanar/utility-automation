/*
 * Demin Water Project — SharePoint/OneDrive sürümü için dosya tabanlı veri katmanı.
 * Panelin kullandığı `db` arayüzünün (doc/collection, set, onSnapshot, where/orderBy/limit)
 * küçük bir alt kümesini, seçilen klasördeki `demin-veri.json` dosyası üzerinde sağlar.
 * Yalnız SharePoint derlemesine gömülür; claude.ai artifact sürümü bunu kullanmaz.
 */
(function () {
  "use strict";
  const FILE_NAME = "demin-veri.json";
  const FORMAT = "demin-veri";
  const POLL_MS = 60000;

  const docs = new Map();          // "koleksiyon/id" → belge
  const dirty = new Set();
  const listeners = new Set();
  let dirHandle = null, fileHandle = null;
  let mode = "none";               // none | rw | ro
  let lastModified = 0, lastLoad = null, lastSave = null, error = null;
  let flushTimer = null, flushing = null, notifyQueued = false, ready = false;
  const hasFsApi = typeof window.showDirectoryPicker === "function";

  const clone = o => JSON.parse(JSON.stringify(o));
  const fail = (code, message) => Object.assign(new Error(message), { code });

  // ---------- IndexedDB: seçilen klasörü hatırla ----------
  function idb(fn) {
    return new Promise((resolve, reject) => {
      let req;
      try { req = indexedDB.open("demin-panel", 1); } catch (e) { reject(e); return; }
      req.onupgradeneeded = () => req.result.createObjectStore("kv");
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction("kv", "readwrite");
          const r = fn(tx.objectStore("kv"));
          tx.oncomplete = () => resolve(r && r.result);
          tx.onerror = tx.onabort = () => reject(tx.error);
        } catch (e) { reject(e); }
      };
    });
  }
  const saveHandle = h => idb(s => s.put(h, "dir")).catch(() => {});
  const loadHandle = () => idb(s => s.get("dir")).catch(() => null);

  // ---------- dosya okuma / yazma ----------
  function parse(text) {
    if (!text || !text.trim()) return {};
    const j = JSON.parse(text);
    if (!j || j.format !== FORMAT || typeof j.docs !== "object") throw fail("invalid_argument", FILE_NAME + " beklenen biçimde değil.");
    return j.docs;
  }
  async function loadFromHandle() {
    const f = await fileHandle.getFile();
    const d = parse(await f.text());
    docs.clear();
    for (const k in d) docs.set(k, d[k]);
    lastModified = f.lastModified; lastLoad = new Date(); error = null;
    notify();
  }
  async function writeNow() {
    if (!dirty.size || mode !== "rw") return;
    const mine = new Map([...dirty].map(k => [k, docs.get(k)]));
    dirty.clear();
    try {
      // Başkası (ya da OneDrive senkronu) dosyayı değiştirdiyse önce onu al, sonra kendi değişikliklerimizi üstüne koy.
      const f = await fileHandle.getFile();
      if (f.lastModified !== lastModified) {
        const disk = parse(await f.text());
        docs.clear();
        for (const k in disk) docs.set(k, disk[k]);
        for (const [k, v] of mine) docs.set(k, v);
      }
      const out = { format: FORMAT, surum: 1, guncelleme: new Date().toISOString(), docs: Object.fromEntries(docs) };
      const w = await fileHandle.createWritable();
      await w.write(JSON.stringify(out));
      await w.close();
      lastModified = (await fileHandle.getFile()).lastModified;
      lastSave = new Date(); error = null;
      notify(); renderBar();
    } catch (e) {
      for (const [k] of mine) dirty.add(k);
      error = "Veri dosyasına yazılamadı: " + (e && e.message || e);
      renderBar();
      throw fail("unavailable", error);
    }
  }
  function flush() {
    clearTimeout(flushTimer); flushTimer = null;
    const run = async () => { if (flushing) await flushing.catch(() => {}); await writeNow(); };
    flushing = run();
    return flushing;
  }
  const scheduleFlush = () => { clearTimeout(flushTimer); flushTimer = setTimeout(() => flush().catch(() => {}), 1500); };

  // ---------- klasör bağlama ----------
  async function useDir(h) {
    dirHandle = h;
    fileHandle = await h.getFileHandle(FILE_NAME, { create: true });
    mode = "rw";
    await loadFromHandle();
    ready = true; renderBar();
  }
  async function choose() {
    if (!hasFsApi) throw fail("capability_disabled", "Bu tarayıcı klasöre yazamıyor. Edge ya da Chrome kullanın.");
    const h = await window.showDirectoryPicker({ id: "demin-veri", mode: "readwrite" });
    await saveHandle(h);
    await useDir(h);
  }
  async function reconnect() {
    if (!dirHandle) return choose();
    if ((await dirHandle.requestPermission({ mode: "readwrite" })) !== "granted") throw fail("not_granted", "Klasöre yazma izni verilmedi.");
    await useDir(dirHandle);
  }
  /** Kayıttan önce çağrılır (bir tıklamanın içinde): klasör bağlı değilse bağlar. */
  async function ensureWritable() {
    if (mode === "rw") return true;
    try { if (dirHandle) await reconnect(); else await choose(); return mode === "rw"; }
    catch (e) { if (e && e.name === "AbortError") return false; error = e && e.message || String(e); renderBar(); return false; }
  }
  async function openReadOnly(file) {
    const d = parse(await file.text());
    docs.clear(); for (const k in d) docs.set(k, d[k]);
    mode = "ro"; fileHandle = null; dirHandle = null; lastLoad = new Date(); error = null; ready = true;
    notify(); renderBar();
  }

  // ---------- db arayüzü ----------
  function notify() {
    if (notifyQueued) return;
    notifyQueued = true;
    setTimeout(() => { notifyQueued = false; for (const l of listeners) l(); }, 30);
  }
  const snapDoc = (path, v) => ({ id: path.split("/").pop(), exists: v !== undefined, data: () => v === undefined ? undefined : clone(v), metadata: { fromCache: false, hasPendingWrites: dirty.has(path) } });
  function docRef(path) {
    return {
      id: path.split("/").pop(), path,
      async get() { return snapDoc(path, docs.get(path)); },
      async set(body) {
        if (mode !== "rw") throw fail("not_granted", "Veri klasörü bağlı değil.");
        if (!body || typeof body !== "object" || Array.isArray(body)) throw fail("invalid_argument", "Belge bir nesne olmalı.");
        docs.set(path, clone(body)); dirty.add(path); notify(); scheduleFlush();
      },
      async update(patch) { const cur = docs.get(path); if (!cur) throw fail("invalid_argument", "Belge yok."); return this.set(Object.assign(clone(cur), patch)); },
      async delete() { if (mode !== "rw") throw fail("not_granted", "Veri klasörü bağlı değil."); docs.delete(path); dirty.add(path); notify(); scheduleFlush(); },
      onSnapshot(next) {
        const l = () => next(snapDoc(path, docs.get(path)));
        listeners.add(l); if (ready) l();
        return () => listeners.delete(l);
      }
    };
  }
  function query(coll, filters, order, lim) {
    const run = () => {
      let rows = [];
      for (const [k, v] of docs) {
        if (!k.startsWith(coll + "/") || k.indexOf("/", coll.length + 1) >= 0) continue;
        if (filters.every(([f, op, val]) => op === "==" ? v[f] === val : true)) rows.push([k, v]);
      }
      if (order) {
        const [f, dir] = order, s = dir === "desc" ? -1 : 1;
        rows.sort((a, b) => (a[1][f] < b[1][f] ? -1 : a[1][f] > b[1][f] ? 1 : 0) * s);
      } else rows.sort((a, b) => a[0] < b[0] ? -1 : 1);
      if (lim) rows = rows.slice(0, lim);
      const d = rows.map(([k, v]) => snapDoc(k, v));
      return { docs: d, size: d.length, empty: !d.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } };
    };
    return {
      where(f, op, val) { return query(coll, filters.concat([[f, op, val]]), order, lim); },
      orderBy(f, dir) { return query(coll, filters, [f, dir || "asc"], lim); },
      limit(n) { return query(coll, filters, order, n); },
      async get() { return run(); },
      onSnapshot(next) { const l = () => next(run()); listeners.add(l); if (ready) l(); return () => listeners.delete(l); },
      doc(id) { return docRef(coll + "/" + id); }
    };
  }
  const db = { doc: docRef, collection: c => Object.assign(query(c, [], null, 0), { path: c }) };

  // ---------- durum şeridi ----------
  const hhmm = d => d ? String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") : "—";
  let bar = null;
  function renderBar() {
    if (!bar) {
      const notice = document.getElementById("notice");
      if (!notice) return;
      bar = document.createElement("div");
      bar.className = "notice"; bar.id = "fileBar";
      notice.insertAdjacentElement("afterend", bar);
      bar.addEventListener("click", async e => {
        const b = e.target.closest("button"); if (!b) return;
        try {
          if (b.dataset.act === "choose") await choose();
          else if (b.dataset.act === "reconnect") await reconnect();
          else if (b.dataset.act === "open") bar.querySelector("input[type=file]").click();
          else if (b.dataset.act === "reload") await loadFromHandle();
        } catch (err) { if (!(err && err.name === "AbortError")) { error = err && err.message || String(err); renderBar(); } }
      });
      bar.addEventListener("change", async e => {
        const f = e.target.files && e.target.files[0]; e.target.value = "";
        if (f) { try { await openReadOnly(f); } catch (err) { error = err && err.message || String(err); renderBar(); } }
      });
    }
    const btn = (act, txt, primary) => '<button type="button" class="btn sm' + (primary ? " primary" : "") + '" data-act="' + act + '">' + txt + "</button>";
    const parts = [];
    if (mode === "rw") {
      parts.push("<b>Veri dosyası:</b> " + esc(dirHandle.name) + "/" + FILE_NAME);
      parts.push("son okuma " + hhmm(lastLoad) + (lastSave ? " · son kayıt " + hhmm(lastSave) : "") + (dirty.size ? " · kaydediliyor…" : ""));
      parts.push(btn("reload", "Yeniden oku") + " " + btn("choose", "Klasörü değiştir"));
    } else if (mode === "ro") {
      parts.push("<b>Salt okunur:</b> veri dosyası yalnız görüntüleniyor; değişiklikler kaydedilmez.");
      parts.push(hasFsApi ? btn("choose", "Veri klasörünü bağla", true) : "Kaydetmek için Edge ya da Chrome kullanın.");
    } else {
      parts.push("<b>Veri klasörü bağlı değil.</b> Paylaşılan veri, SharePoint klasöründeki " + FILE_NAME + " dosyasında tutulur.");
      if (hasFsApi && dirHandle) parts.push(btn("reconnect", "“" + esc(dirHandle.name) + "” klasörüne bağlan", true));
      else if (hasFsApi) parts.push(btn("choose", "Veri klasörünü seç", true));
      else parts.push("Bu tarayıcı klasöre yazamıyor; Edge ya da Chrome kullanın.");
      parts.push(btn("open", "Veri dosyasını aç (salt okunur)") + '<input type="file" accept=".json,application/json" hidden>');
    }
    if (error) parts.push('<span class="msg err">' + esc(error) + "</span>");
    bar.innerHTML = parts.map(p => "<span>" + p + "</span>").join("");
    bar.className = "notice" + (mode === "rw" ? "" : " sample");
  }
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  // OneDrive senkronuyla gelen değişiklikleri yakala.
  setInterval(async () => {
    if (mode !== "rw" || dirty.size || document.hidden || !fileHandle) return;
    try { const f = await fileHandle.getFile(); if (f.lastModified !== lastModified) await loadFromHandle(); renderBar(); } catch (_) {}
  }, POLL_MS);

  async function init() {
    renderBar();
    const h = await loadHandle();
    if (h && typeof h.queryPermission === "function") {
      dirHandle = h;
      try { if ((await h.queryPermission({ mode: "readwrite" })) === "granted") { await useDir(h); return; } } catch (_) {}
    }
    ready = true; notify(); renderBar();
  }

  window.DeminFile = { ensureWritable, flush, choose, openReadOnly, get mode() { return mode; } };
  // Panel `window.claude.use("db")` ile veri katmanını ister; burada dosya katmanı döner.
  window.claude = { use: async name => name === "db" ? db : null };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
