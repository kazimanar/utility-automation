/*
 * Demin Water Project — tag sözlüğü ve varsayılan model sabitleri.
 * Tarayıcıda `window.DeminTags`, Node'da `require("./tags.js")` olarak kullanılır.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeminTags = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const PASSES = [1, 2];
  const UNITS = ["A", "B", "C", "D"];
  const LINES = [];
  for (const p of PASSES) for (const u of UNITS) LINES.push("P" + p + "-" + u);

  // Hat bazlı parametreler: tag = taban + " " + hat harfi (ör. "PI-91608 A").
  const LINE_PARAMS = [
    { k: "cf_in", l: "Kartuş giriş basıncı", u: "barg", t: { 1: "PI-91608", 2: "PI-91613" } },
    { k: "cf_out", l: "Kartuş çıkış basıncı", u: "barg", t: { 1: "PI-91609", 2: "PI-91614" } },
    { k: "pf", l: "Besleme basıncı Pf", u: "barg", t: { 1: "PI-91610", 2: "PI-91615" } },
    { k: "pint", l: "Ara kademe basıncı Pint", u: "barg", t: { 1: "PI-91611", 2: "PI-91616" } },
    { k: "pc", l: "Konsantre basıncı Pc", u: "barg", t: { 1: "PI-91612", 2: "PI-91617" } },
    { k: "qp", l: "Permeat debisi Qp", u: "m³/h", t: { 1: "FI-91771", 2: "FI-91773" } },
    { k: "qc", l: "Konsantre debisi Qc", u: "m³/h", t: { 1: "FI-91772", 2: "FI-91774" } },
    { k: "ec_p", l: "Permeat iletkenliği", u: "µS/cm", t: { 1: "AI-91751", 2: "AI-91753" } }
  ];

  // Tesis bazlı parametreler. `g`: proses grubu. Boş `tag` = yuva tanımlı, tag henüz belli değil
  // (yüklemede eşleştirme diyaloğuyla bağlanır).
  const PLANT_PARAMS = [
    { k: "uf_q_A", tag: "FT-91770 A", l: "UF-A çıkış debisi", u: "m³/h", g: "uf" },
    { k: "uf_q_B", tag: "FT-91770 B", l: "UF-B çıkış debisi", u: "m³/h", g: "uf" },
    { k: "uf_q_C", tag: "FT-91770 C", l: "UF-C çıkış debisi", u: "m³/h", g: "uf" },
    { k: "uf_q_D", tag: "FT-91770 D", l: "UF-D çıkış debisi", u: "m³/h", g: "uf" },
    { k: "uf_ph", tag: "AI-91795", l: "UF ortak çıkış pH", u: "", g: "uf" },
    { k: "uf_ceb_ph", tag: "AI-91790", l: "UF CEB pH", u: "", g: "uf" },
    { k: "uf_ceb_orp", tag: "AI-91810", l: "UF CEB ORP", u: "mV", g: "uf" },
    { k: "uf_turb", tag: "AI-91831", l: "UF giriş bulanıklık", u: "NTU", g: "uf" },
    { k: "p1_ec_f", tag: "AI-91750", l: "Pass-1 besleme EC", u: "µS/cm", g: "p1" },
    { k: "ro_orp", tag: "AI-91811", l: "RO giriş ORP", u: "mV", g: "p1" },
    { k: "ro_turb", tag: "AI-91832", l: "RO giriş bulanıklık", u: "NTU", g: "p1" },
    { k: "p1_ph", tag: "AI-91791", l: "Pass-1 giriş pH", u: "", g: "p1" },
    { k: "p1_t", tag: "TI-91800", l: "Pass-1 giriş sıcaklık", u: "°C", g: "p1" },
    { k: "p2_ec_f", tag: "AI-91752", l: "Pass-2 besleme EC", u: "µS/cm", g: "p2" },
    { k: "p2_ph", tag: "AI-91792", l: "Pass-2 giriş pH", u: "", g: "p2" },
    { k: "p2_t", tag: "TI-91801", l: "Pass-2 giriş sıcaklık", u: "°C", g: "p2" },
    { k: "prod_ec", tag: "AI-91754", l: "Nihai ürün EC", u: "µS/cm", g: "urun" },
    // TI-73052: kullanıcı teyidi bekliyor (Pass-2 çıkış sıcaklığı olarak varsayıldı).
    { k: "p2_out_t", tag: "TI-73052", l: "Pass-2 çıkış sıcaklığı (teyit)", u: "°C", g: "p2" },
    // ACF yuvaları
    { k: "acf_p_in", tag: "", l: "ACF giriş basıncı", u: "barg", g: "acf" },
    { k: "acf_p_out", tag: "", l: "ACF çıkış basıncı", u: "barg", g: "acf" },
    { k: "acf_dp", tag: "", l: "ACF fark basınç", u: "bar", g: "acf" },
    { k: "acf_orp", tag: "", l: "ACF çıkış ORP", u: "mV", g: "acf" },
    { k: "acf_cl", tag: "", l: "ACF çıkış serbest klor", u: "mg/L", g: "acf" },
    { k: "acf_q", tag: "", l: "ACF debisi", u: "m³/h", g: "acf" },
    // Katyon/anyon yuvaları
    { k: "iy_ec", tag: "", l: "Katyon/Anyon çıkış iletkenlik", u: "µS/cm", g: "iy" },
    { k: "iy_sio2", tag: "", l: "Katyon/Anyon çıkış silika", u: "ppb", g: "iy" },
    { k: "iy_ph", tag: "", l: "Katyon/Anyon çıkış pH", u: "", g: "iy" },
    { k: "iy_q", tag: "", l: "Katyon/Anyon debisi", u: "m³/h", g: "iy" }
  ];

  const GROUPS = { acf: "ACF", uf: "UF", p1: "Pass-1", p2: "Pass-2", iy: "Katyon/Anyon", urun: "Ürün" };

  // ORP gibi tag'ler için günlük medyan + P95 de saklanır.
  const PCT_KEYS = ["ro_orp", "uf_ceb_orp", "acf_orp"];

  /** Tag'i karşılaştırma anahtarına çevirir: "PI-91608 A" → "PI91608A". */
  function normTag(s) {
    return String(s == null ? "" : s).toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  /** Sözlükteki tüm hedefler: anahtar → { kind, line?, pass?, p?, k?, l, u, g } */
  function targets() {
    const out = {};
    for (const line of LINES) {
      const pass = +line[1];
      for (const p of LINE_PARAMS) {
        out[line + "." + p.k] = { kind: "line", line, pass, p: p.k, l: line + " " + p.l, u: p.u, g: "p" + pass };
      }
    }
    for (const p of PLANT_PARAMS) out["plant." + p.k] = { kind: "plant", k: p.k, l: p.l, u: p.u, g: p.g };
    return out;
  }

  /** Sözlükteki tag → hedef anahtarı (normTag ile). */
  function builtinIndex() {
    const idx = {};
    for (const line of LINES) {
      const pass = +line[1], unit = line[3];
      for (const p of LINE_PARAMS) idx[normTag(p.t[pass] + " " + unit)] = line + "." + p.k;
    }
    for (const p of PLANT_PARAMS) if (p.tag) idx[normTag(p.tag)] = "plant." + p.k;
    return idx;
  }

  /** Varsayılan model. Ayarlar diyaloğundan düzenlenir; `ayarlar/model` belgesinde saklanır. */
  const DEFAULT_MODEL = {
    sabit: {
      p1_perm: 1.5, p2_perm: 1.5,           // permeat basıncı, bar
      ec_tds: 0.58, osm: 0.00069,           // EC→TDS, osmotik katsayı (bar / mg/L)
      dp_exp: 1.5,                          // normalize dP üssü
      run_min_p1: 60, run_min_p2: 60,       // çalışıyor sayılma eşiği, Qp m³/h
      min_run_h: 4,                         // KPI için günlük asgari çalışma, h
      vessel_dp_max: 3.4,                   // gerçek St1 dP limiti, bar
      rec_p1_lo: 70, rec_p1_hi: 80, rec_p2_lo: 70, rec_p2_hi: 85,
      cf_dp_max: 1.0,                       // kartuş filtre dP limiti, bar
      orp_max: 300,                         // RO giriş ORP limiti, mV
      ph_lo: 6.8, ph_hi: 7.2,
      uf_turb_spec: 0.2,                    // NTU
      p2_ec_max: null, prod_ec_max: null    // µS/cm, boş = limit yok
    },
    esik: {
      npf_cip: 85, npf_izle: 90,            // NPF %ref ≤
      ndp_cip: 115, ndp_izle: 110,          // norm St1/St2 dP %ref ≥
      nsp_cip: 115, nsp_izle: 110           // NSP %ref ≥
    },
    // Hat referansları — Benchmark satır 48–55, devreye alma Mart 2024.
    ref: {
      "P1-A": { qp: 85.75, qc: 23.35, st1: 2.015, st2: 0.980, k: 22.282, nsp: 3.894 },
      "P1-B": { qp: 88.50, qc: 23.20, st1: 2.035, st2: 0.985, k: 22.428, nsp: 2.695 },
      "P1-C": { qp: 88.00, qc: 23.773, st1: 2.000, st2: 0.913, k: 22.943, nsp: 2.728 },
      "P1-D": { qp: 87.50, qc: 23.00, st1: 1.925, st2: 0.890, k: 22.852, nsp: 2.065 },
      "P2-A": { qp: 75.65, qc: 12.75, st1: 1.600, st2: 0.850, k: 12.348, nsp: null },
      "P2-B": { qp: 74.65, qc: 13.30, st1: 1.600, st2: 0.900, k: 12.225, nsp: null },
      "P2-C": { qp: 74.00, qc: 13.60, st1: 1.500, st2: 0.900, k: 11.683, nsp: null },
      "P2-D": { qp: 74.20, qc: 13.60, st1: 1.500, st2: 1.000, k: 12.220, nsp: null }
    }
  };

  // Ayarlar diyaloğundaki alan tanımları (etiket, birim).
  const MODEL_FIELDS = {
    sabit: [
      ["p1_perm", "Pass-1 permeat basıncı", "bar"], ["p2_perm", "Pass-2 permeat basıncı", "bar"],
      ["ec_tds", "EC → TDS katsayısı", ""], ["osm", "Osmotik katsayı", "bar·L/mg"],
      ["dp_exp", "Normalize dP üssü", ""],
      ["run_min_p1", "Pass-1 çalışma eşiği (Qp ≥)", "m³/h"], ["run_min_p2", "Pass-2 çalışma eşiği (Qp ≥)", "m³/h"],
      ["min_run_h", "KPI için asgari günlük çalışma", "h"],
      ["vessel_dp_max", "Vessel St1 dP limiti", "bar"],
      ["rec_p1_lo", "Pass-1 recovery alt", "%"], ["rec_p1_hi", "Pass-1 recovery üst", "%"],
      ["rec_p2_lo", "Pass-2 recovery alt", "%"], ["rec_p2_hi", "Pass-2 recovery üst", "%"],
      ["cf_dp_max", "Kartuş filtre dP limiti", "bar"], ["orp_max", "RO giriş ORP limiti", "mV"],
      ["ph_lo", "pH bandı alt", ""], ["ph_hi", "pH bandı üst", ""],
      ["uf_turb_spec", "UF bulanıklık spesifikasyonu", "NTU"],
      ["p2_ec_max", "Pass-2 permeat EC limiti", "µS/cm"], ["prod_ec_max", "Nihai ürün EC limiti", "µS/cm"]
    ],
    esik: [
      ["npf_cip", "NPF CIP eşiği (≤)", "%ref"], ["npf_izle", "NPF İZLE eşiği (≤)", "%ref"],
      ["ndp_cip", "Norm dP CIP eşiği (≥)", "%ref"], ["ndp_izle", "Norm dP İZLE eşiği (≥)", "%ref"],
      ["nsp_cip", "NSP CIP eşiği (≥)", "%ref"], ["nsp_izle", "NSP İZLE eşiği (≥)", "%ref"]
    ],
    ref: [["qp", "Qp", "m³/h"], ["qc", "Qc", "m³/h"], ["st1", "St1 dP", "bar"], ["st2", "St2 dP", "bar"], ["k", "K", ""], ["nsp", "NSP", "%"]]
  };

  return { PASSES, UNITS, LINES, LINE_PARAMS, PLANT_PARAMS, GROUPS, PCT_KEYS, DEFAULT_MODEL, MODEL_FIELDS, normTag, targets, builtinIndex };
});
