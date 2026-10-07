# Veri sözleşmesi — ham PI Excel → panel

Panel yalnız Canary/PI DataLink'ten alınan **ham 10 dk ortalamalı Excel**'i okur ve tüm KPI'ları kendisi hesaplar. Excel'in Hesap/Günlük/Panel/Notlar sayfaları kullanılmaz.

## 1. Dosya formatı

| Satır | İçerik | Panelde kullanımı |
|---|---|---|
| 2 | Grup başlıkları (PASS 1 A … PASS 2 D, PASS 1 INLET, PASS 2 INLET, PASS 2 OUTLET) | Önizlemede gösterilir (birleşik hücreler sağa taşınır) |
| **3** | **Tag** (`PI-91608 A`, `AI-91750`) | **Eşleştirme anahtarı** |
| 4 | Açıklama | Önizlemede gösterilir |
| 5 | Birim | Kullanılmaz; birim sözlükten alınır |
| 6 | PI yolu (`…PTA.xPI91608A_PV`) | Tag satırı yoksa tag buradan çıkarılır |
| 7+ | A: Excel seri zamanı (10 dk adım), diğerleri sayı | Sayı olmayan, hata ve "Resize…" hücreleri yok sayılır |

- **Sayfa seçimi:** önce adı `Pass1-2 Data` olan, sonra adında "pass"+"data", sonra "data/pi/canary" geçen sayfa denenir; tag satırı bulunan ilk sayfa kullanılır. Yalnız o sayfa ayrıştırılır (SheetJS `dense: true`, `sheets: [ad]`).
- **Tag satırı algılama:** satır numarası sabit varsayılmaz. İlk 15 satırda `^(PI|PT|FI|FT|AI|AE|TI)-\d{4,6}( ?[A-D])?$` desenine en çok uyan satır (en az 3 eşleşme) tag satırıdır. Bulunamazsa PI yolu satırından `x?([A-Z]{2,4})(\d{4,6})([A-D])?_PV` ile tag üretilir (`xPI91608A_PV` → `PI-91608 A`).
- **Karşılaştırma:** tag'ler büyük harfe çevrilip harf/rakam dışı karakterler atılarak eşleşir (`PI-91608 A` ≡ `PI91608A`).
- **Veri başlangıcı:** tag satırından sonra A kolonunda ilk geçerli zaman (Excel seri sayısı ya da `YYYY-MM-DD HH:MM` / `DD.MM.YYYY HH:MM` metni).
- **Adım:** ilk 50 zaman farkının medyanı (normalde 10 dk). Çalışma saati = çalışan dilim sayısı × adım.
- **Gün:** zaman damgasının takvim günü (`00:00` dilimi o güne aittir). Bir günde beklenen dilimin %95'inden azı varsa önizlemede "kısmi gün" olarak listelenir.
- Ham 10 dk verisi **saklanmaz**; yalnız günlük özetler yazılır.

## 2. Tag sözlüğü (`panel/tags.js`)

### Hat bazlı (son harf = hat A–D)

| Parametre | Anahtar | Pass-1 tag | Pass-2 tag | Birim |
|---|---|---|---|---|
| Kartuş giriş basıncı | `cf_in` | PI-91608 | PI-91613 | barg |
| Kartuş çıkış basıncı | `cf_out` | PI-91609 | PI-91614 | barg |
| Besleme basıncı Pf | `pf` | PI-91610 | PI-91615 | barg |
| Ara kademe basıncı Pint | `pint` | PI-91611 | PI-91616 | barg |
| Konsantre basıncı Pc | `pc` | PI-91612 | PI-91617 | barg |
| Permeat debisi Qp | `qp` | FI-91771 | FI-91773 | m³/h |
| Konsantre debisi Qc | `qc` | FI-91772 | FI-91774 | m³/h |
| Permeat iletkenliği | `ec_p` | AI-91751 | AI-91753 | µS/cm |

### Tesis bazlı

| Anahtar | Tag | Parametre | Birim |
|---|---|---|---|
| `uf_q_A`…`uf_q_D` | FT-91770 A–D | UF çıkış debisi | m³/h |
| `uf_ph` | AI-91795 | UF ortak çıkış pH | |
| `uf_ceb_ph` | AI-91790 | UF CEB pH | |
| `uf_ceb_orp` | AI-91810 | UF CEB ORP | mV |
| `uf_turb` | AI-91831 | UF giriş bulanıklık | NTU |
| `p1_ec_f` | AI-91750 | Pass-1 besleme EC | µS/cm |
| `ro_orp` | AI-91811 | RO giriş ORP | mV |
| `ro_turb` | AI-91832 | RO giriş bulanıklık | NTU |
| `p1_ph` | AI-91791 | Pass-1 giriş pH | |
| `p1_t` | TI-91800 | Pass-1 giriş sıcaklık | °C |
| `p2_ec_f` | AI-91752 | Pass-2 besleme EC | µS/cm |
| `p2_ph` | AI-91792 | Pass-2 giriş pH | |
| `p2_t` | TI-91801 | Pass-2 giriş sıcaklık | °C |
| `prod_ec` | AI-91754 | Nihai ürün EC | µS/cm |
| `p2_out_t` | TI-73052 | Pass-2 çıkış sıcaklığı (**teyit bekliyor**) | °C |

### Tag'i henüz belli olmayan yuvalar

| Anahtar | Parametre | Birim |
|---|---|---|
| `acf_p_in`, `acf_p_out`, `acf_dp` | ACF giriş/çıkış basıncı, fark basınç | barg / bar |
| `acf_orp`, `acf_cl` | ACF çıkış ORP, serbest klor | mV, mg/L |
| `acf_q` | ACF debisi | m³/h |
| `iy_ec`, `iy_sio2`, `iy_ph`, `iy_q` | Katyon/Anyon çıkış iletkenlik, silika, pH, debi | µS/cm, ppb, –, m³/h |

Sözlükte olmayan bir tag yüklendiğinde önizleme diyaloğu her biri için bir parametre seçtirir (yuvalar, tesis parametreleri ya da herhangi bir hattın parametresi) ya da "Yoksay". Seçimler `ayarlar/tags` belgesine yazılır ve sonraki yüklemelerde otomatik uygulanır; Ayarlar → Tag eşleştirmeleri'nden değiştirilir/kaldırılır. Kullanıcı eşleştirmesi sözlükten önce gelir; aynı hedefe iki kolon bağlanırsa ilki kullanılır.

## 3. Hesap modeli (`panel/calc.js`)

**Sıra: önce günlük ortalama, sonra KPI.**

1. Her 10 dk dilimde, her hat için: **çalışıyor** = Qp ≥ Run_Min (P1 60, P2 60 m³/h).
2. Gün × hat: çalışan dilimlerde her parametrenin ham değer ortalaması. T ve EC_f (pass ortak tag'leri) de o hattın çalışan dilimlerinde ortalanır: P1 → TI-91800 / AI-91750, P2 → TI-91801 / AI-91752.
3. Çalışma < Min_Run_Hours (4 h) ise o gün o hat için KPI boş (ortalamalar yine saklanır).
4. KPI'lar günlük ortalamalardan:

| KPI | Formül |
|---|---|
| Recovery R | Qp / (Qp + Qc) · 100 |
| St1 dP / St2 dP | Pf − Pint / Pint − Pc |
| Kartuş dP | CF_in − CF_out |
| Normalize dP | dP · ((Qp + 2Qc)_ref / (Qp + 2Qc))^dP_Exp ; %ref = / dP_ref · 100 |
| TCF | exp(k · (1/298,15 − 1/(273,15 + T))), k = 3020 (T ≤ 25), 2640 (T > 25) |
| π_fc | EC_f · EC_to_TDS · ln(1/(1−R)) / R · Osm_Coef |
| π_p | EC_p · EC_to_TDS · Osm_Coef |
| NDP | Pf − (Pf − Pc)/2 − P_perm − π_fc + π_p |
| K | Qp / (NDP · TCF) |
| **NPF** | K / K_ref · 100 |
| SP | EC_p / EC_f · 100 |
| NSP | SP · (Qp / Qp_ref) / TCF |
| **NSP %ref** | NSP / NSP_ref · 100 (NSP_ref boşsa hesaplanmaz; P2'de permeat EC ham izlenir) |

5. **Tesis günlüğü:** tesis tag'lerinin tüm dilimlerdeki günlük ortalaması; `ro_orp`, `uf_ceb_orp`, `acf_orp` için ayrıca medyan ve P95. Pass üretimi m³/gün = Σ(çalışan dilimlerde Qp) × adım.
6. **Eğimler (30 gün):** değerlendirme gününe kadar son 30 gündeki geçerli günlerin NPF (%) ve normalize St1 dP (bar) değerlerine en küçük kareler; gün başına eğim × 30. En az 3 gün gerekir.
7. **Durum (hat, son 7 gün ortalaması):** değerlendirme günü verideki son gündür; pencere [son − 6, son]. KPI'ları olan günlerin ortalaması alınır.
   - **CIP**: NPF ≤ 85 ∨ norm St1 dP ≥ %115 ∨ norm St2 dP ≥ %115 ∨ NSP ≥ %115 ∨ gerçek St1 dP ≥ 3,4 bar
   - **İZLE**: NPF ≤ 90 ∨ norm St1 dP ≥ %110 ∨ norm St2 dP ≥ %110 ∨ NSP ≥ %110
   - aksi **OK**; pencerede geçerli gün yoksa **VERİ YOK**. Gerekçe metni eşiği aşan kalemlerden üretilir.

Panel KPI'ları her görüntülemede saklanan ortalamalardan **güncel ayarlarla yeniden hesaplar**; referans/eşik değişikliği yeniden yükleme gerektirmez. Çalışma eşiği (Run_Min) değişirse günlük ortalamalar değiştiği için veri yeniden yüklenmelidir.

### Varsayılan sabitler (`ayarlar/model`)

| Alan | Değer |
|---|---|
| P1_Perm_Press / P2_Perm_Press | 1,5 / 1,5 bar |
| EC_to_TDS · Osm_Coef · dP_Exp | 0,58 · 0,00069 · 1,5 |
| Run_Min P1 / P2 | 60 / 60 m³/h |
| Min_Run_Hours | 4 h |
| Vessel_dP_Max | 3,4 bar |
| Recovery bandı | P1 70–80, P2 70–85 % |
| Kartuş dP limiti · ORP limiti | 1,0 bar · 300 mV |
| pH bandı (P1, P2, UF çıkış) | 6,8–7,2 |
| UF bulanıklık spesifikasyonu | 0,2 NTU |
| P2 permeat EC limiti · Nihai EC limiti | boş (tanımsız) |

### Hat referansları (Benchmark satır 48–55, devreye alma Mart 2024)

| Hat | Qp_ref | Qc_ref | St1 dP_ref | St2 dP_ref | K_ref | NSP_ref |
|---|---|---|---|---|---|---|
| P1-A | 85,75 | 23,35 | 2,015 | 0,980 | 22,282 | 3,894 |
| P1-B | 88,50 | 23,20 | 2,035 | 0,985 | 22,428 | 2,695 |
| P1-C | 88,00 | 23,773 | 2,000 | 0,913 | 22,943 | 2,728 |
| P1-D | 87,50 | 23,00 | 1,925 | 0,890 | 22,852 | 2,065 |
| P2-A | 75,65 | 12,75 | 1,600 | 0,850 | 12,348 | — |
| P2-B | 74,65 | 13,30 | 1,600 | 0,900 | 12,225 | — |
| P2-C | 74,00 | 13,60 | 1,500 | 0,900 | 11,683 | — |
| P2-D | 74,20 | 13,60 | 1,500 | 1,000 | 12,220 | — |

Doğrulama: devreye alma ölçümü (Benchmark satır 62: Qp 86,3, Qc 23,4, Pf 8,44, Pint 6,41, Pc 5,45, T 19, EC_f 706, EC_p 13,9) P1-A referansıyla K ≈ 21,70, NSP ≈ 2,44, TCF ≈ 0,812 verir (`tests/calc.test.mjs`).

## 4. Saklama (artifact `db`)

| Yol | İçerik |
|---|---|
| `gunluk_hat/{YYYY-MM-DD}_{P1-A}` | `tarih, hat, pass, n` (dilim), `run_n` (çalışan dilim), `saat`, `uretim` (m³), `avg` {cf_in, cf_out, pf, pint, pc, qp, qc, ec_p, t, ec_f}, `kpi` (yükleme anındaki ayarlarla, bilgi amaçlı), `yukleme`, `guncelleme` |
| `gunluk_tesis/{YYYY-MM-DD}` | `tarih, n, avg` {tesis anahtarları}, `pct` {ro_orp: {med, p95}, …}, `uretim` {p1, p2}, `yukleme`, `guncelleme` |
| `ayarlar/model` | `sabit`, `esik`, `ref` (hat → qp, qc, st1, st2, k, nsp), `guncelleme`, `kullanici` |
| `ayarlar/tags` | `map`: normalize tag → hedef (`P1-A.qp`, `plant.acf_dp`) ya da `ignore` |
| `yuklemeler/{u<zaman>}` | `dosya, sayfa, ilk, son, satir, adim_dk, gun, kayit, atlanan, kullanici` (`user.id()`), `zaman` |

- Aynı gün yeniden yüklenirse belge **üzerine yazılır**; içeriği değişmeyen günler atlanır. Kısmi bir gün (ör. dosya 12:00'de başlıyorsa) tam günün üzerine yazar: önizlemedeki "Kısmi gün" listesine bakın.
- Yazımlar 3 eşzamanlı işçi ve üstel geri çekilmeyle yapılır.
- 1 yıl ≈ 365 × 9 ≈ 3.300 belge (artifact sınırı 25.000). Panel her hat için son 1000 günü ve son 1000 tesis gününü okur.
- Eski elle giriş modelinin `gunluk` ve `ayarlar/limitler` belgeleri kullanılmaz.
