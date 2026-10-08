/*
 * Demin Water Project — saf hesap modülü.
 * Ham PI Excel tablosunu (satır dizisi) ayrıştırır, 10 dk dilimleri günlük hat/tesis
 * ortalamalarına toplar ve KPI'ları (recovery, normalize dP, TCF, NDP, NPF, NSP, durum) hesaplar.
 * Tarayıcıda `window.DeminCalc`, Node'da `require("./calc.js")`.
 */
(function (root, factory) {
  const tags = typeof module === "object" && module.exports ? require("./tags.js") : root.DeminTags;
  const api = factory(tags);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeminCalc = api;
})(typeof self !== "undefined" ? self : this, function (T) {
  "use strict";

  const TAG_RE = /^(PI|PT|FI|FT|AI|AE|TI)-\d{4,6}( ?[A-D])?$/i;
  const PATH_RE = /x?([A-Z]{2,4})(\d{4,6})([A-D])?_PV/i;
  const EXCEL_EPOCH = 25569; // 1970-01-01

  // ---------- hücre / zaman yardımcıları ----------

  /** SheetJS hücre nesnesi ya da ham değer → değer; hata hücresi → null. */
  function cellVal(x) {
    if (x != null && typeof x === "object" && !(x instanceof Date)) {
      if (x.t === "e") return null;
      return x.v;
    }
    return x;
  }
  /** Sayısal değer; sayı olmayan, hata ve "Resize…" gibi metinler → null. */
  function num(x) {
    const v = cellVal(x);
    if (typeof v === "number") return isFinite(v) ? v : null;
    if (typeof v === "string") {
      const s = v.trim().replace(",", ".");
      if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
      const n = parseFloat(s);
      return isFinite(n) ? n : null;
    }
    return null;
  }
  const pad = n => String(n).padStart(2, "0");
  /** Excel seri zamanı (gün) ya da tarih metni → seri; anlaşılmazsa null. */
  function toSerial(x) {
    const v = cellVal(x);
    if (typeof v === "number") return v > 20000 && v < 80000 ? v : null;
    if (v instanceof Date && !isNaN(v)) return (v.getTime() - v.getTimezoneOffset() * 6e4) / 864e5 + EXCEL_EPOCH;
    if (typeof v === "string") {
      let m = v.trim().match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      let y, mo, d, h = 0, mi = 0, s = 0;
      if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0); }
      else {
        m = v.trim().match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
        if (!m) return null;
        d = +m[1]; mo = +m[2]; y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); s = +(m[6] || 0);
      }
      return Date.UTC(y, mo - 1, d, h, mi, s) / 864e5 + EXCEL_EPOCH;
    }
    return null;
  }
  /** Seri zaman → "YYYY-MM-DD" (günün başlangıcına göre). */
  function serialToISO(s) {
    const d = new Date(Math.round((Math.floor(s + 1e-7) - EXCEL_EPOCH) * 864e5));
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }
  function serialToStamp(s) {
    const d = new Date(Math.round((s - EXCEL_EPOCH) * 864e5));
    return serialToISO(s) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes());
  }
  function isoAddDays(iso, n) {
    const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  const dayNum = iso => Date.parse(iso + "T00:00:00Z") / 864e5;

  // ---------- başlık algılama ----------

  /**
   * Ham PI tablosunda tag satırını bulur. İlk 15 satırda TAG_RE'ye en çok uyan satır tag satırıdır;
   * yoksa PI yolu satırından (…xPI91608A_PV) tag çıkarılır.
   * Dönen: { tagRow, mode, dataStart, cols: [{ c, tag, norm, group, desc, unit, path }] }
   */
  function detectHeader(rows) {
    const lim = Math.min(rows.length, 15);
    let best = -1, bestN = 0, pathRow = -1, pathN = 0;
    for (let r = 0; r < lim; r++) {
      const row = rows[r] || [];
      let n = 0, p = 0;
      for (let c = 0; c < row.length; c++) {
        const v = cellVal(row[c]);
        if (typeof v !== "string") continue;
        const s = v.trim();
        if (TAG_RE.test(s)) n++;
        if (PATH_RE.test(s)) p++;
      }
      if (n > bestN) { bestN = n; best = r; }
      if (p > pathN) { pathN = p; pathRow = r; }
    }
    let mode, tagRow;
    if (bestN >= 3) { mode = "tag"; tagRow = best; }
    else if (pathN >= 3) { mode = "path"; tagRow = pathRow; }
    else throw new Error("Tag satırı bulunamadı. İlk 15 satırda PI-91608 A, AI-91750 gibi tag'ler ya da …xPI91608A_PV yolları olmalı.");

    // Veri başlangıcı: tag satırından sonra A kolonunda ilk geçerli zaman.
    let dataStart = -1;
    for (let r = tagRow + 1; r < Math.min(rows.length, tagRow + 40); r++) {
      if (toSerial((rows[r] || [])[0]) != null) { dataStart = r; break; }
    }
    if (dataStart < 0) throw new Error("Zaman kolonu (A) bulunamadı: tag satırının altında Excel tarih/saat değeri yok.");

    const str = (r, c) => { if (r < 0 || r >= dataStart) return ""; const v = cellVal((rows[r] || [])[c]); return v == null ? "" : String(v).trim(); };
    const head = rows[tagRow] || [];
    let width = head.length;
    for (let r = Math.max(0, tagRow - 1); r < dataStart; r++) width = Math.max(width, (rows[r] || []).length);
    const cols = [];
    let group = "";
    for (let c = 1; c < width; c++) {
      const g = str(tagRow - 1, c); if (g) group = g;
      let tag = "", path = "";
      for (let r = tagRow; r < dataStart; r++) { const s = str(r, c); if (PATH_RE.test(s)) { path = s; break; } }
      if (mode === "tag") tag = str(tagRow, c);
      if (!tag && path) {
        const m = path.match(PATH_RE);
        tag = m[1].toUpperCase() + "-" + m[2] + (m[3] ? " " + m[3].toUpperCase() : "");
      }
      if (!tag) continue;
      cols.push({
        c, tag, norm: T.normTag(tag), group,
        desc: mode === "tag" ? str(tagRow + 1, c) : "",
        unit: mode === "tag" ? str(tagRow + 2, c) : "",
        path
      });
    }
    return { tagRow, mode, dataStart, cols };
  }

  /**
   * Kolonlara hedef anahtarı atar: önce kullanıcı eşleştirmesi (`userMap`: normTag → anahtar | "ignore"),
   * sonra sözlük. Dönen kolonlar `key` (ör. "P1-A.qp", "plant.uf_ph") ya da null taşır.
   */
  function resolveColumns(cols, userMap) {
    const idx = T.builtinIndex();
    const tg = T.targets();
    const seen = new Set();
    return cols.map(col => {
      const u = userMap && userMap[col.norm];
      let key = null, src = null;
      if (u === "ignore") { key = null; src = "ignore"; }
      else if (u && tg[u]) { key = u; src = "user"; }
      else if (idx[col.norm]) { key = idx[col.norm]; src = "dict"; }
      if (key && seen.has(key)) { key = null; src = "dup"; }
      if (key) seen.add(key);
      return Object.assign({}, col, { key, src });
    });
  }

  // ---------- günlük toplama ----------

  const LP = T.LINE_PARAMS.map(p => p.k);
  // Hat ortalamasına katılan pass-ortak parametreler: T ve besleme EC.
  const LP_ALL = LP.concat(["t", "ec_f"]);
  const PASS_PLANT = { 1: { t: "p1_t", ec_f: "p1_ec_f" }, 2: { t: "p2_t", ec_f: "p2_ec_f" } };

  function percentile(sorted, p) {
    if (!sorted.length) return null;
    const i = (sorted.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  /**
   * Akış halinde toplayıcı. `cols`: resolveColumns çıktısı. Her satır `add(row)` ile verilir
   * (row[0] zaman, row[c] değer). `finish()` günlük hat ve tesis kayıtlarını döndürür.
   */
  function makeAggregator(cols, model) {
    const S = model.sabit;
    const lineIdx = T.LINES.map(line => {
      const m = {};
      for (const col of cols) if (col.key && col.key.startsWith(line + ".")) m[col.key.slice(line.length + 1)] = col.c;
      return m;
    });
    const plantCols = cols.filter(c => c.key && c.key.startsWith("plant.")).map(c => [c.key.slice(6), c.c]);
    const plantByKey = Object.fromEntries(plantCols);
    const pctSet = new Set(T.PCT_KEYS);

    const lineDays = new Map();  // "iso|line" → acc
    const plantDays = new Map(); // iso → acc
    let n = 0, first = null, last = null, prevT = null;
    const diffs = [];

    function add(row) {
      const t = toSerial(row[0]);
      if (t == null) return false;
      n++;
      if (first == null || t < first) first = t;
      if (last == null || t > last) last = t;
      if (prevT != null && diffs.length < 50) { const d = t - prevT; if (d > 0) diffs.push(d); }
      prevT = t;
      const iso = serialToISO(t);

      let P = plantDays.get(iso);
      if (!P) plantDays.set(iso, P = { n: 0, sum: {}, cnt: {}, pct: {}, run: { 1: 0, 2: 0 }, qsum: { 1: 0, 2: 0 } });
      P.n++;
      for (const [k, c] of plantCols) {
        const v = num(row[c]); if (v == null) continue;
        P.sum[k] = (P.sum[k] || 0) + v; P.cnt[k] = (P.cnt[k] || 0) + 1;
        if (pctSet.has(k)) (P.pct[k] = P.pct[k] || []).push(v);
      }

      for (let i = 0; i < T.LINES.length; i++) {
        const line = T.LINES[i], pass = +line[1], m = lineIdx[i];
        if (m.qp == null) continue;
        const qp = num(row[m.qp]);
        const runMin = pass === 1 ? S.run_min_p1 : S.run_min_p2;
        const key = iso + "|" + line;
        let A = lineDays.get(key);
        if (!A) lineDays.set(key, A = { iso, line, pass, n: 0, run: 0, sum: {}, cnt: {}, qsum: 0 });
        A.n++;
        if (qp == null || qp < runMin) continue;
        A.run++; A.qsum += qp;
        P.run[pass]++; P.qsum[pass] += qp;
        for (const k of LP) {
          if (m[k] == null) continue;
          const v = k === "qp" ? qp : num(row[m[k]]); if (v == null) continue;
          A.sum[k] = (A.sum[k] || 0) + v; A.cnt[k] = (A.cnt[k] || 0) + 1;
        }
        for (const k of ["t", "ec_f"]) {
          const c = plantByKey[PASS_PLANT[pass][k]]; if (c == null) continue;
          const v = num(row[c]); if (v == null) continue;
          A.sum[k] = (A.sum[k] || 0) + v; A.cnt[k] = (A.cnt[k] || 0) + 1;
        }
      }
      return true;
    }

    function finish() {
      // Aralık: ilk zaman farklarının medyanı (gün) → saat.
      const ds = diffs.slice().sort((a, b) => a - b);
      const stepDay = ds.length ? percentile(ds, 0.5) : 10 / 1440;
      const stepH = stepDay * 24;
      const r4 = v => v == null ? null : Math.round(v * 1e4) / 1e4;
      const outLines = [];
      for (const A of lineDays.values()) {
        const avg = {};
        for (const k of LP_ALL) avg[k] = A.cnt[k] ? r4(A.sum[k] / A.cnt[k]) : null;
        outLines.push({ tarih: A.iso, hat: A.line, pass: A.pass, n: A.n, run_n: A.run, saat: r4(A.run * stepH), uretim: r4(A.qsum * stepH), avg });
      }
      const outPlant = [];
      for (const [iso, P] of plantDays) {
        const avg = {}, pct = {};
        for (const k in P.sum) avg[k] = r4(P.sum[k] / P.cnt[k]);
        for (const k in P.pct) { const s = P.pct[k].sort((a, b) => a - b); pct[k] = { med: r4(percentile(s, 0.5)), p95: r4(percentile(s, 0.95)) }; }
        outPlant.push({ tarih: iso, n: P.n, avg, pct, uretim: { p1: r4(P.qsum[1] * stepH), p2: r4(P.qsum[2] * stepH) } });
      }
      outLines.sort((a, b) => a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : T.LINES.indexOf(a.hat) - T.LINES.indexOf(b.hat));
      outPlant.sort((a, b) => a.tarih < b.tarih ? -1 : 1);
      const perDay = Math.round(1 / stepDay);
      const partial = outPlant.filter(p => p.n < perDay * 0.95).map(p => p.tarih);
      return {
        rows: n, first, last, stepMin: Math.round(stepDay * 1440 * 100) / 100,
        firstStamp: first == null ? null : serialToStamp(first), lastStamp: last == null ? null : serialToStamp(last),
        lineDays: outLines, plantDays: outPlant, partialDays: partial
      };
    }
    return { add, finish };
  }

  /** Tüm tabloyu tek seferde toplar (testler ve küçük dosyalar için). */
  function aggregate(rows, header, cols, model) {
    const agg = makeAggregator(cols, model);
    for (let r = header.dataStart; r < rows.length; r++) if (rows[r]) agg.add(rows[r]);
    return agg.finish();
  }

  // ---------- KPI ----------

  /** Sıcaklık düzeltme faktörü (25 °C referans). */
  function tcf(t) {
    const k = t <= 25 ? 3020 : 2640;
    return Math.exp(k * (1 / 298.15 - 1 / (273.15 + t)));
  }
  const ok = v => v != null && isFinite(v);

  /**
   * Hat günlük ortalamalarından KPI. `a`: { cf_in, cf_out, pf, pint, pc, qp, qc, ec_p, t, ec_f },
   * `ref`: hat referansı, `model`: { sabit }, `pass`: 1 | 2. Hesaplanamayan alanlar null.
   */
  function lineKPI(a, ref, model, pass) {
    const S = model.sabit;
    const o = { rec: null, st1: null, st2: null, cf_dp: null, n_st1: null, n_st1_pct: null, n_st2: null, n_st2_pct: null,
      tcf: null, pi_fc: null, pi_p: null, ndp: null, k: null, npf: null, sp: null, nsp: null, nsp_pct: null };
    if (!a) return o;
    const { qp, qc, pf, pint, pc } = a;
    if (ok(qp) && ok(qc) && qp + qc > 0) o.rec = qp / (qp + qc) * 100;
    if (ok(pf) && ok(pint)) o.st1 = pf - pint;
    if (ok(pint) && ok(pc)) o.st2 = pint - pc;
    if (ok(a.cf_in) && ok(a.cf_out)) o.cf_dp = a.cf_in - a.cf_out;
    if (ref && ok(qp) && ok(qc) && ok(ref.qp) && ok(ref.qc) && qp + 2 * qc > 0) {
      const f = Math.pow((ref.qp + 2 * ref.qc) / (qp + 2 * qc), S.dp_exp);
      if (o.st1 != null) { o.n_st1 = o.st1 * f; if (ok(ref.st1) && ref.st1 > 0) o.n_st1_pct = o.n_st1 / ref.st1 * 100; }
      if (o.st2 != null) { o.n_st2 = o.st2 * f; if (ok(ref.st2) && ref.st2 > 0) o.n_st2_pct = o.n_st2 / ref.st2 * 100; }
    }
    if (ok(a.t)) o.tcf = tcf(a.t);
    const R = o.rec != null ? o.rec / 100 : null;
    if (ok(a.ec_f) && R != null && R > 0 && R < 1) o.pi_fc = a.ec_f * S.ec_tds * Math.log(1 / (1 - R)) / R * S.osm;
    if (ok(a.ec_p)) o.pi_p = a.ec_p * S.ec_tds * S.osm;
    const pperm = pass === 1 ? S.p1_perm : S.p2_perm;
    if (ok(pf) && ok(pc) && o.pi_fc != null && o.pi_p != null) o.ndp = pf - (pf - pc) / 2 - pperm - o.pi_fc + o.pi_p;
    if (ok(qp) && o.ndp != null && o.ndp > 0 && o.tcf != null) {
      o.k = qp / (o.ndp * o.tcf);
      if (ref && ok(ref.k) && ref.k > 0) o.npf = o.k / ref.k * 100;
    }
    if (ok(a.ec_p) && ok(a.ec_f) && a.ec_f > 0) {
      o.sp = a.ec_p / a.ec_f * 100;
      if (ref && ok(ref.qp) && ref.qp > 0 && ok(qp) && o.tcf != null) {
        o.nsp = o.sp * (qp / ref.qp) / o.tcf;
        if (ok(ref.nsp) && ref.nsp > 0) o.nsp_pct = o.nsp / ref.nsp * 100;
      }
    }
    return o;
  }

  /** Günlük hat kaydı → KPI (asgari çalışma süresi altındaysa KPI'lar null). */
  function dayKPI(doc, model) {
    if (!doc || !(doc.saat >= model.sabit.min_run_h)) return null;
    return lineKPI(doc.avg, model.ref[doc.hat], model, doc.pass || +String(doc.hat)[1]);
  }

  function mean(xs) {
    const v = xs.filter(ok);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  }

  /** En küçük kareler eğimi: pts = [[gün no, y]] → birim/gün; en az 3 nokta. */
  function slope(pts) {
    const p = pts.filter(q => ok(q[0]) && ok(q[1]));
    if (p.length < 3) return null;
    const mx = mean(p.map(q => q[0])), my = mean(p.map(q => q[1]));
    let sxy = 0, sxx = 0;
    for (const [x, y] of p) { sxy += (x - mx) * (y - my); sxx += (x - mx) * (x - mx); }
    return sxx > 0 ? sxy / sxx : null;
  }

  /**
   * Hat durumu (son 7 gün ortalaması). `k7`: { npf, n_st1_pct, n_st2_pct, nsp_pct, st1 }.
   * Dönen: { st: "cip" | "izle" | "ok" | "na", reasons: [metin] }.
   */
  function lineStatus(k7, model) {
    const E = model.esik, S = model.sabit;
    if (!k7 || ![k7.npf, k7.n_st1_pct, k7.n_st2_pct, k7.nsp_pct, k7.st1].some(ok)) return { st: "na", reasons: [] };
    const f1 = v => v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
    const cip = [], izle = [];
    const chk = (v, lim, dir, name, unit) => {
      if (!ok(v) || !ok(lim)) return false;
      return dir === "lo" ? v <= lim : v >= lim;
    };
    const items = [
      [k7.npf, "lo", E.npf_cip, E.npf_izle, "NPF", "%"],
      [k7.n_st1_pct, "hi", E.ndp_cip, E.ndp_izle, "Norm St1 dP", "% ref"],
      [k7.n_st2_pct, "hi", E.ndp_cip, E.ndp_izle, "Norm St2 dP", "% ref"],
      [k7.nsp_pct, "hi", E.nsp_cip, E.nsp_izle, "NSP", "% ref"],
      [k7.st1, "hi", S.vessel_dp_max, null, "St1 dP", "bar"]
    ];
    for (const [v, dir, c, w, name, unit] of items) {
      if (chk(v, c, dir)) cip.push(name + " " + f1(v) + " " + unit + (dir === "lo" ? " ≤ " : " ≥ ") + f1(c));
      else if (chk(v, w, dir)) izle.push(name + " " + f1(v) + " " + unit + (dir === "lo" ? " ≤ " : " ≥ ") + f1(w));
    }
    if (cip.length) return { st: "cip", reasons: cip.concat(izle) };
    if (izle.length) return { st: "izle", reasons: izle };
    return { st: "ok", reasons: [] };
  }

  /**
   * Bir hattın günlük kayıtlarından (tarih artan) özet: son 7 gün ortalamaları, 30 gün eğimleri, durum.
   * `endIso`: değerlendirme günü (genelde verideki son gün).
   */
  function lineSummary(docs, model, endIso) {
    const from7 = isoAddDays(endIso, -6), from30 = isoAddDays(endIso, -29);
    const rows = docs.filter(d => d.tarih <= endIso).map(d => ({ d, k: dayKPI(d, model) }));
    const w7 = rows.filter(r => r.d.tarih >= from7);
    const w30 = rows.filter(r => r.d.tarih >= from30 && r.k);
    const k7rows = w7.filter(r => r.k);
    const avgK = f => mean(k7rows.map(r => r.k[f]));
    const avgA = f => mean(k7rows.map(r => r.d.avg && r.d.avg[f]));
    const s = {
      days: k7rows.length,
      saat: w7.length ? w7.reduce((a, r) => a + (r.d.saat || 0), 0) / 7 : null,
      qp: avgA("qp"), ec_p: avgA("ec_p"),
      rec: avgK("rec"), st1: avgK("st1"), st2: avgK("st2"), cf_dp: avgK("cf_dp"),
      n_st1: avgK("n_st1"), n_st1_pct: avgK("n_st1_pct"), n_st2_pct: avgK("n_st2_pct"),
      npf: avgK("npf"), nsp_pct: avgK("nsp_pct"),
      npf_slope: null, st1_slope: null
    };
    const sl1 = slope(w30.map(r => [dayNum(r.d.tarih), r.k.npf]));
    const sl2 = slope(w30.map(r => [dayNum(r.d.tarih), r.k.n_st1]));
    s.npf_slope = sl1 == null ? null : sl1 * 30;
    s.st1_slope = sl2 == null ? null : sl2 * 30;
    const st = lineStatus(k7rows.length ? s : null, model);
    s.st = st.st; s.reasons = st.reasons;
    return s;
  }

  /** Model belgesini varsayılanlarla birleştirir (eksik/hatalı alanlar varsayılana döner). */
  function mergeModel(doc) {
    const D = T.DEFAULT_MODEL;
    const m = JSON.parse(JSON.stringify(D));
    if (!doc || typeof doc !== "object") return m;
    const numOrNull = (v, def) => v === null ? null : (typeof v === "number" && isFinite(v) ? v : def);
    for (const sec of ["sabit", "esik"]) {
      const src = doc[sec] || {};
      for (const k in D[sec]) if (k in src) m[sec][k] = numOrNull(src[k], D[sec][k]);
    }
    const r = doc.ref || {};
    for (const line of T.LINES) {
      const src = r[line] || {};
      for (const k in D.ref[line]) if (k in src) m.ref[line][k] = numOrNull(src[k], D.ref[line][k]);
    }
    return m;
  }

  return {
    TAG_RE, PATH_RE, cellVal, num, toSerial, serialToISO, serialToStamp, isoAddDays,
    detectHeader, resolveColumns, makeAggregator, aggregate,
    tcf, lineKPI, dayKPI, mean, slope, lineStatus, lineSummary, mergeModel, percentile
  };
});
