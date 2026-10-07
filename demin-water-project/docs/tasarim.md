# Panel tasarımı — karar kayıtları

07.10.2026, kullanıcıyla birlikte seçildi (`ui-ux-pro-max` önerileri + seçenek turu).

| Konu | Karar | Gerekçe |
|---|---|---|
| Kullanıcı | Proses mühendisi, masaüstü | Trend karşılaştırma ve CIP planlama; telefon görünümü bozulmaz ama öncelik değil |
| Bilgi mimarisi | Önce karar, sonra detay | Mühendis "bugün hangi hat CIP istiyor" sorusunun cevabını sayfanın başında görür |
| Görsel dil | Teknik açık tema (mevcut tokenlar) | Rapor ve ekran paylaşımına uygun; açık/koyu tema korunur |
| Hat görünümü | Hat kartı + 30 gün sparkline | Değer, yön ve eşiğe mesafe tek bakışta |
| Detay | Karta tıklayınca o pass'in 4 hattı aynı grafiklerde, tıklanan hat vurgulu | Kirlenme kardeş hatlarla kıyaslanarak okunur |

## Sayfa sırası

1. **Karar özeti** — CIP ve İZLE hatları (önce CIP, sonra NPF'ye göre), gerekçe ve 30 günlük NPF / St1 dP eğimi; OK ve veri yok hatları tek satırda. Satıra tıklamak kartla aynı işi yapar.
2. **RO hatları** — Pass-1 ve Pass-2 için 4'er kart: durum, NPF (% ref, bullet bar: CIP ve İZLE eşikleri, sparkline, eğim), normalize St1 dP (% ref, sparkline, eğim), NSP % ref (P1) / permeat EC (P2), çalışma saati, Qp, recovery, gerekçe. Değerler son 7 gün ortalaması, çizgiler değerlendirme gününe kadar son 30 gün.
3. **RO hat trendleri** — seçili pass'in 4 hattı; kartla seçilen hat kalın, diğerleri soluk. "… vurgulu · kaldır" düğmesi vurguyu kaldırır.
4. **Hat karar tablosu** — 13 kolonluk sayısal tablo, katlanabilir (açık/kapalı durumu tarayıcıda hatırlanır).
5. **Ön arıtma ve ürün** — ACF, UF, Katyon/Anyon, Ürün kartları (pass kartları hat kartlarına taşındı).
6. **Tesis trendleri** — ürün EC, ORP, pH, sıcaklık, UF debileri, bulanıklık, besleme EC, üretim; ACF ve iyon değiştirici grafikleri veri gelince eklenir.

## Kurallar

- Durum her yerde renk + işaret + metinle verilir (■ CIP, ▲ İzle, ● OK, ○ Veri yok); renk tek başına anlam taşımaz.
- Hat renkleri sabit: A mavi, B turuncu, C yeşil, D sarı (kart işareti, sparkline ve trend serisi aynı).
- Metinler tema mürekkep tokenlarıyla, seri rengiyle değil.
