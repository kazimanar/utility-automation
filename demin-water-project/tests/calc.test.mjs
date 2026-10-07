// node --test demin-water-project/tests
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const T = require("../panel/tags.js");
const C = require("../panel/calc.js");
const M = C.mergeModel(null);

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ""} beklenen ≈${b}, gelen ${a}`);

// Devreye alma ölçümü (Benchmark satır 62), P1-A referansıyla.
const BENCH = { qp: 86.3, qc: 23.4, pf: 8.44, pint: 6.41, pc: 5.45, t: 19, ec_f: 706, ec_p: 13.9, cf_in: 9.2, cf_out: 8.9 };

// ---------- sentetik PI tablosu: 2 gün × 144 dilim × 8 hat ----------
const DAY0 = 46108; // 2026-03-27
const LINE_VALS = {
  1: { qp: 86.3, qc: 23.4, pf: 8.44, pint: 6.41, pc: 5.45, ec_p: 13.9, cf_in: 9.2, cf_out: 8.9 },
  2: { qp: 75.0, qc: 13.0, pf: 9.8, pint: 8.2, pc: 7.35, ec_p: 0.9, cf_in: 10.5, cf_out: 10.2 }
};
function buildSheet({ pathOnly = false, extraTag = null } = {}) {
  const cols = [];
  for (const line of T.LINES) {
    const pass = +line[1], u = line[3];
    for (const p of T.LINE_PARAMS) cols.push({ tag: p.t[pass] + " " + u, line, k: p.k, group: "PASS " + pass + " " + u });
  }
  for (const p of T.PLANT_PARAMS) if (p.tag) cols.push({ tag: p.tag, plant: p.k, group: "INLET" });
  if (extraTag) cols.push({ tag: extraTag, plant: "_extra", group: "ACF" });
  const rows = [
    ["RO Analyses"],
    [null, ...cols.map(c => c.group)],
    ["Tag", ...cols.map(c => pathOnly ? null : c.tag)],
    ["Açıklama", ...cols.map(c => "desc " + c.tag)],
    ["Birim", ...cols.map(() => "?")],
    ["Path", ...cols.map(c => "\\\\PTA\\x" + c.tag.replace(/[- ]/g, "") + "_PV")]
  ];
  const plantVal = { p1_t: 19, p2_t: 20, p1_ec_f: 706, p2_ec_f: 20, ro_orp: 150, uf_ph: 7.0 };
  for (let d = 0; d < 2; d++) {
    for (let s = 0; s < 144; s++) {
      const t = DAY0 + d + s / 144;
      const row = [t];
      for (const c of cols) {
        if (c.line) {
          const pass = +c.line[1];
          let v = LINE_VALS[pass][c.k];
          // P1-B: 1. gün yalnız ilk 3 saat (18 dilim) çalışır; geri kalanında Qp 5.
          if (c.line === "P1-B" && d === 0 && s >= 18) v = c.k === "qp" ? 5 : v + 50;
          // P1-C: her 4. dilimde Qp 40 (çalışmıyor) ve basınçlar bozuk → ortalamaya girmemeli.
          if (c.line === "P1-C" && s % 4 === 0) v = c.k === "qp" ? 40 : 999;
          row.push(v);
        } else if (c.plant === "ro_orp") row.push(s < 72 ? 100 : 300);
        else if (c.plant === "_extra") row.push(0.45);
        else row.push(plantVal[c.plant] ?? 1);
      }
      if (s === 5) row[3] = "Resize to show all values";
      if (s === 6) row[4] = { t: "e", v: 42 };
      rows.push(row);
    }
  }
  return rows;
}

test("TCF ve devreye alma ölçümü: K≈21,70, NSP≈2,44, TCF≈0,812", () => {
  const k = C.lineKPI(BENCH, M.ref["P1-A"], M, 1);
  near(k.tcf, 0.812, 0.001, "TCF");
  near(k.k, 21.70, 0.02, "K");
  near(k.nsp, 2.44, 0.01, "NSP");
  near(k.rec, 86.3 / 109.7 * 100, 1e-9, "recovery");
  near(k.st1, 2.03, 1e-9, "St1 dP");
  near(k.st2, 0.96, 1e-9, "St2 dP");
  near(k.cf_dp, 0.3, 1e-9, "kartuş dP");
  near(k.npf, 21.70 / 22.282 * 100, 0.1, "NPF");
  // T > 25 → k = 2640
  near(C.tcf(30), Math.exp(2640 * (1 / 298.15 - 1 / 303.15)), 1e-12);
  near(C.tcf(25), 1, 1e-12);
});

test("normalize dP: referans debide gerçek dP'ye eşit, %ref doğru", () => {
  const ref = M.ref["P1-A"];
  const a = { ...BENCH, qp: ref.qp, qc: ref.qc };
  const k = C.lineKPI(a, ref, M, 1);
  near(k.n_st1, k.st1, 1e-12);
  near(k.n_st1_pct, k.st1 / ref.st1 * 100, 1e-9);
  // Debi düşünce normalize dP gerçek dP'den büyük olur.
  const k2 = C.lineKPI({ ...BENCH, qp: 70, qc: 20 }, ref, M, 1);
  near(k2.n_st1, k2.st1 * Math.pow((ref.qp + 2 * ref.qc) / 110, 1.5), 1e-9);
  // P2'de NSP_ref yok → NSP %ref hesaplanmaz.
  const k3 = C.lineKPI({ ...BENCH }, M.ref["P2-A"], M, 2);
  assert.equal(k3.nsp_pct, null);
  assert.ok(k3.nsp > 0);
});

test("başlık algılama: tag satırı ve veri başlangıcı", () => {
  const rows = buildSheet();
  const h = C.detectHeader(rows);
  assert.equal(h.mode, "tag");
  assert.equal(h.tagRow, 2);
  assert.equal(h.dataStart, 6);
  assert.equal(h.cols.length, 64 + 18);
  const c = h.cols.find(x => x.tag === "PI-91608 A");
  assert.equal(c.norm, "PI91608A");
  assert.equal(c.group, "PASS 1 A");
  assert.equal(c.desc, "desc PI-91608 A");
});

test("başlık algılama: tag satırı boşsa PI yolundan çıkarılır", () => {
  const h = C.detectHeader(buildSheet({ pathOnly: true }));
  assert.equal(h.mode, "path");
  const tags = h.cols.map(c => c.tag);
  assert.ok(tags.includes("PI-91608 A"));
  assert.ok(tags.includes("AI-91750"));
  const r = C.resolveColumns(h.cols, {});
  assert.equal(r.filter(c => c.key).length, 64 + 18);
});

test("tanınmayan tag kullanıcı eşleştirmesiyle bağlanır", () => {
  const h = C.detectHeader(buildSheet({ extraTag: "PDI-99001" }));
  let r = C.resolveColumns(h.cols, {});
  const ex = r.find(c => c.tag === "PDI-99001");
  assert.equal(ex.key, null);
  r = C.resolveColumns(h.cols, { PDI99001: "plant.acf_dp" });
  assert.equal(r.find(c => c.tag === "PDI-99001").key, "plant.acf_dp");
  r = C.resolveColumns(h.cols, { PDI99001: "ignore" });
  assert.equal(r.find(c => c.tag === "PDI-99001").src, "ignore");
});

test("günlük toplama: ortalama, çalışma saati, üretim, ORP medyan/P95", () => {
  const rows = buildSheet({ extraTag: "PDI-99001" });
  const h = C.detectHeader(rows);
  const cols = C.resolveColumns(h.cols, { PDI99001: "plant.acf_dp" });
  const out = C.aggregate(rows, h, cols, M);
  assert.equal(out.rows, 288);
  near(out.stepMin, 10, 0.01);
  assert.deepEqual(out.plantDays.map(p => p.tarih), ["2026-03-27", "2026-03-28"]);
  assert.equal(out.lineDays.length, 16);
  const a = out.lineDays.find(d => d.hat === "P1-A" && d.tarih === "2026-03-27");
  near(a.saat, 24, 1e-6);
  near(a.avg.qp, 86.3, 1e-9);
  near(a.avg.pf, 8.44, 1e-9);
  near(a.avg.t, 19, 1e-9);
  near(a.avg.ec_f, 706, 1e-9);
  near(a.uretim, 86.3 * 24, 1e-3);
  const p = out.plantDays[0];
  near(p.avg.acf_dp, 0.45, 1e-9);
  near(p.pct.ro_orp.med, 200, 1e-9);
  near(p.pct.ro_orp.p95, 300, 1e-9);
  near(p.uretim.p1, 86.3 * 24 * 2 + 86.3 * 3 + 86.3 * 18, 0.01); // A, D tam gün; B 3 h; C 18 h
  // Hatalı hücreler ("Resize…", #ERR) yok sayılır: P1-A Pf (kolon 3) ortalaması bozulmaz.
  assert.equal(out.partialDays.length, 0);
});

test("çalışma filtresi: Qp < Run_Min dilimleri ortalamaya girmez", () => {
  const rows = buildSheet();
  const h = C.detectHeader(rows);
  const out = C.aggregate(rows, h, C.resolveColumns(h.cols, {}), M);
  const c = out.lineDays.find(d => d.hat === "P1-C" && d.tarih === "2026-03-27");
  assert.equal(c.run_n, 108);
  near(c.saat, 18, 1e-6);
  near(c.avg.pf, 8.44, 1e-9);
  near(c.avg.qp, 86.3, 1e-9);
});

test("4 saat kuralı: 3 saat çalışan hatta KPI boş", () => {
  const rows = buildSheet();
  const h = C.detectHeader(rows);
  const out = C.aggregate(rows, h, C.resolveColumns(h.cols, {}), M);
  const b1 = out.lineDays.find(d => d.hat === "P1-B" && d.tarih === "2026-03-27");
  near(b1.saat, 3, 1e-6);
  near(b1.avg.pf, 8.44, 1e-9);
  assert.equal(C.dayKPI(b1, M), null);
  const b2 = out.lineDays.find(d => d.hat === "P1-B" && d.tarih === "2026-03-28");
  const k = C.dayKPI(b2, M);
  near(k.k, 21.70, 0.02);
});

test("eğim: en küçük kareler, gün başına", () => {
  near(C.slope([[0, 100], [1, 99], [2, 98], [3, 97]]), -1, 1e-12);
  assert.equal(C.slope([[0, 1], [1, 2]]), null);
});

test("durum: CIP / İZLE / OK / VERİ YOK", () => {
  // P1-A kabul değerleri: NPF 84,0 · norm St1 %156 · NSP %108 → CIP
  let s = C.lineStatus({ npf: 84.0, n_st1_pct: 156, n_st2_pct: 100, nsp_pct: 108, st1: 2.53 }, M);
  assert.equal(s.st, "cip");
  assert.ok(s.reasons.some(r => r.startsWith("NPF")));
  assert.ok(s.reasons.some(r => r.startsWith("Norm St1")));
  // P2-A: NPF 91,3 → OK
  s = C.lineStatus({ npf: 91.3, n_st1_pct: 100, n_st2_pct: 100, nsp_pct: null, st1: 1.6 }, M);
  assert.equal(s.st, "ok");
  s = C.lineStatus({ npf: 89, n_st1_pct: 100, n_st2_pct: 100, nsp_pct: null, st1: 1.6 }, M);
  assert.equal(s.st, "izle");
  s = C.lineStatus({ npf: 95, n_st1_pct: 100, n_st2_pct: 100, nsp_pct: null, st1: 3.5 }, M);
  assert.equal(s.st, "cip");
  assert.equal(C.lineStatus(null, M).st, "na");
});

test("hat özeti: son 7 gün ortalaması ve durum", () => {
  const rows = buildSheet();
  const h = C.detectHeader(rows);
  const out = C.aggregate(rows, h, C.resolveColumns(h.cols, {}), M);
  const docs = out.lineDays.filter(d => d.hat === "P1-A");
  const s = C.lineSummary(docs, M, "2026-03-28");
  assert.equal(s.days, 2);
  near(s.npf, 21.70 / 22.282 * 100, 0.1);
  assert.equal(s.st, "ok");
  near(s.saat, 48 / 7, 1e-6);
});

test("model birleştirme: eksik alanlar varsayılana döner, null korunur", () => {
  const m = C.mergeModel({ sabit: { min_run_h: 6, p2_ec_max: 1.5, osm: "x" }, ref: { "P1-A": { k: 23 } } });
  assert.equal(m.sabit.min_run_h, 6);
  assert.equal(m.sabit.p2_ec_max, 1.5);
  assert.equal(m.sabit.osm, 0.00069);
  assert.equal(m.ref["P1-A"].k, 23);
  assert.equal(m.ref["P1-A"].qp, 85.75);
  assert.equal(m.ref["P2-A"].nsp, null);
});
