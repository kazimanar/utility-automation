# Demin Water Project

Demin su ünitesi (ACF → UF → Pass-1 → Pass-2 → Katyon/Anyon) için performans paneli. Tesis 2 pass × 4 hat RO'dur (P1-A..D, P2-A..D). Panel, Canary/PI DataLink'ten alınan **ham 10 dk ortalamalı Excel**'i okur ve tüm KPI'ları (recovery, normalize dP, TCF, NDP, NPF, NSP, hat durumu CIP / İZLE / OK) kendisi hesaplar.

**Panel:** https://claude.ai/artifact/6eYLKeewg6CvLzNgXk9yV5 (claude.ai artifact'ı; kaynağı bu klasörde)

**SharePoint / OneDrive sürümü:** `sharepoint/dist/demin-panel-sharepoint.html` — tek dosya, internetsiz çalışır, veriyi SharePoint klasöründeki `demin-veri.json`'da tutar. Kurulum: `docs/sharepoint.md`.

## Veri akışı

```
PI DataLink Excel ("Pass1-2 Data", 10 dk)
  → panel: tag satırını bul, tag'leri sözlükle eşleştir (tanınmayanları sor)
  → hat × gün: çalışan dilimlerin (Qp ≥ 60 m³/h) ortalaması, çalışma saati, üretim
  → tesis × gün: ortalamalar, ORP medyan/P95, pass üretimi
  → artifact db: gunluk_hat / gunluk_tesis (ham veri saklanmaz)
  → görüntüleme: KPI'lar güncel ayarlarla yeniden hesaplanır
```

## Nasıl yüklenir

1. PI DataLink'ten ham 10 dk verisini Excel olarak alın (tag satırı, açıklama, birim, PI yolu başlıkları ve A kolonunda zaman).
2. Panelde **PI Excel yükle** → dosyayı seçin. Önizlemede sayfa, zaman aralığı, gün sayısı, kısmi günler ve tanınan tag'ler görünür.
3. Sözlükte olmayan tag'ler (ör. ACF, katyon/anyon) için bir parametre seçin ya da "Yoksay" bırakın. Seçim kaydedilir, sonraki yüklemelerde otomatik tanınır.
4. **Kaydet**. Aynı günler yeniden yüklenirse üzerine yazılır; değişmeyen günler atlanır.

Model sabitleri, durum eşikleri, hat referansları ve tag eşleştirmeleri **Ayarlar**'dan düzenlenir (paneli açan herkes için geçerli).

## Klasör yapısı

| Yol | İçerik |
|---|---|
| `panel/index.html` | Artifact sayfası (arayüz, yükleme, db) |
| `panel/calc.js` | Saf hesap modülü: başlık algılama, günlük toplama, KPI, durum (tarayıcı global `DeminCalc` + Node `require`) |
| `panel/file-store.js` | SharePoint sürümünün veri katmanı (klasördeki `demin-veri.json`) |
| `sharepoint/build.mjs` | SharePoint sürümünü tek HTML dosyası olarak derler → `sharepoint/dist/` |
| `panel/tags.js` | Tag sözlüğü, varsayılan sabitler/eşikler/hat referansları (`DeminTags`) |
| `docs/veri-sozlesmesi.md` | PI Excel formatı, tag → parametre tablosu, formüller, db şeması |
| `docs/sharepoint.md` | SharePoint/OneDrive sürümünün kurulumu ve sınırları |
| `docs/yol-haritasi.md` | Sonraki fazlar (elle girişler, CIP kaydı vb. — karar bekliyor) |
| `tests/calc.test.mjs` | `node:test` testleri |

## Test

```sh
node --test "demin-water-project/tests/*.test.mjs"
```

Testler formülleri (devreye alma ölçümüyle K ≈ 21,70, NSP ≈ 2,44, TCF ≈ 0,812), başlık algılamayı (tag satırı ve PI yolu), kullanıcı tag eşleştirmesini, çalışma filtresini, 4 saat kuralını, eğimi ve durum kurallarını kapsar. Bağımlılık yoktur (Node 18+).

## Yayınlama

Panel aynı artifact URL'ine `panel/index.html` sayfa, `calc.js` ve `tags.js` yan dosya olarak yayınlanır; yetenekler: `db`, `user`, `downloads`.
